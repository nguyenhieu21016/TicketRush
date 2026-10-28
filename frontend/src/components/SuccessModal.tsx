import React from 'react';
import type { ModalTicketInfo } from '../types';

interface SuccessModalProps {
  info: ModalTicketInfo | null;
  onClose: () => void;
  onViewMyTickets: () => void;
}

const SuccessModal: React.FC<SuccessModalProps> = ({ info, onClose, onViewMyTickets }) => {
  if (!info) return null;

  return (
    <div className="modal-overlay active" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card cticket-modal">
        <button type="button" className="modal-close" onClick={onClose}>
          &times;
        </button>

        <div className="modal-header">
          <div className="success-icon-badge">OK</div>
          <h2>Đặt Vé Thành Công!</h2>
          <p>Chúc mừng bạn đã săn vé thành công trên hệ thống TicketRush.</p>
        </div>

        {/* CTicket Perforated Boarding Pass */}
        <div className="cticket-pass">
          <div className="ticket-cutout left"></div>
          <div className="ticket-cutout right"></div>

          <div className="cticket-header">
            <div className="brand-tag">
              <span className="dot-live"></span> TICKETRUSH E-PASS
            </div>
            <span className="ticket-id-tag"><code>{info.ticketId}</code></span>
          </div>

          <div className="cticket-event-info">
            <h3 className="pass-event-title">{info.eventName || 'AWS Cloud Architecture & High Concurrency Summit'}</h3>
            <p className="pass-meta-line">{info.eventDate || '28/11/2026 - 09:00 AM'} | {info.venue || 'Hội trường A1, ĐHQG Hà Nội'}</p>
          </div>

          <div className="cticket-body-grid">
            <div className="cticket-field">
              <span className="field-lbl">Họ tên người tham dự</span>
              <strong className="field-val">{info.attendeeName}</strong>
            </div>
            <div className="cticket-field">
              <span className="field-lbl">Hạng vé</span>
              <span className="field-val tier-highlight">{info.tierName || 'Early Bird Pass'}</span>
            </div>
            <div className="cticket-field">
              <span className="field-lbl">Email nhận vé</span>
              <span className="field-val">{info.attendeeEmail}</span>
            </div>
            <div className="cticket-field">
              <span className="field-lbl">Trạng thái phát hành</span>
              <span className="field-val status-green">Đã đưa vào AWS SQS Queue</span>
            </div>
          </div>

          <div className="cticket-qr-box">
            <svg className="qr-svg" viewBox="0 0 100 100" fill="currentColor">
              <path d="M10,10 h30 v30 h-30 z M15,15 v20 h20 v-20 z M20,20 h10 v10 h-10 z" />
              <path d="M60,10 h30 v30 h-30 z M65,15 v20 h20 v-20 z M70,20 h10 v10 h-10 z" />
              <path d="M10,60 h30 v30 h-30 z M15,65 v20 h20 v-20 z M20,70 h10 v10 h-10 z" />
              <rect x="50" y="50" width="8" height="8" />
              <rect x="65" y="50" width="8" height="8" />
              <rect x="80" y="50" width="8" height="8" />
              <rect x="50" y="65" width="8" height="8" />
              <rect x="65" y="80" width="8" height="8" />
              <rect x="80" y="65" width="8" height="8" />
              <rect x="50" y="80" width="8" height="8" />
            </svg>
            <div className="qr-caption">
              <strong>Mã vé QR điện tử dùng khi check-in cổng</strong>
              <small>Ảnh gốc chất lượng cao được lưu trữ an toàn trên Amazon S3</small>
            </div>
          </div>
        </div>

        <div className="modal-footer-dual">
          <button
            type="button"
            className="btn-primary-action"
            onClick={() => {
              onClose();
              onViewMyTickets();
            }}
          >
            Xem Trong Ví Vé Của Tôi
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuccessModal;
