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
    description: 'Khu vực đứng cận cảnh, tặng kèm quà lưu niệm độc quyền và Photocard có chữ ký.',
    availableCount: 0,
    maxPerOrder: 1,
    badge: 'HẾT VÉ',
  },
  {
    id: 'vip_seated',
    name: 'VIP Seated (Khán đài trung tâm)',
    priceText: '3.400.000 VND',
    priceValue: 3400000,
    description: 'Ghế ngồi trung tâm đối diện sân khấu chính, tặng Khăn kỷ niệm và Soundcheck pass.',
    availableCount: 0,
    maxPerOrder: 1,
    badge: 'HẾT VÉ',
  },
  {
    id: 'svip',
    name: 'SVIP (Hàng 1-3 Premium)',
    priceText: '4.600.000 VND',
    priceValue: 4600000,
    description: 'Trải nghiệm trọn gói: Full quà tặng, tiệc đón tiếp VIP Lounge và chụp ảnh kỷ niệm.',
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

  // US-02 AC1, AC2, AC3: Determine exact registration state for the event
  const effectiveRegState: 'OPEN' | 'SOLD_OUT' | 'NOT_OPEN_YET' | 'CLOSED' | 'CANCELLED' = (() => {
    if (event.publishStatus === 'CANCELLED') return 'CANCELLED';
    if (event.registrationState === 'NOT_OPEN_YET') return 'NOT_OPEN_YET';
    if (event.registrationState === 'CLOSED') return 'CLOSED';
    if (isAwsEvent) {
      return status === 'soldout' || ticketsLeft <= 0 ? 'SOLD_OUT' : 'OPEN';
    }
    if (event.registrationState === 'SOLD_OUT' || event.badge === 'Đã bán hết vé') {
      return 'SOLD_OUT';
    }
    return 'OPEN';
  })();

  const isSoldOut = effectiveRegState === 'SOLD_OUT';
  const isBookingBlocked = effectiveRegState !== 'OPEN';

  const eventTotalCapacity = isAwsEvent ? totalTickets : event.capacity || 1000;
  const eventCapacityLeft = isAwsEvent
    ? ticketsLeft
    : effectiveRegState === 'SOLD_OUT'
    ? 0
    : Math.max(0, (event.capacity || 1000) - (event.soldCount || 0));

  const defaultEventTiers: TicketTier[] = [
    {
      id: 'standard_pass',
      name: 'Vé Tiêu Chuẩn (Standard Pass)',
      priceText: event.price,
      priceValue: 250000,
      description: `Vé tham dự chính thức sự kiện ${event.title} tại ${event.venue}.`,
      availableCount: effectiveRegState === 'OPEN' ? eventCapacityLeft : 0,
      maxPerOrder: 1,
      badge:
        effectiveRegState === 'OPEN'
          ? 'ĐANG MỞ BÁN'
          : effectiveRegState === 'NOT_OPEN_YET'
          ? 'CHỜ MỞ BÁN'
          : effectiveRegState === 'SOLD_OUT'
          ? 'HẾT VÉ'
          : 'ĐÃ ĐÓNG',
    },
  ];

  const tiers = isAwsEvent
    ? AWS_TIERS
    : event.id === 1
    ? MYTAM_TIERS
    : defaultEventTiers;

  const [activeTab, setActiveTab] = useState<'schedule' | 'about' | 'artists' | 'organizer'>('schedule');
  const [selectedTier, setSelectedTier] = useState<string>(tiers[0]?.id || 'early_bird');
  const [isHoldingActive, setIsHoldingActive] = useState<boolean>(false);
  const [holdSecondsLeft, setHoldSecondsLeft] = useState<number>(600); // 10 minutes hold (US-11)

  useEffect(() => {
    setSelectedTier(tiers[0]?.id || 'early_bird');
    setIsHoldingActive(false);
  }, [event.id]);

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
    if (effectiveRegState === 'NOT_OPEN_YET') {
      onAddToast({
        message: 'Sự kiện hiện chưa đến thời gian mở cổng đăng ký! (US-02 AC2)',
        type: 'warning',
      });
      return;
    }
    if (effectiveRegState === 'CLOSED' || effectiveRegState === 'CANCELLED') {
      onAddToast({
        message: 'Cổng đăng ký của sự kiện này đã đóng hoặc sự kiện đã hủy! (US-02 AC2)',
        type: 'error',
      });
      return;
    }
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

      {/* 2. Main Event Hero Section - Exact CTicket.vn 2-Column Banner */}
      <div className="ct-event-meta-header">
        <div className="ct-container ct-meta-header-inner">
          
          <div className="ct-hero-grid-split">
            {/* Left Column: Poster Card + Buy Ticket Pink CTA Button */}
            <div className="ct-hero-left-poster-box">
              <div
                className="ct-hero-poster-solid"
                style={{ backgroundColor: event.solidColor }}
              >
                <div className="ct-solid-card-label">
                  <span className="ct-solid-card-text">{event.category.toUpperCase()}</span>
                </div>
              </div>

              {/* Main Pink Action Button (US-02 AC2 & AC3) */}
              {effectiveRegState === 'NOT_OPEN_YET' ? (
                <button
                  type="button"
                  className="ct-hero-action-btn btn-disabled-state"
                  disabled
                  title="Sự kiện chưa đến thời gian mở cổng đăng ký (US-02 AC2)"
                >
                  Chưa mở đăng ký
                </button>
              ) : effectiveRegState === 'CLOSED' || effectiveRegState === 'CANCELLED' ? (
                <button
                  type="button"
                  className="ct-hero-action-btn btn-disabled-state"
                  disabled
                  title="Cổng đăng ký đã đóng hoặc sự kiện đã hủy (US-02 AC2)"
                >
                  {effectiveRegState === 'CANCELLED' ? 'Sự kiện đã hủy' : 'Đã đóng đăng ký'}
                </button>
              ) : isSoldOut ? (
                <button
                  type="button"
                  className="ct-hero-action-btn btn-soldout"
                  onClick={onOpenWaitlist}
                  title="Sự kiện đã hết vé. Bấm tham gia hàng đợi chờ vé (Waitlist - US-02 AC3)"
                >
                  Đã bán hết vé - Vào Waitlist
                </button>
              ) : (
                <button
                  type="button"
                  className="ct-hero-action-btn btn-primary"
                  onClick={() => {
                    const el = document.getElementById('booking-section');
                    el?.scrollIntoView({ behavior: 'smooth' });
                    if (!isHoldingActive) handleStartHold();
                  }}
                >
                  {isHoldingActive
                    ? `Đang giữ chỗ (${formatTimer(holdSecondsLeft)})`
                    : 'Mua vé ngay'}
                </button>
              )}
            </div>

            {/* Right Column: Status Badge, Title, Date, Registration Window, Venue, Price, Capacity, Share */}
            <div className="ct-hero-right-info-box">
              <div className="ct-meta-badge-row">
                <span
                  className={`ct-meta-status-pill ${
                    effectiveRegState === 'OPEN'
                      ? 'available'
                      : effectiveRegState === 'NOT_OPEN_YET'
                      ? 'upcoming'
                      : 'soldout'
                  }`}
                >
                  {effectiveRegState === 'OPEN'
                    ? 'Đang mở bán'
                    : effectiveRegState === 'NOT_OPEN_YET'
                    ? 'Chờ mở bán'
                    : effectiveRegState === 'CLOSED'
                    ? 'Đã đóng đăng ký'
                    : effectiveRegState === 'CANCELLED'
                    ? 'Sự kiện đã hủy'
                    : 'Đã bán hết vé'}
                </span>
              </div>

              <h1 className="ct-event-main-title">{event.title}</h1>

              {event.desc && (
                <p className="ct-event-hero-desc">{event.desc}</p>
              )}

              <div className="ct-meta-info-list">
                <div className="ct-meta-row-item">
                  <svg className="ct-meta-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                  <div className="ct-meta-row-text">
                    <div className="ct-meta-val-primary">{event.date}</div>
                    <div className="ct-meta-val-sub">
                      Cửa sổ đăng ký: {event.registrationWindow || '01/10/2026 09:00 - 27/11/2026 23:59'}
                    </div>
                  </div>
                </div>

                <div className="ct-meta-row-item">
                  <svg className="ct-meta-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                  <div className="ct-meta-row-text">
                    <div className="ct-meta-val-primary">{event.venue}</div>
                    <div className="ct-meta-val-sub">{event.locationCity || 'Việt Nam'}</div>
                  </div>
                </div>

                <div className="ct-meta-row-item">
                  <svg className="ct-meta-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23"></line>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                  </svg>
                  <div className="ct-meta-row-text">
                    <div className="ct-meta-label-sm">
                      Giá vé &amp; Tình trạng chỗ ({eventCapacityLeft} / {eventTotalCapacity} chỗ còn trống)
                    </div>
                    <div className="ct-meta-val-price">{event.price}</div>
                  </div>
                </div>
              </div>

              {/* Share & Social Action Buttons */}
              <div className="ct-meta-actions-row">
                <button
                  type="button"
                  className="ct-social-btn"
                  onClick={() => window.open('https://facebook.com', '_blank')}
                  title="Chia sẻ lên Facebook"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                  </svg>
                </button>
                <button
                  type="button"
                  className="ct-social-btn"
                  onClick={() => {
                    navigator.clipboard?.writeText(window.location.href);
                    onAddToast({ message: 'Đã sao chép link sự kiện vào bộ nhớ tạm!', type: 'info' });
                  }}
                  title="Sao chép link"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                  </svg>
                </button>
              </div>

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
              <h3 className="ct-block-title">Lịch sự kiện và sơ đồ chỗ ngồi</h3>
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
                <div className="ct-session-date-label">
                  Cửa sổ đăng ký: {event.registrationWindow || '01/10/2026 09:00 - 27/11/2026 23:59'}
                </div>
                <div className="ct-session-chips">
                  <button
                    type="button"
                    className={`ct-session-chip ${effectiveRegState === 'OPEN' ? 'active' : ''}`}
                    disabled={isBookingBlocked}
                  >
                    09:00 - 12:00 ({effectiveRegState === 'OPEN' ? 'Còn chỗ' : effectiveRegState === 'NOT_OPEN_YET' ? 'Chờ mở bán' : effectiveRegState === 'SOLD_OUT' ? 'Hết vé' : 'Đã đóng'})
                  </button>
                  <button type="button" className="ct-session-chip" disabled>
                    14:00 (Hết suất)
                  </button>
                </div>
              </div>

              {/* Live Capacity & Redis Status (US-02 AC1, US-09, US-11) */}
              <div className="ct-redis-capacity-box">
                <div className="ct-redis-header">
                  <span className="ct-redis-live-badge">[LIVE REDIS]</span>
                  <span className="ct-redis-info-text">ElastiCache Atomic Counter</span>
                </div>
                <div className="ct-redis-stat-row">
                  <div className="ct-stat-num">
                    <span className="ct-stat-left">{eventCapacityLeft}</span>
                    <span className="ct-stat-total"> / {eventTotalCapacity} vé còn trống</span>
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
                      width: `${Math.max(0, Math.min(100, (eventCapacityLeft / eventTotalCapacity) * 100))}%`,
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
                        isBookingBlocked || (t.availableCount === 0 && !isAwsEvent) ? 'disabled' : ''
                      }`}
                    >
                      <div className="ct-tier-radio-wrap">
                        <input
                          type="radio"
                          name="ticket_tier"
                          value={t.id}
                          checked={selectedTier === t.id}
                          onChange={() => setSelectedTier(t.id)}
                          disabled={isBookingBlocked || (t.availableCount === 0 && !isAwsEvent)}
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

                {/* Registration Window / Hold Status Banner (US-02 AC2 & US-11) */}
                {effectiveRegState === 'NOT_OPEN_YET' ? (
                  <div className="ct-reg-blocked-banner upcoming">
                    <strong>Chưa mở đăng ký (US-02 AC2)</strong>
                    <p>
                      Cửa sổ đăng ký của sự kiện mở từ {event.registrationWindow || '01/11/2026 20:00'}. Hệ thống chưa cho phép tạo booking mới ở thời điểm hiện tại.
                    </p>
                  </div>
                ) : effectiveRegState === 'CLOSED' || effectiveRegState === 'CANCELLED' ? (
                  <div className="ct-reg-blocked-banner closed">
                    <strong>
                      {effectiveRegState === 'CANCELLED'
                        ? 'Sự kiện đã hủy (US-02 AC2)'
                        : 'Cổng đăng ký đã đóng (US-02 AC2)'}
                    </strong>
                    <p>
                      Thời hạn đăng ký ({event.registrationWindow || 'Đã kết thúc'}) đã khép lại. Hệ thống không tiếp nhận thêm lượt đặt vé mới.
                    </p>
                  </div>
                ) : isHoldingActive ? (
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
                      disabled={isBookingBlocked}
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
                      disabled={isBookingBlocked}
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
                      disabled={isBookingBlocked}
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

                  {effectiveRegState === 'NOT_OPEN_YET' ? (
                    <button
                      type="button"
                      className="ct-submit-booking-btn btn-disabled-state"
                      disabled
                    >
                      Chưa đến thời gian mở đăng ký (US-02)
                    </button>
                  ) : effectiveRegState === 'CLOSED' || effectiveRegState === 'CANCELLED' ? (
                    <button
                      type="button"
                      className="ct-submit-booking-btn btn-disabled-state"
                      disabled
                    >
                      {effectiveRegState === 'CANCELLED' ? 'Sự kiện đã hủy' : 'Đã đóng cổng đăng ký (US-02)'}
                    </button>
                  ) : isSoldOut ? (
                    <button
                      type="button"
                      className="ct-submit-booking-btn btn-soldout"
                      onClick={onOpenWaitlist}
                    >
                      Hết vé - Đăng ký vào danh sách chờ (Waitlist)
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

        {/* Tab 2: Về sự kiện (Solid Color Diagrams & Matrices) */}
        {activeTab === 'about' && (
          <div className="ct-about-tab-container">
            
            {/* Solid Seatmap Diagram */}
            <div className="ct-content-block">
              <h3 className="ct-block-header">SƠ ĐỒ CHỖ NGỒI VÀ GIÁ VÉ</h3>
              <div className="ct-solid-seatmap-diagram">
                <div className="ct-solid-stage">MAIN STAGE (SÂN KHẤU CHÍNH)</div>
                <div className="ct-solid-zones">
                  <div className="ct-solid-zone zone-fanzone">KHU VỰC FANZONE (ĐỨNG CẬN SÂN KHẤU)</div>
                  <div className="ct-solid-zone zone-vip">KHU VỰC VIP (GHẾ NGỒI TRUNG TÂM)</div>
                  <div className="ct-solid-zone zone-standard">KHU VỰC TIÊU CHUẨN (KHÁN ĐÀI TẦNG 2)</div>
                </div>
              </div>
            </div>

            {/* Benefits Matrix Table */}
            <div className="ct-content-block">
              <h3 className="ct-block-header">QUYỀN LỢI CÁC HẠNG VÉ (BENEFIT MATRIX)</h3>
              <div className="ct-table-responsive">
                <table className="ct-benefit-table">
                  <thead>
                    <tr>
                      <th>HẠNG VÉ</th>
                      <th>LÀN SOÁT VÉ</th>
                      <th>QUÀ TẶNG LƯU NIỆM</th>
                      <th>TEABREAK & LOUNGE</th>
                      <th>HỎI ĐÁP DIỄN GIẢ</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="ct-td-bold">Early Bird / Standard</td>
                      <td>Làn thường</td>
                      <td>Bộ slide PDF</td>
                      <td>-</td>
                      <td>Đặt câu hỏi chung</td>
                    </tr>
                    <tr className="ct-row-highlight">
                      <td className="ct-td-bold">VIP Front-Row / Fanzone</td>
                      <td>Priority Lane</td>
                      <td>Full bộ tài liệu + Quà lưu niệm</td>
                      <td>Tiệc Teabreak & VIP Lounge</td>
                      <td>Giao lưu 1:1</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Terms and Conditions */}
            <div className="ct-content-block">
              <h3 className="ct-block-header">LƯU Ý VÀ QUY ĐỊNH HOÀN TIỀN (US-14)</h3>
              <div className="ct-terms-text">
                <p><strong>1. Quy định giới hạn:</strong> Mỗi tài khoản hoặc địa chỉ email chỉ được mua tối đa 01 vé để đảm bảo chống đầu cơ vé (US-08).</p>
                <p><strong>2. Thời gian tạm giữ ghế:</strong> Hệ thống tạm khóa chỗ ngồi trong vòng 10:00 phút trên ElastiCache Redis (US-11). Quá thời gian này, vé tự động nhả về kho.</p>
                <p><strong>3. Hủy vé & Hoàn trả:</strong> Người dùng có thể chủ động hủy vé tại mục "Ví vé của tôi" trước 24 giờ diễn ra sự kiện. Ghế hủy sẽ tự động kích hoạt chuyển cho người kế tiếp trong Hàng đợi FIFO (US-14, US-15, US-16).</p>
                <p><strong>4. Soát vé tại cổng:</strong> Mỗi vé có mã QR duy nhất, nhân viên soát vé sẽ quét tại cổng và ngăn chặn tuyệt đối việc tái sử dụng vé (US-19).</p>
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
