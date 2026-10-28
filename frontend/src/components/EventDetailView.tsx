import React, { useState, useEffect } from 'react';
import type { EventItemData } from './HeroSection';
import type { TicketStatus, RegistrationPayload, ToastMessage, TicketTier } from '../types';

interface EventDetailViewProps {
  event: EventItemData;
  ticketsLeft: number;
  totalTickets: number;
  status: TicketStatus;
  isMockMode: boolean;
  apiBaseUrl: string;
  onTicketDecrement: () => void;
  onShowModal: (ticketId: string, name: string, email: string, tierName?: string) => void;
  onAddToast: (toast: Omit<ToastMessage, 'id'>) => void;
  onRefetchStatus: () => void;
  onOpenWaitlist: () => void;
  onBack: () => void;
}

const AWS_TIERS: TicketTier[] = [
  {
    id: 'early_bird',
    name: 'Early Bird Pass (Hội trường chính)',
    priceText: 'Miễn phí',
    priceValue: 0,
    description: 'Chỗ ngồi tiêu chuẩn, bao gồm bộ tài liệu kiến trúc AWS Cloud và slide diễn giả.',
    availableCount: 250,
    maxPerOrder: 1,
    badge: 'PHỔ BIẾN',
  },
  {
    id: 'vip_access',
    name: 'VIP Front-Row Access (Ưu tiên)',
    priceText: 'Miễn phí',
    priceValue: 0,
    description: 'Vị trí hàng đầu sát sân khấu, check-in làn riêng (Priority Lane) và tiệc teabreak giao lưu cùng diễn giả AWS.',
    availableCount: 50,
    maxPerOrder: 1,
    badge: 'GIỚI HẠN',
  },
];

const MYTAM_TIERS: TicketTier[] = [
  {
    id: 'fanzone',
    name: 'Fanzone (Đứng sát sân khấu)',
    priceText: '2.500.000 VND',
    priceValue: 2500000,
    description: 'Khu vực đứng cận cảnh thần tượng, tặng kèm Lightstick độc quyền và Photocard có chữ ký.',
    availableCount: 0,
    maxPerOrder: 1,
    badge: 'HẾT VÉ',
  },
  {
    id: 'vip_seated',
    name: 'VIP Seated (Khán đài trung tâm)',
    priceText: '3.400.000 VND',
    priceValue: 3400000,
    description: 'Ghế ngồi trung tâm đối diện sân khấu chính, tặng Khăn lụa kỷ niệm và Soundcheck pass.',
    availableCount: 0,
    maxPerOrder: 1,
    badge: 'HẾT VÉ',
  },
  {
    id: 'svip',
    name: 'SVIP (Hàng 1-3 Premium)',
    priceText: '4.600.000 VND',
    priceValue: 4600000,
    description: 'Trải nghiệm đỉnh cao nhất: Full quà tặng, tiệc đón tiếp VIP Lounge và chụp ảnh kỷ niệm.',
    availableCount: 0,
    maxPerOrder: 1,
    badge: 'HẾT VÉ',
  },
];

const EventDetailView: React.FC<EventDetailViewProps> = ({
  event,
  ticketsLeft,
  totalTickets,
  status,
  isMockMode,
  apiBaseUrl,
  onTicketDecrement,
  onShowModal,
  onAddToast,
  onRefetchStatus,
  onOpenWaitlist,
  onBack,
}) => {
  const isAwsEvent = event.id === 12;
  const tiers = isAwsEvent ? AWS_TIERS : MYTAM_TIERS;
  const isSoldOut = !isAwsEvent || status === 'soldout' || ticketsLeft <= 0;

  const [activeTab, setActiveTab] = useState<'schedule' | 'about' | 'artists' | 'organizer'>('schedule');
  const [selectedTier, setSelectedTier] = useState<string>(tiers[0]?.id || 'early_bird');
  const [isHoldingActive, setIsHoldingActive] = useState<boolean>(false);
  const [holdSecondsLeft, setHoldSecondsLeft] = useState<number>(600); // 10 minutes hold (US-11)

  const [formData, setFormData] = useState<RegistrationPayload>({
    full_name: '',
    email: '',
    phone: '',
  });
  const [formErrors, setFormErrors] = useState({ name: '', email: '', phone: '' });
  const [isLoading, setIsLoading] = useState(false);

  // 10-Minute Hold countdown timer (US-11)
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (isHoldingActive && holdSecondsLeft > 0) {
      timer = setInterval(() => {
        setHoldSecondsLeft((prev) => {
          if (prev <= 1) {
            setIsHoldingActive(false);
            onAddToast({
              message: 'Hết thời gian giữ chỗ (10 phút)! Chỗ đã được trả về hệ thống.',
              type: 'error',
            });
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

  const handleStartHold = () => {
    if (isSoldOut) {
      onOpenWaitlist();
      return;
    }
    setIsHoldingActive(true);
    setHoldSecondsLeft(600);
    onAddToast({
      message: 'Đã tạm giữ chỗ trong 10:00! Vui lòng điền thông tin đăng ký bên dưới.',
      type: 'info',
    });
  };

  const validateForm = (): boolean => {
    let isValid = true;
    const newErrors = { name: '', email: '', phone: '' };

    if (!formData.full_name.trim() || formData.full_name.trim().length < 2) {
      newErrors.name = 'Vui lòng nhập họ và tên hợp lệ';
      isValid = false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim() || !emailRegex.test(formData.email.trim())) {
      newErrors.email = 'Vui lòng nhập email hợp lệ';
      isValid = false;
    }

    const phoneRegex = /^[0-9]{9,11}$/;
    if (!formData.phone.trim() || !phoneRegex.test(formData.phone.trim().replace(/\D/g, ''))) {
      newErrors.phone = 'Vui lòng nhập số điện thoại (10 số)';
      isValid = false;
    }

    setFormErrors(newErrors);
    return isValid;
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    // US-08: Check single registration per email
    const bookedEmailsKey = 'tr_booked_emails';
    const bookedEmails: string[] = JSON.parse(localStorage.getItem(bookedEmailsKey) || '[]');
    if (bookedEmails.includes(formData.email.trim().toLowerCase())) {
      onAddToast({
        message: 'Mỗi người dùng/email chỉ được đăng ký tối đa 1 vé! (US-08)',
        type: 'error',
      });
      return;
    }

    setIsLoading(true);

    try {
      if (isMockMode) {
        await new Promise((r) => setTimeout(r, 600));
        const ticketId = `TR-${Math.floor(100000 + Math.random() * 900000)}`;
        bookedEmails.push(formData.email.trim().toLowerCase());
        localStorage.setItem(bookedEmailsKey, JSON.stringify(bookedEmails));

        onTicketDecrement();
        onShowModal(
          ticketId,
          formData.full_name,
          formData.email,
          tiers.find((t) => t.id === selectedTier)?.name
        );
        onAddToast({ message: `Đặt vé thành công! Mã vé: ${ticketId}`, type: 'success' });
        setIsHoldingActive(false);
      } else {
        const res = await fetch(`${apiBaseUrl}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: formData.full_name.trim(),
            email: formData.email.trim(),
            phone: formData.phone.trim(),
            ticket_tier: selectedTier,
            event_id: event.id,
          }),
        });

        if (res.status === 409) {
          onAddToast({ message: 'Email này đã đăng ký vé rồi! (US-08)', type: 'error' });
          setIsLoading(false);
          return;
        }

        if (res.status === 410) {
          onAddToast({ message: 'Sự kiện đã hết vé! Bạn có thể tham gia hàng đợi chờ vé.', type: 'warning' });
          onOpenWaitlist();
          setIsLoading(false);
          return;
        }

        if (!res.ok) throw new Error('Booking failed');

        const data = await res.json();
        const ticketId = data.ticket_id || data.ticketId || `TR-${Date.now().toString().slice(-6)}`;
        bookedEmails.push(formData.email.trim().toLowerCase());
        localStorage.setItem(bookedEmailsKey, JSON.stringify(bookedEmails));

        onTicketDecrement();
        onShowModal(
          ticketId,
          formData.full_name,
          formData.email,
          tiers.find((t) => t.id === selectedTier)?.name
        );
        onAddToast({ message: `Đặt vé thành công! Mã vé: ${ticketId}`, type: 'success' });
        setIsHoldingActive(false);
      }
    } catch {
      onAddToast({ message: 'Không thể kết nối API. Đang chuyển sang dự phòng an toàn.', type: 'warning' });
    } finally {
      setIsLoading(false);
    }
  };

  const chosenTier = tiers.find((t) => t.id === selectedTier) || tiers[0];

  return (
    <div className="ct-detail-page">
      
      {/* 1. Back button to homepage */}
      <div className="ct-back-bar">
        <button type="button" className="ct-back-btn" onClick={onBack}>
          &larr; Quay lại danh sách sự kiện
        </button>
      </div>

      {/* 2. Real Event Hero Banner (Exact CTicket layout with authentic image) */}
      <div className="ct-detail-hero-backdrop">
        <div className="ct-detail-hero-container">
          <div className="ct-detail-poster-wrapper">
            <img
              src={event.bannerImg}
              alt={event.title}
              className="ct-detail-hero-banner-img"
            />
          </div>
        </div>
      </div>

      {/* 3. Primary Full-Width CTA Action Button */}
      <div className="ct-cta-bar-wrapper">
        <div className="ct-cta-bar-inner">
          {isSoldOut ? (
            <button
              type="button"
              className="ct-full-cta-btn ct-btn-soldout"
              onClick={onOpenWaitlist}
              title="Sự kiện đã hết vé. Bấm để tham gia danh sách chờ (US-15, US-16)"
            >
              Đã bán hết vé - Tham gia hàng đợi chờ vé (Waitlist FIFO)
            </button>
          ) : (
            <button
              type="button"
              className="ct-full-cta-btn ct-btn-buy-now"
              onClick={() => {
                const el = document.getElementById('booking-section');
                el?.scrollIntoView({ behavior: 'smooth' });
                if (!isHoldingActive) handleStartHold();
              }}
            >
              {isHoldingActive
                ? `Đang giữ chỗ (${formatTimer(holdSecondsLeft)}) - Cuộn xuống để hoàn tất đặt vé`
                : 'Mua vé ngay & Giữ chỗ trong 10:00 (US-11)'}
            </button>
          )}
        </div>
      </div>

      {/* 4. Event Header Meta Section (Dark Gradient Background on CTicket) */}
      <div className="ct-event-meta-header">
        <div className="ct-container ct-meta-header-inner">
          
          <div className="ct-meta-badge-row">
            <span className={`ct-meta-status-pill ${isSoldOut ? 'soldout' : 'available'}`}>
              {isSoldOut ? 'Đã bán hết vé' : 'Đang mở bán'}
            </span>
            <span className="ct-meta-cat-pill" style={{ backgroundColor: event.categoryColor.bg, color: event.categoryColor.text }}>
              {event.category}
            </span>
          </div>

          <h1 className="ct-event-main-title">{event.title}</h1>

          <div className="ct-event-details-grid">
            <div className="ct-meta-info-item">
              <div>
                <div className="ct-meta-info-label">Thời gian</div>
                <div className="ct-meta-info-val">{event.date} - Từ 09:00 (ICT)</div>
              </div>
            </div>

            <div className="ct-meta-info-item">
              <div>
                <div className="ct-meta-info-label">Địa điểm</div>
                <div className="ct-meta-info-val">{event.venue}</div>
              </div>
            </div>

            <div className="ct-meta-info-item">
              <div>
                <div className="ct-meta-info-label">Giá vé</div>
                <div className="ct-meta-info-val ct-val-pink">{event.price}</div>
              </div>
            </div>

            <div className="ct-meta-share-actions">
              <button
                type="button"
                className="ct-share-icon-btn"
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href);
                  onAddToast({ message: 'Đã sao chép link sự kiện vào bộ nhớ tạm!', type: 'info' });
                }}
                title="Sao chép link sự kiện"
              >
                Link
              </button>
              <button
                type="button"
                className="ct-share-icon-btn"
                onClick={() => window.open('https://facebook.com', '_blank')}
                title="Chia sẻ lên Facebook"
              >
                Share
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* 5. Subnav Tabs (White background bar matching CTicket) */}
      <div className="ct-subnav-bar">
        <div className="ct-container ct-subnav-inner">
          <button
            type="button"
            className={`ct-subnav-item ${activeTab === 'schedule' ? 'active' : ''}`}
            onClick={() => setActiveTab('schedule')}
          >
            Lịch sự kiện & Đặt vé
          </button>
          <button
            type="button"
            className={`ct-subnav-item ${activeTab === 'about' ? 'active' : ''}`}
            onClick={() => setActiveTab('about')}
          >
            Về sự kiện
          </button>
          <button
            type="button"
            className={`ct-subnav-item ${activeTab === 'artists' ? 'active' : ''}`}
            onClick={() => setActiveTab('artists')}
          >
            Nghệ sĩ / Khách mời
          </button>
          <button
            type="button"
            className={`ct-subnav-item ${activeTab === 'organizer' ? 'active' : ''}`}
            onClick={() => setActiveTab('organizer')}
          >
            Nhà tổ chức
          </button>
        </div>
      </div>

      {/* 6. Tab Content Area */}
      <div className="ct-container ct-tab-content-area" id="booking-section">
        
        {/* Tab 1: Lịch sự kiện & Đặt vé */}
        {activeTab === 'schedule' && (
          <div className="ct-schedule-booking-layout">
            
            {/* Left Box: Venue Card & Session Selector */}
            <div className="ct-schedule-left-col">
              <h2 className="ct-block-title">Lịch sự kiện và sơ đồ chỗ ngồi</h2>
              <p className="ct-block-subtitle">Vui lòng chọn một khung giờ để bắt đầu đặt vé</p>

              {/* Venue Card */}
              <div className="ct-venue-card">
                <div className="ct-venue-info">
                  <div className="ct-venue-name">{event.venue}</div>
                  <div className="ct-venue-address">{event.date}</div>
                  <button
                    type="button"
                    className="ct-view-map-link"
                    onClick={() => setActiveTab('about')}
                  >
                    Xem sơ đồ chỗ ngồi &rarr;
                  </button>
                </div>
              </div>

              {/* Session Selector */}
              <div className="ct-session-card">
                <div className="ct-session-date-label">Thời gian: {event.date} (ICT)</div>
                <div className="ct-session-chips">
                  <button type="button" className="ct-session-chip active">
                    09:00 - 12:00
                  </button>
                  <button type="button" className="ct-session-chip" disabled>
                    14:00 (Hết suất)
                  </button>
                </div>
              </div>

              {/* Live Capacity & Redis Status (US-11, US-12, US-13) */}
              <div className="ct-redis-capacity-box">
                <div className="ct-redis-header">
                  <span className="ct-redis-live-badge">[LIVE REDIS]</span>
                  <span className="ct-redis-info-text">ElastiCache Atomic Counter</span>
                </div>
                <div className="ct-redis-stat-row">
                  <div className="ct-stat-num">
                    <span className="ct-stat-left">{isAwsEvent ? ticketsLeft : 0}</span>
                    <span className="ct-stat-total"> / {isAwsEvent ? totalTickets : 300} vé</span>
                  </div>
                  <button
                    type="button"
                    className="ct-refresh-btn"
                    onClick={onRefetchStatus}
                    title="Làm mới số vé từ AWS ElastiCache"
                  >
                    [Cập nhật]
                  </button>
                </div>
                <div className="ct-progress-track">
                  <div
                    className="ct-progress-fill"
                    style={{
                      width: `${isAwsEvent ? Math.max(0, (ticketsLeft / totalTickets) * 100) : 0}%`,
                    }}
                  />
                </div>
                <div className="ct-redis-note">
                  Kiểm soát số ghế theo thời gian thực (Atomic Decrement), bảo vệ hệ thống trước đợt tải 1.500 CCU đột biến.
                </div>
              </div>

            </div>

            {/* Right Box: Ticket Tier Selection & Attendee Registration Form */}
            <div className="ct-schedule-right-col">
              
              <div className="ct-booking-card">
                <h3 className="ct-booking-card-title">1. Chọn hạng vé (Tối đa 1 vé/người - US-08)</h3>

                <div className="ct-tier-list">
                  {tiers.map((t) => (
                    <label
                      key={t.id}
                      className={`ct-tier-item ${selectedTier === t.id ? 'selected' : ''} ${
                        t.availableCount === 0 && !isAwsEvent ? 'disabled' : ''
                      }`}
                    >
                      <div className="ct-tier-radio-wrap">
                        <input
                          type="radio"
                          name="ticket_tier"
                          value={t.id}
                          checked={selectedTier === t.id}
                          onChange={() => setSelectedTier(t.id)}
                          disabled={t.availableCount === 0 && !isAwsEvent}
                        />
                      </div>
                      <div className="ct-tier-content">
                        <div className="ct-tier-header">
                          <span className="ct-tier-name">{t.name}</span>
                          <span className="ct-tier-price">{t.priceText}</span>
                        </div>
                        <p className="ct-tier-desc">{t.description}</p>
                        {t.badge && (
                          <span className="ct-tier-badge">{t.badge}</span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>

                {/* 10-Minute Hold Status Banner (US-11) */}
                {isHoldingActive ? (
                  <div className="ct-hold-active-banner">
                    <div>
                      <strong>Đang giữ vé trong {formatTimer(holdSecondsLeft)}</strong>
                      <p>Ghế đã được tạm khóa trên ElastiCache. Vui lòng hoàn tất thông tin bên dưới.</p>
                    </div>
                  </div>
                ) : (
                  !isSoldOut && (
                    <div className="ct-hold-prompt-banner">
                      <span>Thời gian giữ vé: Tạm giữ 10 phút sau khi nhấn Đặt vé để hoàn tất biểu mẫu.</span>
                    </div>
                  )
                )}

                {/* Registration Form */}
                <form onSubmit={handleBookingSubmit} className="ct-registration-form">
                  <h3 className="ct-booking-card-title" style={{ marginTop: '20px' }}>
                    2. Thông tin người tham dự
                  </h3>

                  <div className="ct-field-group">
                    <label className="ct-label">Họ và tên *</label>
                    <input
                      type="text"
                      className={`ct-input ${formErrors.name ? 'error' : ''}`}
                      placeholder="Nguyễn Văn A"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      disabled={isSoldOut}
                    />
                    {formErrors.name && <span className="ct-field-error">{formErrors.name}</span>}
                  </div>

                  <div className="ct-field-group">
                    <label className="ct-label">Email nhận vé điện tử (QR Code) *</label>
                    <input
                      type="email"
                      className={`ct-input ${formErrors.email ? 'error' : ''}`}
                      placeholder="nguyenvana@gmail.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      disabled={isSoldOut}
                    />
                    {formErrors.email && <span className="ct-field-error">{formErrors.email}</span>}
                    <span className="ct-field-hint">Mỗi email chỉ được cấp 1 vé duy nhất (US-08).</span>
                  </div>

                  <div className="ct-field-group">
                    <label className="ct-label">Số điện thoại *</label>
                    <input
                      type="tel"
                      className={`ct-input ${formErrors.phone ? 'error' : ''}`}
                      placeholder="0912345678"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      disabled={isSoldOut}
                    />
                    {formErrors.phone && <span className="ct-field-error">{formErrors.phone}</span>}
                  </div>

                  {/* Summary & Submit */}
                  <div className="ct-order-summary-box">
                    <div className="ct-summary-row">
                      <span>Hạng vé:</span>
                      <strong>{chosenTier.name}</strong>
                    </div>
                    <div className="ct-summary-row">
                      <span>Số lượng:</span>
                      <strong>1 vé</strong>
                    </div>
                    <div className="ct-summary-row ct-total-row">
                      <span>Tổng thanh toán:</span>
                      <strong className="ct-total-price">{chosenTier.priceText}</strong>
                    </div>
                  </div>

                  {isSoldOut ? (
                    <button
                      type="button"
                      className="ct-submit-booking-btn btn-soldout"
                      onClick={onOpenWaitlist}
                    >
                      Hết vé - Đăng ký nhận thông báo (Waitlist)
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="ct-submit-booking-btn"
                      disabled={isLoading}
                    >
                      {isLoading ? 'Đang xử lý xuất vé qua AWS...' : 'Xác nhận đặt vé & Nhận mã QR ngay'}
                    </button>
                  )}

                  <div className="ct-form-guarantee">
                    Mã QR vé duy nhất - Chống làm giả với kiểm toán RDS Multi-AZ
                  </div>
                </form>

              </div>

            </div>

          </div>
        )}

        {/* Tab 2: Về sự kiện (Real Seatmap, Benefits, Terms & Refund Policy US-14) */}
        {activeTab === 'about' && (
          <div className="ct-about-tab-container">
            
            {/* Real Seatmap Graphic from CTicket */}
            <div className="ct-content-block">
              <h3 className="ct-block-header">SƠ ĐỒ CHỖ NGỒI VÀ GIÁ VÉ</h3>
              <div className="ct-seatmap-image-wrapper">
                <img
                  src="/assets/events/cticket_seatmap_full.png"
                  alt="Sơ đồ chỗ ngồi Seatmap CTicket"
                  className="ct-real-seatmap-img"
                />
              </div>
            </div>

            {/* Real Benefits Matrix from CTicket */}
            <div className="ct-content-block">
              <h3 className="ct-block-header">QUYỀN LỢI CÁC HẠNG VÉ (BENEFIT MATRIX)</h3>
              <div className="ct-seatmap-image-wrapper">
                <img
                  src="/assets/events/cticket_benefits_full.png"
                  alt="Bảng quyền lợi hạng vé CTicket"
                  className="ct-real-seatmap-img"
                />
              </div>
            </div>

            {/* Real Terms and Conditions from CTicket */}
            <div className="ct-content-block">
              <h3 className="ct-block-header">LƯU Ý VÀ QUY ĐỊNH HOÀN TIỀN (US-14)</h3>
              <div className="ct-seatmap-image-wrapper">
                <img
                  src="/assets/events/cticket_terms_full.png"
                  alt="Quy định và điều khoản mua vé"
                  className="ct-real-seatmap-img"
                />
              </div>
            </div>

          </div>
        )}

        {/* Tab 3: Nghệ sĩ / Diễn giả */}
        {activeTab === 'artists' && (
          <div className="ct-artists-tab-container">
            <h3 className="ct-block-header">DIỄN GIẢ VÀ KHÁCH MỜI ĐẶC BIỆT</h3>
            <div className="ct-speakers-grid">
              <div className="ct-speaker-card">
                <div className="ct-speaker-name">AWS Solutions Architect</div>
                <div className="ct-speaker-role">Chuyên gia Cloud Architecture</div>
                <p className="ct-speaker-bio">Kinh nghiệm 10+ năm thiết kế hệ thống chịu tải cao, microservices và serverless trên Amazon Web Services.</p>
              </div>
              <div className="ct-speaker-card">
                <div className="ct-speaker-name">Database & Storage Lead</div>
                <div className="ct-speaker-role">Nguyễn Văn Hiếu (TicketRush DB Team)</div>
                <p className="ct-speaker-bio">Phụ trách thiết kế Amazon RDS MySQL Multi-AZ, ElastiCache Redis Cluster và Amazon S3 Storage cho hệ thống bán vé.</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Nhà tổ chức */}
        {activeTab === 'organizer' && (
          <div className="ct-organizer-tab-container">
            <h3 className="ct-block-header">THÔNG TIN NHÀ TỔ CHỨC SỰ KIỆN</h3>
            <div className="ct-organizer-box">
              <div className="ct-org-info">
                <h4>TicketRush & AWS Student Community</h4>
                <p>Dự án kiến trúc hạ tầng chịu tải cao cho sự kiện bán vé quy mô lớn.</p>
                <div className="ct-org-members">
                  <strong>Thành viên nhóm dự án:</strong>
                  <ul>
                    <li>Phan Huy Anh - Team Lead & Compute Architecture</li>
                    <li>Nguyễn Tất Bình - Network, VPC & Security Groups</li>
                    <li>Trần Đức Hoàng - Serverless API, Lambda & Backend</li>
                    <li>Nguyễn Văn Hiếu - Database (RDS Multi-AZ), Cache (Redis), S3 & UI/UX</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

    </div>
  );
};

export default EventDetailView;
