import React, { useState } from 'react';
import type { CheckInLog, ModalTicketInfo } from '../types';

interface OrganizerCheckInProps {
  ticketsList: ModalTicketInfo[];
  onCheckInSuccess: (ticketId: string) => void;
  onAddToast: (toast: { message: string; type: 'success' | 'error' | 'info' | 'warning' }) => void;
}

const OrganizerCheckIn: React.FC<OrganizerCheckInProps> = ({
  ticketsList,
  onCheckInSuccess,
  onAddToast,
}) => {
  const [inputTicketId, setInputTicketId] = useState('');
  const [logs, setLogs] = useState<CheckInLog[]>([]);

  const handleCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    const idToVerify = inputTicketId.trim().toUpperCase();
    if (!idToVerify) return;

    const existingTicket = ticketsList.find(t => t.ticketId.toUpperCase() === idToVerify);

    const now = new Date().toLocaleTimeString('vi-VN');

    if (!existingTicket) {
      const newLog: CheckInLog = {
        ticketId: idToVerify,
        attendeeName: 'Không xác định',
        attendeeEmail: 'Không tồn tại trên hệ thống',
        status: 'NOT_FOUND',
        timestamp: now,
      };
      setLogs(prev => [newLog, ...prev]);
      onAddToast({ message: `Vé ${idToVerify} không tồn tại trên hệ thống RDS!`, type: 'error' });
      setInputTicketId('');
      return;
    }

    if (existingTicket.status === 'CHECKED_IN') {
      const newLog: CheckInLog = {
        ticketId: idToVerify,
        attendeeName: existingTicket.attendeeName,
        attendeeEmail: existingTicket.attendeeEmail,
        status: 'ALREADY_CHECKED_IN',
        timestamp: now,
      };
      setLogs(prev => [newLog, ...prev]);
      onAddToast({ message: `CẢNH BÁO: Vé ${idToVerify} đã được check-in trước đó! Không cho phép vào lần 2.`, type: 'warning' });
      setInputTicketId('');
      return;
    }

    // Check-in success (1 lần duy nhất theo US-19)
    onCheckInSuccess(existingTicket.ticketId);
    const newLog: CheckInLog = {
      ticketId: idToVerify,
      attendeeName: existingTicket.attendeeName,
      attendeeEmail: existingTicket.attendeeEmail,
      status: 'SUCCESS',
      timestamp: now,
    };
    setLogs(prev => [newLog, ...prev]);
    onAddToast({ message: `XÁC NHẬN: Check-in vé ${idToVerify} thành công! Cho phép người tham dự vào cổng.`, type: 'success' });
    setInputTicketId('');
  };

  return (
    <div className="organizer-checkin-container">
      <div className="checkin-header">
        <div className="badge-role">CỔNG SOÁT VÉ BAN TỔ CHỨC</div>
        <h2>Hệ Thống Kiểm Soát Vé Vào Cổng (US-19)</h2>
        <p>
          Quét hoặc nhập mã vé điện tử QR Code để xác thực người tham dự. Hệ thống kiểm tra đối soát trực tiếp với cơ sở dữ liệu RDS MySQL và ngăn chặn vé sử dụng lại nhiều lần.
        </p>
      </div>

      <div className="checkin-scanner-box">
        <form onSubmit={handleCheckIn} className="scanner-form">
          <label htmlFor="ticket-input">Nhập mã vé (VD: TR-100234 hoặc quét barcode/QR)</label>
          <div className="scanner-input-row">
            <input
              id="ticket-input"
              type="text"
              placeholder="Quét mã QR hoặc gõ mã vé..."
              value={inputTicketId}
              onChange={(e) => setInputTicketId(e.target.value)}
              className="scanner-input"
              autoFocus
            />
            <button type="submit" className="btn-scanner-submit">
              XÁC THỰC VÉ
            </button>
          </div>
        </form>

        <div className="scanner-stats">
          <div className="stat-box">
            <span className="stat-label">Tổng vé phát hành</span>
            <span className="stat-value">{ticketsList.length}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Đã qua cổng</span>
            <span className="stat-value text-green">
              {ticketsList.filter(t => t.status === 'CHECKED_IN').length}
            </span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Chưa check-in</span>
            <span className="stat-value text-blue">
              {ticketsList.filter(t => t.status === 'ISSUED').length}
            </span>
          </div>
        </div>
      </div>

      <div className="checkin-logs-section">
        <h3>Nhật Ký Quét Vé Vào Cổng (Audit Log)</h3>
        {logs.length === 0 ? (
          <div className="empty-logs">
            Chưa có lượt quét nào. Hãy nhập mã vé để bắt đầu soát vé.
          </div>
        ) : (
          <div className="logs-table-wrapper">
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Mã Vé</th>
                  <th>Khách tham dự</th>
                  <th>Email</th>
                  <th>Kết quả đối soát</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => (
                  <tr key={idx} className={`log-row-${log.status.toLowerCase()}`}>
                    <td>{log.timestamp}</td>
                    <td><code>{log.ticketId}</code></td>
                    <td>{log.attendeeName}</td>
                    <td>{log.attendeeEmail}</td>
                    <td>
                      {log.status === 'SUCCESS' && (
                        <span className="badge-status-success">HỢP LỆ (VÀO CỔNG)</span>
                      )}
                      {log.status === 'ALREADY_CHECKED_IN' && (
                        <span className="badge-status-danger">VÉ ĐÃ DÙNG RỒI</span>
                      )}
                      {log.status === 'NOT_FOUND' && (
                        <span className="badge-status-warning">VÉ KHÔNG HỢP LỆ</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizerCheckIn;
