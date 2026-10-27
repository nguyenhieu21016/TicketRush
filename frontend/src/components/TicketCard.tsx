import React, { useState } from 'react';
import type { TicketStatus, RegistrationPayload, ToastMessage } from '../types';

interface TicketCardProps {
  ticketsLeft: number;
  totalTickets: number;
  status: TicketStatus;
  isRushActive: boolean;
  isMockMode: boolean;
  apiBaseUrl: string;
  onTicketDecrement: () => void;
  onShowModal: (ticketId: string, name: string, email: string) => void;
  onAddToast: (toast: Omit<ToastMessage, 'id'>) => void;
  onRefetchStatus: () => void;
}

interface FormErrors {
  name: string;
  email: string;
  phone: string;
}

const TicketCard: React.FC<TicketCardProps> = ({
  ticketsLeft,
  totalTickets,
  status,
  isRushActive,
  isMockMode,
  apiBaseUrl,
  onTicketDecrement,
  onShowModal,
  onAddToast,
  onRefetchStatus,
}) => {
  const [formData, setFormData] = useState<RegistrationPayload>({
    full_name: '',
    email: '',
    phone: '',
  });
  const [errors, setErrors] = useState<FormErrors>({ name: '', email: '', phone: '' });
  const [isLoading, setIsLoading] = useState(false);

  const percentage = Math.max(0, (ticketsLeft / totalTickets) * 100);

  const statusConfig = {
    open: { text: 'Đang mở đăng ký', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' },
    low: { text: 'SẮP HẾT VÉ', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' },
    soldout: { text: 'ĐÃ HẾT VÉ', color: '#F43F5E', bg: 'rgba(244, 63, 94, 0.15)' },
  };

  const currentStatus = statusConfig[status];

  const validateForm = (): boolean => {
    let isValid = true;
    const newErrors: FormErrors = { name: '', email: '', phone: '' };

    if (!formData.full_name.trim() || formData.full_name.trim().length < 2) {
      newErrors.name = 'Vui lòng nhập họ và tên hợp lệ';
      isValid = false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim() || !emailRegex.test(formData.email.trim())) {
      newErrors.email = 'Vui lòng nhập địa chỉ email hợp lệ';
      isValid = false;
    }

    const phoneRegex = /^[0-9]{9,11}$/;
    if (!formData.phone.trim() || !phoneRegex.test(formData.phone.trim().replace(/\D/g, ''))) {
      newErrors.phone = 'Vui lòng nhập số điện thoại hợp lệ (10 số)';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleInputChange = (field: keyof RegistrationPayload) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
    setErrors(prev => ({ ...prev, [field === 'full_name' ? 'name' : field]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isRushActive) {
      onAddToast({ message: 'Sự kiện đã hết vé! Vui lòng quay lại đợt sau.', type: 'error' });
      return;
    }

    if (!validateForm()) return;

    setIsLoading(true);

    const payload: RegistrationPayload = {
      full_name: formData.full_name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
    };

    try {
      if (isMockMode) {
        // Standalone mock simulation
        await new Promise(r => setTimeout(r, 700));
        if (ticketsLeft <= 0) throw new Error('Hết vé');
        onTicketDecrement();
        const mockTicketId = 'TR-' + Math.floor(10000 + Math.random() * 90000);
        onShowModal(mockTicketId, payload.full_name, payload.email);
        setFormData({ full_name: '', email: '', phone: '' });
      } else {
        // Real API call
        const res = await fetch(`${apiBaseUrl}/api/tickets/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.detail || data.message || 'Đăng ký thất bại hoặc hết vé!');
        }

        onShowModal(data.ticket_id || data.ticketId || 'TR-SUCCESS', payload.full_name, payload.email);
        onAddToast({ message: 'Đăng ký thành công! Vé QR sẽ sớm được gửi qua email.', type: 'success' });
        setFormData({ full_name: '', email: '', phone: '' });
        onRefetchStatus();
      }
    } catch (err) {
      onAddToast({
        message: err instanceof Error ? err.message : 'Đã có lỗi xảy ra. Vui lòng thử lại!',
        type: 'error',
      });
      onRefetchStatus();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="ticket-card-wrapper">
      <div className="ticket-card">
        {/* Counter Header */}
        <div className="counter-header">
          <div className="counter-label">
            <span className="fire-icon">🔥</span>
            <span>Số vé còn lại theo thời gian thực (Redis)</span>
          </div>
          <div className="live-tag">
            <span className="dot"></span> LIVE
          </div>
        </div>

        {/* Counter Stats */}
        <div className="counter-stats">
          <div className="counter-number">
            <span id="ticketsLeft">{ticketsLeft}</span>
            <span className="counter-total">/ {totalTickets} vé</span>
          </div>
          <div
            className={`counter-status-pill${status === 'soldout' ? ' soldout' : ''}`}
            style={{ color: currentStatus.color, background: currentStatus.bg }}
            id="counterStatusPill"
          >
            {currentStatus.text}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="progress-bar-container">
          <div
            className="progress-bar-fill"
            id="progressBarFill"
            style={{
              width: `${percentage}%`,
              background: status === 'soldout'
                ? '#F43F5E'
                : 'linear-gradient(90deg, #06B6D4 0%, #6366F1 50%, #EC4899 100%)',
            }}
          />
        </div>
        <p className="counter-hint">⚡ Hệ thống tự động khóa cổng ngay khi chạm mốc 300 vé để chống oversell.</p>

        <hr className="card-divider" />

        {/* Registration Form */}
        <form id="registrationForm" className="registration-form" noValidate onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="fullName">
              Họ và tên người tham dự <span className="required">*</span>
            </label>
            <div className="input-wrapper">
              <span className="input-icon">👤</span>
              <input
                type="text"
                id="fullName"
                name="fullName"
                placeholder="Ví dụ: Nguyễn Văn A"
                value={formData.full_name}
                onChange={handleInputChange('full_name')}
                required
              />
            </div>
            <span className="field-error" id="nameError">{errors.name}</span>
          </div>

          <div className="form-group">
            <label htmlFor="email">
              Địa chỉ Email nhận vé QR <span className="required">*</span>
            </label>
            <div className="input-wrapper">
              <span className="input-icon">✉️</span>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="example@gmail.com"
                value={formData.email}
                onChange={handleInputChange('email')}
                required
              />
            </div>
            <span className="field-error" id="emailError">{errors.email}</span>
            <span className="field-helper">Mã QR vé sẽ được Lambda xử lý và gửi tự động qua AWS SES vào hòm thư này.</span>
          </div>

          <div className="form-group">
            <label htmlFor="phone">
              Số điện thoại <span className="required">*</span>
            </label>
            <div className="input-wrapper">
              <span className="input-icon">📱</span>
              <input
                type="tel"
                id="phone"
                name="phone"
                placeholder="0987654321"
                value={formData.phone}
                onChange={handleInputChange('phone')}
                required
              />
            </div>
            <span className="field-error" id="phoneError">{errors.phone}</span>
          </div>

          <button
            type="submit"
            id="submitBtn"
            className="btn-rush"
            disabled={isLoading || !isRushActive}
          >
            {isLoading ? (
              <span className="btn-loader" style={{ display: 'inline-block' }}></span>
            ) : (
              <span className="btn-text">
                {isRushActive ? '⚡ SĂN VÉ NGAY' : '❌ HẾT VÉ TRONG ĐỢT NÀY'}
              </span>
            )}
          </button>
          <p className="guarantee-text">🔒 Bảo vệ chống trùng lặp bằng Redis Atomic Counter &amp; RDS Multi-AZ</p>
        </form>
      </div>
    </section>
  );
};

export default TicketCard;
