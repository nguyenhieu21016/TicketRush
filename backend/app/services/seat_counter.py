"""Bộ đếm vé còn lại.
- Chạy thật: Redis (ElastiCache), trừ vé bằng Lua script NGUYÊN TỬ nên 1500 người cùng bấm vẫn không bán vượt.
- Chạy thử không Redis: bản trong bộ nhớ (chỉ 1 tiến trình)."""
import threading
from app.config import settings

_LUA = """
local s = redis.call('GET', KEYS[1])
if (not s) or tonumber(s) <= 0 then return 0 end
redis.call('DECR', KEYS[1])
return 1
"""


class RedisCounter:
    def __init__(self, host, event_id):
        import redis
        self.r = redis.Redis(host=host, port=6379, decode_responses=True, socket_timeout=2, socket_connect_timeout=2)
        self._reserve = self.r.register_script(_LUA)
        self.k_left, self.k_emails = f"event:{event_id}:left", f"event:{event_id}:emails"

    def left(self):
        v = self.r.get(self.k_left)
        return None if v is None else int(v)

    def set_if_missing(self, n): self.r.set(self.k_left, n, nx=True)
    def reserve(self) -> bool: return self._reserve(keys=[self.k_left]) == 1
    def release(self): self.r.incr(self.k_left)
    def mark(self, email) -> bool: return self.r.sadd(self.k_emails, email) == 1
    def unmark(self, email): self.r.srem(self.k_emails, email)


class MemoryCounter:
    def __init__(self):
        self.lock, self._left, self._emails = threading.Lock(), None, set()

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


counter = RedisCounter(settings.redis_host, settings.event_id) if settings.redis_host else MemoryCounter()
