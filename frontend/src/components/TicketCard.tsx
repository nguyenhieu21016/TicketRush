import { useState, useEffect, type FC, type ChangeEvent, type FormEvent } from 'react';
import type { TicketStatus, RegistrationPayload, ToastMessage, TicketTier } from '../types';

interface TicketCardProps {
  ticketsLeft: number;
  totalTickets: number;
  status: TicketStatus;
  isRushActive: boolean;
  isMockMode: boolean;
  apiBaseUrl: string;
  onTicketDecrement: () => void;
  onShowModal: (ticketId: string, name: string, email: string, tierName?: string) => void;
  onAddToast: (toast: Omit<ToastMessage, 'id'>) => void;
  onRefetchStatus: () => void;
  onOpenWaitlist: () => void;
}

interface FormErrors {
  name: string;
  email: string;
  phone: string;
}

const TIERS: TicketTier[] = [
  {
    id: 'early_bird',
    name: 'Early Bird Pass (Hội trường chính)',
    priceText: 'Miễn phí',
    priceValue: 0,
    description: 'Chỗ ngồi tiêu chuẩn, bao gồm tài liệu hội thảo và slide diễn giả.',
    availableCount: 250,
    maxPerOrder: 1,
    badge: 'PHỔ BIẾN',
  },
  {
    id: 'vip_access',
    name: 'VIP Front-Row Access',
    priceText: 'Miễn phí',
    priceValue: 0,
    description: 'Vị trí hàng đầu, check-in làn riêng (Priority Lane) và tiệc teabreak.',
    availableCount: 50,
    maxPerOrder: 1,
    badge: 'GIỚI HẠN',
  },
];

const TicketCard: FC<TicketCardProps> = ({
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
  onOpenWaitlist,
}) => {
  const [selectedTier, setSelectedTier] = useState<string>('early_bird');
  const [step, setStep] = useState<'tier_select' | 'holding_form'>('tier_select');
  const [holdSecondsLeft, setHoldSecondsLeft] = useState<number>(600); // 10 minutes hold per US-11
  const [isHoldingActive, setIsHoldingActive] = useState<boolean>(false);

  const [formData, setFormData] = useState<RegistrationPayload>({
    full_name: '',
    email: '',
    phone: '',
  });
  const [paymentMethod, setPaymentMethod] = useState<'qr_pay' | 'free'>('qr_pay');
  const [errors, setErrors] = useState<FormErrors>({ name: '', email: '', phone: '' });
  const [isLoading, setIsLoading] = useState(false);

  // 10-Minute Holding Countdown Timer (US-11)
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (isHoldingActive && holdSecondsLeft > 0) {
      timer = setInterval(() => {
        setHoldSecondsLeft((prev) => {
          if (prev <= 1) {
            setIsHoldingActive(false);
            setStep('tier_select');
            onAddToast({ message: 'Hết thời gian giữ chỗ (10 phút)! Chỗ đã được trả về hàng đợi.', type: 'error' });
            return 600;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isHoldingActive, holdSecondsLeft, onAddToast]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const percentage = Math.max(0, (ticketsLeft / totalTickets) * 100);

  const statusConfig = {
    open: { text: 'Đang mở bán', color: '#059669', bg: '#D1FAE5' },
    low: { text: 'SẮP HẾT VÉ', color: '#D97706', bg: '#FEF3C7' },
    soldout: { text: 'HẾT VÉ', color: '#DC2626', bg: '#FEE2E2' },
  };

  const currentStatus = statusConfig[status];
  const chosenTierObj = TIERS.find((t) => t.id === selectedTier) || TIERS[0];

  const handleStartHold = () => {
    if (ticketsLeft <= 0) {
      onOpenWaitlist();
      return;
    }
    setIsHoldingActive(true);
    setHoldSecondsLeft(600);
    setStep('holding_form');
    onAddToast({ message: 'Đã giữ chỗ trong 10:00! Vui lòng hoàn tất đăng ký.', type: 'info' });
  };

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

  const handleInputChange = (field: keyof RegistrationPayload) => (e: ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    setErrors((prev) => ({ ...prev, [field === 'full_name' ? 'name' : field]: '' }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!isRushActive && ticketsLeft <= 0) {
      onAddToast({ message: 'Sự kiện đã hết vé! Vui lòng tham gia danh sách chờ.', type: 'error' });
      return;
    }

    if (!validateForm()) return;

    setIsLoading(true);

    const payload: RegistrationPayload = {
      full_name: formData.full_name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      ticket_tier: chosenTierObj.name,
      event_id: 1,
    };

    try {
      if (isMockMode) {
        await new Promise((r) => setTimeout(r, 600));
        if (ticketsLeft <= 0) {
          throw new Error('Hết vé');
        }
        onTicketDecrement();
        const mockTicketId = 'TR-' + Math.floor(10000000 + Math.random() * 90000000);
        onShowModal(mockTicketId, payload.full_name, payload.email, chosenTierObj.name);
        setIsHoldingActive(false);
        setStep('tier_select');
        setFormData({ full_name: '', email: '', phone: '' });
      } else {
        const res = await fetch(`${apiBaseUrl}/api/tickets/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.detail || data.message || 'Đăng ký thất bại hoặc hết vé!');
        }

        const ticketId = data.ticket_id || data.ticketId || 'TR-SUCCESS';
        onShowModal(ticketId, payload.full_name, payload.email, chosenTierObj.name);
        onAddToast({ message: 'Đăng ký thành công! Vé QR sẽ gửi qua email của bạn.', type: 'success' });
        setIsHoldingActive(false);
        setStep('tier_select');
        setFormData({ full_name: '', email: '', phone: '' });
        onRefetchStatus();
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Đã có lỗi xảy ra. Vui lòng thử lại!';
      onAddToast({ message: errorMessage, type: 'error' });
      onRefetchStatus();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ct-booking-card">
      
      {/* Live Redis Counter Header */}
      <div className="ct-counter-header">
        <div className="ct-counter-title">
          <span>🔥 Số vé thời gian thực (Redis)</span>
        </div>
        <div className="ct-live-pill">
          <span>●</span> LIVE
        </div>
      </div>

      <div className="ct-counter-stats">
        <div className="ct-ticket-number">
          <span>{ticketsLeft}</span>
          <span className="ct-ticket-total">/ {totalTickets} vé</span>
        </div>
        <div className="ct-status-badge" style={{ color: currentStatus.color, background: currentStatus.bg }}>
          {currentStatus.text}
        </div>
      </div>

      {/* Progress Track */}
      <div className="ct-progress-track">
        <div
          className="ct-progress-fill"
          style={{
            width: `${percentage}%`,
            background: ticketsLeft <= 0 ? '#EF4444' : 'linear-gradient(90deg, #0284C7 0%, #E91E63 100%)',
          }}
        />
      </div>
      <p className="ct-counter-note">⚡ Giới hạn đúng 300 vé. Hệ thống tự động chặn oversell.</p>

      {/* STEP 1: CHỌN HẠNG VÉ */}
      {step === 'tier_select' ? (
        <div className="ct-tier-box">
          <h4 style={{ fontSize: '0.92rem', marginBottom: '12px', color: '#0F172A' }}>
            1. Chọn hạng vé (Tối đa 1 vé/người):
          </h4>

          {TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`ct-tier-item ${selectedTier === tier.id ? 'active' : ''}`}
              onClick={() => setSelectedTier(tier.id)}
            >
              <div className="ct-tier-header">
                <span className="ct-tier-name">{tier.name}</span>
                <span className="ct-tier-price">{tier.priceText}</span>
              </div>
              <p className="ct-tier-desc">{tier.description}</p>
            </div>
          ))}

          {ticketsLeft > 0 ? (
            <button
              type="button"
              className="ct-btn-primary"
              onClick={handleStartHold}
            >
              <span>⚡ MUA VÉ NGAY &amp; GIỮ CHỖ (10:00)</span>
            </button>
          ) : (
            <button
              type="button"
              className="ct-btn-primary ct-btn-waitlist"
              onClick={onOpenWaitlist}
            >
              <span>⏳ HẾT VÉ • THAM GIA DANH SÁCH CHỜ</span>
            </button>
          )}
        </div>
      ) : (
        /* STEP 2: HOLDING TIMER & CHECKOUT FORM */
        <div className="ct-checkout-box">
          {/* 10-Minute Hold Alert Banner */}
          <div className="ct-hold-timer-banner">
            <span className="ct-hold-icon">⏱️</span>
            <div className="ct-hold-text">
              <div className="ct-hold-title">
                Đang giữ chỗ trong: <span className="ct-hold-clock">{formatTimer(holdSecondsLeft)}</span>
              </div>
              <div className="ct-hold-sub">Vui lòng điền thông tin để phát hành vé QR.</div>
            </div>
            <button
              type="button"
              className="ct-btn-change-tier"
              onClick={() => {
                setIsHoldingActive(false);
                setStep('tier_select');
              }}
            >
              Đổi hạng vé
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="ct-form-group">
              <label className="ct-label">Họ và tên người nhận vé *</label>
              <input
                type="text"
                className="ct-input"
                placeholder="Ví dụ: Nguyễn Văn A"
                value={formData.full_name}
                onChange={handleInputChange('full_name')}
              />
              {errors.name && <small style={{ color: '#E11D48' }}>{errors.name}</small>}
            </div>

            <div className="ct-form-group">
              <label className="ct-label">Email nhận vé QR *</label>
              <input
                type="email"
                className="ct-input"
                placeholder="example@gmail.com"
                value={formData.email}
                onChange={handleInputChange('email')}
              />
              {errors.email && <small style={{ color: '#E11D48' }}>{errors.email}</small>}
            </div>

            <div className="ct-form-group">
              <label className="ct-label">Số điện thoại *</label>
              <input
                type="tel"
                className="ct-input"
                placeholder="0987654321"
                value={formData.phone}
                onChange={handleInputChange('phone')}
              />
              {errors.phone && <small style={{ color: '#E11D48' }}>{errors.phone}</small>}
            </div>

            {/* Payment Method */}
            <div className="ct-form-group">
              <label className="ct-label">Phương thức thanh toán / xác nhận:</label>
              <div className="ct-payment-method">
                <div
                  className={`ct-pay-option ${paymentMethod === 'qr_pay' ? 'active' : ''}`}
                  onClick={() => setPaymentMethod('qr_pay')}
                >
                  📱 Quét mã VNPAY / Momo
                </div>
                <div
                  className={`ct-pay-option ${paymentMethod === 'free' ? 'active' : ''}`}
                  onClick={() => setPaymentMethod('free')}
                >
                  🎟️ Vé mời 0đ (Xác nhận ngay)
                </div>
              </div>
            </div>

            <button type="submit" className="ct-btn-primary" disabled={isLoading} style={{ marginTop: '16px' }}>
              {isLoading ? 'Đang xử lý đặt vé...' : 'XÁC NHẬN ĐẶT VÉ & NHẬN MÃ QR'}
            </button>
          </form>
        </div>
      )}

    </div>
  );
};

export default TicketCard;
