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
      onAddToast({ message: `❌ Vé ${idToVerify} không tồn tại trên hệ thống RDS!`, type: 'error' });
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
      onAddToast({ message: `⚠️ CẢNH BÁO: Vé ${idToVerify} đã được check-in trước đó! Không cho phép vào lần 2.`, type: 'warning' });
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
    onAddToast({ message: `✅ Check-in thành công: ${existingTicket.attendeeName} (${idToVerify})`, type: 'success' });
    setInputTicketId('');
  };

  return (
    <div className="organizer-panel">
      <div className="panel-header">
        <div className="panel-title-group">
          <span className="panel-badge">STAFF SCANNER (US-19)</span>
          <h2>Cổng Soát Vé Sự Kiện &amp; Check-in 1 Lần</h2>
        </div>
        <p className="panel-desc">
          Mô phỏng máy quét mã QR tại cổng hội trường. Hệ thống chỉ cho phép check-in đúng 1 lần duy nhất để chống gian lận dùng lại vé.
        </p>
      </div>

      <div className="scanner-box">
        <form onSubmit={handleCheckIn} className="scanner-form">
          <div className="input-group-scanner">
            <span className="scanner-icon">📷</span>
            <input
              type="text"
              placeholder="Nhập hoặc quét mã vé (Ví dụ: TR-12345678)..."
              value={inputTicketId}
              onChange={(e) => setInputTicketId(e.target.value)}
              className="scanner-input"
            />
            <button type="submit" className="btn-scanner-submit">
              Xác Nhận Check-in
            </button>
          </div>
        </form>

        {/* Quick Sample Tickets from local storage */}
        {ticketsList.length > 0 && (
          <div className="quick-tickets">
            <span className="quick-title">Bấm nhanh vé vừa mua để quét thử:</span>
            <div className="quick-chips">
              {ticketsList.map(t => (
                <button
                  key={t.ticketId}
                  type="button"
                  className={`quick-chip ${t.status === 'CHECKED_IN' ? 'used' : ''}`}
                  onClick={() => setInputTicketId(t.ticketId)}
                >
                  {t.ticketId} ({t.attendeeName}) {t.status === 'CHECKED_IN' ? '✓ Đã vào' : '⏳ Chưa vào'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Audit Logs Table */}
      <div className="logs-section">
        <h3>Nhật ký soát vé tại cổng (Audit Log)</h3>
        {logs.length === 0 ? (
          <p className="no-logs">Chưa có lượt quét nào. Hãy nhập mã vé ở trên để kiểm tra.</p>
        ) : (
          <div className="logs-table-wrapper">
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Mã vé</th>
                  <th>Khách tham dự</th>
                  <th>Kết quả soát vé</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => (
                  <tr key={idx} className={`log-row ${log.status.toLowerCase()}`}>
                    <td>{log.timestamp}</td>
                    <td><code>{log.ticketId}</code></td>
                    <td>{log.attendeeName} ({log.attendeeEmail})</td>
                    <td>
                      {log.status === 'SUCCESS' && <span className="status-badge valid">✅ HỢP LỆ (CHO QUA)</span>}
                      {log.status === 'ALREADY_CHECKED_IN' && <span className="status-badge duplicate">⚠️ ĐÃ CHECK-IN TRƯỚC ĐÓ</span>}
                      {log.status === 'NOT_FOUND' && <span className="status-badge invalid">❌ VÉ KHÔNG TỒN TẠI</span>}
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
