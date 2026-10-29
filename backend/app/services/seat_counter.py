"""
Bộ đếm số vé còn lại — trái tim của cơ chế chống oversell.

Vấn đề cần giải quyết:
  1500 người cùng bấm "Đăng ký" → nếu chỉ dùng if/else thông thường, nhiều người
  cùng đọc "còn 1 vé" và cùng trừ → bán vượt. Giải pháp: dùng Redis với Lua script
  chạy NGUYÊN TỬ (atomic) — Redis chỉ xử lý 1 lệnh tại một thời điểm.

Cách hoạt động:
  - Lua script _LUA: đọc số vé còn → nếu > 0 thì trừ 1 và báo thành công, ngược lại báo thất bại.
    Vì là Lua script, Redis thực thi toàn bộ như 1 lệnh duy nhất → không thể có 2 người
    cùng "thắng" khi chỉ còn 1 vé.
  - Ngoài đếm vé, Redis còn lưu tập hợp email đã đăng ký (để chặn trùng email nhanh).

Hai class:
  - RedisCounter : dùng khi có Redis thật (môi trường dev với Docker hoặc AWS ElastiCache)
  - MemoryCounter: dùng khi không có Redis (chạy test nhanh, chỉ 1 tiến trình)

Biến `counter` ở cuối file tự chọn class phù hợp dựa vào biến môi trường REDIS_HOST.
"""
import threading
from app.config import settings

# Script Lua chạy nguyên tử trên Redis:
# - Đọc số vé còn lại
# - Nếu hết (hoặc chưa khởi tạo) → trả về 0 (thất bại)
# - Nếu còn → trừ 1 rồi trả về 1 (thành công)
_LUA = """
local s = redis.call('GET', KEYS[1])
if (not s) or tonumber(s) <= 0 then return 0 end
redis.call('DECR', KEYS[1])
return 1
"""


class RedisCounter:
    """Bộ đếm thật dùng Redis — an toàn với nhiều tiến trình/server cùng lúc."""

    def __init__(self, host, event_id):
        import redis
        # socket_timeout=2: nếu Redis không trả lời trong 2 giây → báo lỗi, không treo request
        self.r = redis.Redis(host=host, port=6379, decode_responses=True,
                             socket_timeout=2, socket_connect_timeout=2)
        self._reserve = self.r.register_script(_LUA)  # đăng ký Lua script một lần
        # Key lưu số vé còn: "event:1:left"
        # Key lưu tập email: "event:1:emails"
        self.k_left, self.k_emails = f"event:{event_id}:left", f"event:{event_id}:emails"

    def left(self):
        """Đọc số vé còn. Trả None nếu Redis chưa có giá trị (server mới khởi động)."""
        v = self.r.get(self.k_left)
        return None if v is None else int(v)

    def set_if_missing(self, n):
        """Khởi tạo số vé nếu chưa có (NX = chỉ set khi key chưa tồn tại, tránh ghi đè)."""
        self.r.set(self.k_left, n, nx=True)

    def reserve(self) -> bool:
        """Giữ 1 vé nguyên tử. Trả True nếu thành công, False nếu hết vé."""
        return self._reserve(keys=[self.k_left]) == 1

    def release(self):
        """Trả lại 1 vé khi ghi DB thất bại (rollback)."""
        self.r.incr(self.k_left)

    def mark(self, email) -> bool:
        """Đánh dấu email đã dùng. Trả True nếu email mới, False nếu trùng."""
        return self.r.sadd(self.k_emails, email) == 1

    def unmark(self, email):
        """Bỏ đánh dấu email khi rollback."""
        self.r.srem(self.k_emails, email)


class MemoryCounter:
    """Bộ đếm trong bộ nhớ — chỉ dùng khi chạy test, không có Redis.
    Dùng threading.Lock để an toàn với đa luồng trong 1 tiến trình."""

    def __init__(self):
        self.lock = threading.Lock()
        self._left = None      # None = chưa khởi tạo
        self._emails = set()   # Tập email đã đăng ký

    def left(self): return self._left

    def set_if_missing(self, n):
        with self.lock:
            if self._left is None:
                self._left = n

    def reserve(self) -> bool:
        with self.lock:
            if not self._left or self._left <= 0:
                return False
            self._left -= 1
            return True

    def release(self):
        with self.lock: self._left += 1

    def mark(self, email) -> bool:
        with self.lock:
            if email in self._emails:
                return False
            self._emails.add(email)
            return True

    def unmark(self, email):
        with self.lock: self._emails.discard(email)


# Tự động chọn Redis hoặc bộ nhớ tùy theo có REDIS_HOST hay không
counter = RedisCounter(settings.redis_host, settings.event_id) if settings.redis_host else MemoryCounter()
