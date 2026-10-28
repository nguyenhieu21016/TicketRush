import React, { useState } from 'react';

interface WaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinWaitlist: (name: string, email: string) => void;
}

const WaitlistModal: React.FC<WaitlistModalProps> = ({
  isOpen,
  onClose,
  onJoinWaitlist,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submittedPos, setSubmittedPos] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    // Simulate FIFO queue position (US-15 & US-16)
    const randomPos = Math.floor(10 + Math.random() * 25);
    setSubmittedPos(randomPos);
    onJoinWaitlist(name.trim(), email.trim());
  };

  const handleReset = () => {
    setSubmittedPos(null);
    setName('');
    setEmail('');
    onClose();
  };

  return (
    <div className="modal-overlay active">
      <div className="modal-card waitlist-card">
        <button type="button" className="modal-close" onClick={handleReset}>
          &times;
        </button>

        {submittedPos === null ? (
          <>
            <div className="modal-header">
              <div className="waitlist-icon-badge">WAIT</div>
              <h2>Tham Gia Danh Sách Chờ (Waitlist FIFO)</h2>
              <p>
                Đợt vé 300 chỗ hiện đã hết. Bạn có thể đăng ký vào hàng đợi (FIFO). Khi có người hủy vé hoặc thanh toán thất bại, hệ thống sẽ tự động gửi email mời bạn mua vé tiếp theo!
              </p>
            </div>

            <form onSubmit={handleSubmit} className="waitlist-form">
              <div className="form-group">
                <label htmlFor="wl-name">Họ và tên của bạn</label>
                <div className="input-wrapper">
                  <input
                    id="wl-name"
                    type="text"
                    required
                    placeholder="Nguyễn Văn A"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="wl-email">Email nhận thông báo giữ chỗ</label>
                <div className="input-wrapper">
                  <input
                    id="wl-email"
                    type="email"
                    required
                    placeholder="your-email@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <button type="submit" className="btn-rush btn-waitlist">
                Xếp Hàng Nhận Chỗ Ngay
              </button>
            </form>
          </>
        ) : (
          <div className="waitlist-success">
            <div className="queue-badge-big">
              <span className="queue-label">VỊ TRÍ HÀNG ĐỢI (FIFO)</span>
              <span className="queue-number">#{submittedPos}</span>
            </div>
            <h3>Bạn đã vào danh sách chờ thành công!</h3>
            <p>
              Hệ thống đã ghi nhận email <strong>{email}</strong>. Khi có ghế trống được nhả ra từ ElastiCache Redis, hệ thống sẽ gửi liên kết thanh toán ưu tiên trong vòng 10 phút.
            </p>
            <button type="button" className="btn-secondary" onClick={handleReset}>
              Đã hiểu &amp; Đóng
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WaitlistModal;
