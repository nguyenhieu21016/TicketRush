import React from 'react';
import type { ModalTicketInfo } from '../types';

interface MyTicketsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tickets: ModalTicketInfo[];
  onCancelTicket: (ticketId: string) => void;
}

const MyTicketsModal: React.FC<MyTicketsModalProps> = ({
  isOpen,
  onClose,
  tickets,
  onCancelTicket,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay active">
      <div className="modal-card my-tickets-card">
        <button type="button" className="modal-close" onClick={onClose}>
          &times;
        </button>

        <div className="modal-header">
          <div className="ticket-icon-badge">VÉ</div>
          <h2>Ví Vé Của Tôi ({tickets.length})</h2>
          <p>Danh sách vé điện tử đã đăng ký thành công trên TicketRush.</p>
        </div>

        {tickets.length === 0 ? (
          <div className="empty-tickets">
            <p>Bạn chưa có vé nào. Hãy chọn sự kiện và bấm "Mua vé ngay"!</p>
          </div>
        ) : (
          <div className="ticket-wallet-list">
            {tickets.map((t) => (
              <div key={t.ticketId} className="wallet-ticket-item">
                <div className="ticket-cutout left"></div>
                <div className="ticket-cutout right"></div>

                <div className="wallet-ticket-header">
                  <span className="badge-pass">{t.tierName || 'STANDARD PASS'}</span>
                  <span className="ticket-code"><code>{t.ticketId}</code></span>
                </div>

                <div className="wallet-ticket-body">
                  <div className="ticket-meta-grid">
                    <div>
                      <span className="meta-label">Người tham dự:</span>
                      <strong>{t.attendeeName}</strong>
                    </div>
                    <div>
                      <span className="meta-label">Email:</span>
                      <span>{t.attendeeEmail}</span>
                    </div>
                    <div>
                      <span className="meta-label">Sự kiện:</span>
                      <span>{t.eventName || 'AWS Cloud Summit 2026'}</span>
                    </div>
                    <div>
                      <span className="meta-label">Trạng thái:</span>
                      <span className={`status-pill ${t.status?.toLowerCase() || 'issued'}`}>
                        {t.status === 'CHECKED_IN' ? 'Đã Check-in' : t.status === 'REFUNDED' ? 'Đã Hủy/Hoàn vé' : 'Sẵn sàng sử dụng'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="wallet-ticket-actions">
                  {t.status !== 'REFUNDED' && (
                    <button
                      type="button"
                      className="btn-cancel-ticket"
                      onClick={() => onCancelTicket(t.ticketId)}
                    >
                      Hủy vé &amp; Nhả chỗ (US-14)
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default MyTicketsModal;
