import React, { useEffect } from 'react';
import type { ModalTicketInfo } from '../types';

interface SuccessModalProps {
  info: ModalTicketInfo | null;
  onClose: () => void;
}

const SuccessModal: React.FC<SuccessModalProps> = ({ info, onClose }) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (info) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [info, onClose]);

  if (!info) return null;

  return (
    <div
      className={`modal-overlay${info ? ' active' : ''}`}
      id="successModal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card">
        <button className="modal-close" id="closeModalBtn" onClick={onClose}>
          &times;
        </button>

        <div className="modal-header">
          <div className="success-icon-badge">✓</div>
          <h2>Đăng Ký Thành Công!</h2>
          <p>Hệ thống đã ghi nhận vị trí của bạn trong đợt Rush.</p>
        </div>

        <div className="ticket-preview">
          <div className="ticket-header">
            <span className="ticket-brand">TICKETRUSH PASS</span>
            <span className="ticket-id" id="modalTicketId">{info.ticketId}</span>
          </div>
          <div className="ticket-body">
            <div className="ticket-info">
              <p className="ticket-label">Người tham dự</p>
              <p className="ticket-value" id="modalAttendeeName">{info.attendeeName}</p>
            </div>
            <div className="ticket-info">
              <p className="ticket-label">Email</p>
              <p className="ticket-value" id="modalAttendeeEmail">{info.attendeeEmail}</p>
            </div>
            <div className="ticket-info">
              <p className="ticket-label">Trạng thái phát vé</p>
              <p className="ticket-value status-ready">Đã đưa vào SQS Queue</p>
            </div>
          </div>
          <div className="ticket-qr-container">
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
            <span className="qr-label">QR Token sẽ gửi về email qua SES</span>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" id="confirmModalBtn" onClick={onClose}>
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuccessModal;
