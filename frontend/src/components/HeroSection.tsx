import React, { useState } from 'react';

export type EventPublishStatus = 'PUBLISHED' | 'DRAFT' | 'CANCELLED';
export type EventRegistrationState = 'OPEN' | 'SOLD_OUT' | 'NOT_OPEN_YET' | 'CLOSED';

export interface EventItemData {
  id: number;
  title: string;
  category: string;
  categoryColor: { bg: string; text: string };
  date: string;
  venue: string;
  price: string;
  badge?: 'Đã bán hết vé' | 'Chờ mở bán' | 'Đã đóng' | 'Đang mở bán';
  badgeType?: 'black' | 'pink' | 'green';
  solidColor: string;
  desc?: string;
  organizer?: string;
  publishStatus?: EventPublishStatus;
  registrationState?: EventRegistrationState;
  registrationWindow?: string;
  capacity?: number;
  soldCount?: number;
  locationCity?: string;
}

interface HeroSectionProps {
  events?: EventItemData[];
  onSelectEvent: (eventId: number) => void;
  searchQuery?: string;
  selectedLocation?: string;
  onResetFilters?: () => void;
}

export const CTICKET_EVENTS: EventItemData[] = [
  {
    id: 1,
    title: 'MỸ TÂM LIVE CONCERT-SEE THE LIGHT DAY 2',
    category: 'Nhạc sống',
    categoryColor: { bg: '#FCE7F3', text: '#BE185D' },
    date: 'TP. Hồ Chí Minh, 21 tháng 11, 2026',
    venue: 'Khu dân cư Vạn Phúc, TP. Thủ Đức',
    price: 'Từ 1.500.000 VND đến 4.600.000 VND',
    badge: 'Đã bán hết vé',
    badgeType: 'black',
    solidColor: '#E2E8F0',
    desc: 'Mỹ Tâm Live Concert See The Light Day 2 - Đêm nhạc đỉnh cao với hệ thống âm thanh, ánh sáng chuẩn quốc tế tại Vạn Phúc City.',
    publishStatus: 'PUBLISHED',
    registrationState: 'SOLD_OUT',
    registrationWindow: '01/10/2026 09:00 - 20/11/2026 23:59',
    capacity: 15000,
    soldCount: 15000,
    locationCity: 'TP. Hồ Chí Minh',
    organizer: 'MT Entertainment',
  },
  {
    id: 2,
    title: 'Tùng Dương - Bay về phía mặt trời',
    category: 'Nhạc sống',
    categoryColor: { bg: '#FCE7F3', text: '#BE185D' },
    date: 'Hà Nội, 19 tháng 12, 2026',
    venue: 'Trung tâm Hội nghị Quốc gia, Hà Nội',
    price: 'Từ 1.200.000 VND đến 3.800.000 VND',
    badge: 'Đang mở bán',
    badgeType: 'green',
    solidColor: '#E2E8F0',
    desc: 'Live concert Tùng Dương kỷ niệm 20 năm ca hát với các bản phối giao hưởng đương đại đỉnh cao.',
    publishStatus: 'PUBLISHED',
    registrationState: 'OPEN',
    registrationWindow: '15/10/2026 09:00 - 18/12/2026 23:59',
    capacity: 3500,
    soldCount: 2840,
    locationCity: 'Hà Nội',
    organizer: 'Divo Music Production',
  },
  {
    id: 3,
    title: 'Tình Cờ Là Wes Anderson',
    category: 'Sân khấu & Nghệ thuật',
    categoryColor: { bg: '#E0F2FE', text: '#0284C7' },
    date: 'TP. Hồ Chí Minh, 06 tháng 11, 2026 - 05 tháng 5, 2027',
    venue: 'Bảo tàng Mỹ thuật TP. Hồ Chí Minh',
    price: '180.000 VND',
    solidColor: '#E2E8F0',
    desc: 'Triển lãm nhiếp ảnh đương đại phong cách đối xứng Wes Anderson lần đầu tiên xuất hiện tại Việt Nam.',
    publishStatus: 'PUBLISHED',
    registrationState: 'OPEN',
    registrationWindow: '10/10/2026 08:00 - 05/05/2027 20:00',
    capacity: 1000,
    soldCount: 420,
    locationCity: 'TP. Hồ Chí Minh',
    organizer: 'Accidentally Wes Anderson VN',
  },
  {
    id: 4,
    title: 'HYOLOGRAM',
    category: 'Fan Meeting',
    categoryColor: { bg: '#D1FAE5', text: '#059669' },
    date: 'TP. Hồ Chí Minh, 08 tháng 11, 2026',
    venue: 'Nhà thi đấu Quân khu 7, TP. HCM',
    price: 'Từ 900.000 VND đến 2.500.000 VND',
    solidColor: '#E2E8F0',
    desc: 'Fanmeeting chính thức của Hyo với sân khấu biểu diễn độc quyền và fansign 1:1 dành cho hạng VIP.',
    publishStatus: 'PUBLISHED',
    registrationState: 'OPEN',
    registrationWindow: '12/10/2026 12:00 - 07/11/2026 23:59',
    capacity: 2500,
    soldCount: 1980,
    locationCity: 'TP. Hồ Chí Minh',
    organizer: 'Dreams Entertainment',
  },
  {
    id: 5,
    title: 'Liên Quân 10Fest | Chung Kết Quốc Gia Đấu Trường Danh Vọng',
    category: 'Thể thao',
    categoryColor: { bg: '#CFFAFE', text: '#0891B2' },
    date: 'Hà Nội, 07 tháng 11, 2026',
    venue: 'Cung thể thao Điền kinh Hà Nội',
    price: 'Từ 150.000 VND đến 450.000 VND',
    solidColor: '#E2E8F0',
    desc: 'Trận chung kết tổng Đấu Trường Danh Vọng Mùa Đông 2026 - tìm kiếm nhà vô địch đại diện Việt Nam tham dự AIC.',
    publishStatus: 'PUBLISHED',
    registrationState: 'OPEN',
    registrationWindow: '15/10/2026 10:00 - 06/11/2026 23:59',
    capacity: 4000,
    soldCount: 3450,
    locationCity: 'Hà Nội',
    organizer: 'Garena Liên Quân Mobile',
  },
  {
    id: 6,
    title: 'Liên Quân 10Fest | Đại Nhạc Hội',
    category: 'Nhạc sống',
    categoryColor: { bg: '#FCE7F3', text: '#BE185D' },
    date: 'Hà Nội, 08 tháng 11, 2026',
    venue: 'Quảng trường Cách Mạng Tháng Tám',
    price: 'Từ 200.000 VND đến 800.000 VND',
    badge: 'Chờ mở bán',
    badgeType: 'pink',
    solidColor: '#E2E8F0',
    desc: 'Đại nhạc hội bùng nổ kỷ niệm 10 năm Liên Quân Mobile quy tụ các ca sĩ và rapper hàng đầu.',
    publishStatus: 'PUBLISHED',
    registrationState: 'NOT_OPEN_YET',
    registrationWindow: '01/11/2026 20:00 - 07/11/2026 23:59',
    capacity: 6000,
    soldCount: 0,
    locationCity: 'Hà Nội',
    organizer: 'Garena Liên Quân Mobile',
  },
  {
    id: 7,
    title: 'HYO Official | HYOLOGRAM LIMITED MERCHANDISE',
    category: 'Merchandise',
    categoryColor: { bg: '#FEF3C7', text: '#D97706' },
    date: 'DREAMS ENTERTAINMENT, 31 tháng 12, 2026',
    venue: 'Online Delivery Toàn Quốc',
    price: 'Từ 250.000 VND',
    solidColor: '#E2E8F0',
    desc: 'Bộ sưu tập Merchandise giới hạn kỷ niệm tour diễn HYOLOGRAM bao gồm Áo thun, Lightstick và Photobook có chữ ký.',
    publishStatus: 'PUBLISHED',
    registrationState: 'OPEN',
    registrationWindow: '15/10/2026 00:00 - 30/12/2026 23:59',
    capacity: 500,
    soldCount: 310,
    locationCity: 'TP. Hồ Chí Minh',
    organizer: 'Dreams Entertainment',
  },
  {
    id: 8,
    title: 'LOALOA Vietnam Culture & Dining Show | Tháng 10.2026',
    category: 'Sân khấu & Nghệ thuật',
    categoryColor: { bg: '#E0F2FE', text: '#0284C7' },
    date: 'Hồ Chí Minh, 01 tháng 10, 2026 - 31 tháng 10, 2026',
    venue: 'Nhà hát Bến Thành, Quận 1',
    price: 'Từ 650.000 VND đến 1.800.000 VND',
    solidColor: '#E2E8F0',
    desc: 'Chương trình ẩm thực kết hợp nghệ thuật múa dân gian đương đại tái hiện văn hóa sông nước Nam Bộ.',
    publishStatus: 'PUBLISHED',
    registrationState: 'OPEN',
    registrationWindow: '01/10/2026 08:00 - 31/10/2026 18:00',
    capacity: 800,
    soldCount: 540,
    locationCity: 'TP. Hồ Chí Minh',
    organizer: 'LOALOA Cultural Show',
  },
  {
    id: 9,
    title: 'SUPER SUNDAY - ĐẤU TRƯỜNG DANH VỌNG MÙA ĐÔNG 2026',
    category: 'Thể thao',
    categoryColor: { bg: '#CFFAFE', text: '#0891B2' },
    date: 'Thành phố Hồ Chí Minh, 20 tháng 9, 2026 - 25 tháng 10, 2026',
    venue: 'Phim trường SBS, TP. Thủ Đức',
    price: '120.000 VND',
    badge: 'Đã đóng',
    badgeType: 'black',
    solidColor: '#E2E8F0',
    desc: 'Các trận đấu vòng bảng Super Sunday gay cấn giữa các đại diện Saigon Phantom, V Gaming và Team Flash.',
    publishStatus: 'PUBLISHED',
    registrationState: 'CLOSED',
    registrationWindow: '10/09/2026 09:00 - 25/10/2026 17:00',
    capacity: 1200,
    soldCount: 1180,
    locationCity: 'TP. Hồ Chí Minh',
    organizer: 'Garena Esports VN',
  },
  {
    id: 10,
    title: 'Sân Khấu Cuối Tuần 01 - Halloween: Đêm Hội Quỷ Chuyện',
    category: 'Sân khấu & Nghệ thuật',
    categoryColor: { bg: '#E0F2FE', text: '#0284C7' },
    date: 'Thành phố Hồ Chí Minh, 31 tháng 10, 2026 - 01 tháng 11, 2026',
    venue: 'Sân khấu Kịch Thế Giới Trẻ',
    price: 'Từ 200.000 VND đến 400.000 VND',
    solidColor: '#E2E8F0',
    desc: 'Vở kịch kinh dị tâm lý hài hước đặc biệt nhân dịp lễ Halloween 2026.',
    publishStatus: 'PUBLISHED',
    registrationState: 'OPEN',
    registrationWindow: '05/10/2026 09:00 - 01/11/2026 19:00',
    capacity: 600,
    soldCount: 490,
    locationCity: 'TP. Hồ Chí Minh',
    organizer: 'Sân khấu Thế Giới Trẻ',
  },
  {
    id: 11,
    title: 'Van Gogh Timeless - Triển lãm bản quyền - đa giác quan hàng...',
    category: 'Sân khấu & Nghệ thuật',
    categoryColor: { bg: '#E0F2FE', text: '#0284C7' },
    date: 'Hà Nội, 29 tháng 8, 2026 - 30 tháng 11, 2026',
    venue: 'TTTM Gigamall & Vincom Royal City',
    price: 'Từ 350.000 VND',
    solidColor: '#E2E8F0',
    desc: 'Triển lãm tương tác đa giác quan trình chiếu 360 độ các kiệt tác nghệ thuật của đại danh họa Vincent Van Gogh.',
    publishStatus: 'PUBLISHED',
    registrationState: 'OPEN',
    registrationWindow: '20/08/2026 09:00 - 30/11/2026 21:00',
    capacity: 2000,
    soldCount: 1450,
    locationCity: 'Hà Nội',
    organizer: 'Jazzy Paradise',
  },
  {
    id: 12,
    title: 'AWS Cloud Architecture & High Concurrency Summit 2026',
    category: 'Hội thảo & Cộng đồng',
    categoryColor: { bg: '#EEF2FF', text: '#4F46E5' },
    date: 'Hà Nội, 28 tháng 11, 2026',
    venue: 'Hội trường A1, ĐHQG Hà Nội',
    price: 'Miễn phí (Giới hạn 300 vé)',
    badge: 'Đang mở bán',
    badgeType: 'green',
    solidColor: '#E2E8F0',
    desc: 'Đại hội công nghệ điện toán đám mây đỉnh cao. Thực chiến kiến trúc chịu tải 1.500 CCU, chống oversell với ElastiCache Redis và tự động co giãn Auto Scaling trên AWS.',
    publishStatus: 'PUBLISHED',
    registrationState: 'OPEN',
    registrationWindow: '20/10/2026 08:00 - 27/11/2026 23:59',
    capacity: 300,
    soldCount: 158,
    locationCity: 'Hà Nội',
    organizer: 'TicketRush & AWS Student Community',
  },
  // Non-published events (DRAFT & CANCELLED) — hidden on public discovery per US-01 AC2, visible in Organizer panel (US-03)
  {
    id: 13,
    title: 'DevSecOps & Zero-Trust Cloud Workshop 2026 (Bản nháp)',
    category: 'Hội thảo & Cộng đồng',
    categoryColor: { bg: '#EEF2FF', text: '#4F46E5' },
    date: 'Hà Nội, 15 tháng 12, 2026',
    venue: 'Tòa nhà Innovación, Cầu Giấy, Hà Nội',
    price: 'Miễn phí',
    badge: 'Chờ mở bán',
    badgeType: 'pink',
    solidColor: '#E2E8F0',
    desc: 'Sự kiện đang ở trạng thái DRAFT (Bản nháp) — chỉ hiển thị cho Ban tổ chức, không hiển thị trên trang công khai theo US-01 AC2.',
    publishStatus: 'DRAFT',
    registrationState: 'NOT_OPEN_YET',
    registrationWindow: '01/12/2026 09:00 - 14/12/2026 23:59',
    capacity: 200,
    soldCount: 0,
    locationCity: 'Hà Nội',
    organizer: 'TicketRush & AWS Student Community',
  },
  {
    id: 14,
    title: 'Đêm Nhạc Acoustic Mùa Thu Đà Nẵng (Đã hủy)',
    category: 'Nhạc sống',
    categoryColor: { bg: '#FCE7F3', text: '#BE185D' },
    date: 'Đà Nẵng, 10 tháng 11, 2026',
    venue: 'Nhà hát Trưng Vương, Đà Nẵng',
    price: '500.000 VND',
    badge: 'Đã đóng',
    badgeType: 'black',
    solidColor: '#E2E8F0',
    desc: 'Sự kiện ở trạng thái CANCELLED — bị ẩn khỏi danh sách công khai theo US-01 AC2.',
    publishStatus: 'CANCELLED',
    registrationState: 'CLOSED',
    registrationWindow: '01/10/2026 09:00 - 05/11/2026 23:59',
    capacity: 500,
    soldCount: 0,
    locationCity: 'Đà Nẵng',
    organizer: 'Danang Live Music',
  },
];

const CATEGORIES = [
  'Tất cả',
  'Nhạc sống',
  'Fan Meeting',
  'Merchandise',
  'Sân khấu & Nghệ thuật',
  'Thể thao',
  'Hội thảo & Cộng đồng',
  'Khoá học',
  'Nightlife',
  'Livestream',
  'Du lịch & Trải nghiệm',
];

const HeroSection: React.FC<HeroSectionProps> = ({
  events = CTICKET_EVENTS,
  onSelectEvent,
  searchQuery = '',
  selectedLocation = 'Tất cả địa điểm',
  onResetFilters,
}) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState('Tất cả');

  const slides = [
    {
      eventId: 1,
      solidColor: '#E2E8F0',
      tag: 'CONCERT NOI BAT',
      title: 'MỸ TÂM LIVE CONCERT - SEE THE LIGHT DAY 2',
      date: '21.11.2026 - 19:30',
      venue: 'Khu dân cư Vạn Phúc, TP. Hồ Chí Minh',
      badge: 'ĐÃ BÁN HẾT VÉ',
    },
    {
      eventId: 12,
      solidColor: '#E2E8F0',
      tag: 'TICKETRUSH DEMO - 300 VE',
      title: 'AWS CLOUD ARCHITECTURE & HIGH CONCURRENCY SUMMIT 2026',
      date: '28.11.2026 - 09:00',
      venue: 'Hội trường A1, ĐHQG Hà Nội',
      badge: 'ĐANG MỞ BÁN',
    },
    {
      eventId: 5,
      solidColor: '#E2E8F0',
      tag: 'ESPORTS VIET NAM',
      title: 'LIÊN QUÂN 10FEST | CHUNG KẾT ĐẤU TRƯỜNG DANH VỌNG',
      date: '07.11.2026 - 16:00',
      venue: 'Cung thể thao Điền kinh Hà Nội',
      badge: 'SẮP DIỄN RA',
    },
  ];

  const currentSlide = slides[currentSlideIndex];

  // US-01 AC1 & AC2: Only show PUBLISHED events on public discovery list
  const publishedEvents = events.filter((e) => (e.publishStatus || 'PUBLISHED') === 'PUBLISHED');

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredEvents = publishedEvents.filter((e) => {
    const matchCategory =
      activeCategory === 'Tất cả' ||
      e.category.toLowerCase().includes(activeCategory.toLowerCase());

    const matchLocation =
      selectedLocation === 'Tất cả địa điểm' ||
      (e.locationCity && e.locationCity.toLowerCase() === selectedLocation.toLowerCase()) ||
      e.date.toLowerCase().includes(selectedLocation.toLowerCase()) ||
      e.venue.toLowerCase().includes(selectedLocation.toLowerCase());

    const matchSearch =
      !normalizedQuery ||
      e.title.toLowerCase().includes(normalizedQuery) ||
      e.category.toLowerCase().includes(normalizedQuery) ||
      e.venue.toLowerCase().includes(normalizedQuery) ||
      (e.desc && e.desc.toLowerCase().includes(normalizedQuery));

    return matchCategory && matchLocation && matchSearch;
  });

  const hasActiveFilter =
    activeCategory !== 'Tất cả' ||
    selectedLocation !== 'Tất cả địa điểm' ||
    normalizedQuery.length > 0;

  const handleClearAllFilters = () => {
    setActiveCategory('Tất cả');
    if (onResetFilters) onResetFilters();
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentSlideIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentSlideIndex((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
  };

  return (
    <section className="ct-hero-section">
      
      {/* 1. Solid Color Banner Hero */}
      <div
        className="ct-hero-carousel-container"
        onClick={() => onSelectEvent(currentSlide.eventId)}
        title="Bấm để xem chi tiết sự kiện"
      >
        <div
          className="ct-hero-solid-banner"
          style={{ backgroundColor: currentSlide.solidColor }}
        >
          {/* Left Arrow */}
          <button
            type="button"
            className="ct-slider-nav-btn ct-btn-prev"
            onClick={handlePrev}
            title="Sự kiện trước"
          >
            &lsaquo;
          </button>

          <div className="ct-solid-banner-inner">
            <div className="ct-solid-banner-tags">
              <span className="ct-solid-tag">{currentSlide.tag}</span>
              <span className="ct-solid-badge">{currentSlide.badge}</span>
            </div>
            <h1 className="ct-solid-title">{currentSlide.title}</h1>
            <div className="ct-solid-meta-row">
              <span>Thời gian: {currentSlide.date}</span>
              <span>|</span>
              <span>Địa điểm: {currentSlide.venue}</span>
            </div>
            <div className="ct-solid-note">Bấm vào đây để xem chi tiết sự kiện và đặt vé</div>
          </div>

          {/* Right Arrow */}
          <button
            type="button"
            className="ct-slider-nav-btn ct-btn-next"
            onClick={handleNext}
            title="Sự kiện tiếp theo"
          >
            &rsaquo;
          </button>
        </div>

        {/* Carousel Dots */}
        <div className="ct-carousel-dots">
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              className={`ct-carousel-dot ${currentSlideIndex === idx ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentSlideIndex(idx);
              }}
              title={`Chuyển đến banner ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      {/* 2. Heading "Sự kiện" & Horizontal Category Filter Tabs */}
      <div className="ct-events-header-row">
        <h2 className="ct-events-heading">Sự kiện</h2>
        {hasActiveFilter && (
          <div className="ct-filter-summary-bar">
            <span className="ct-filter-summary-text">
              Hiển thị <strong>{filteredEvents.length}</strong> sự kiện đã công bố
              {selectedLocation !== 'Tất cả địa điểm' ? ` tại ${selectedLocation}` : ''}
              {normalizedQuery ? ` với từ khóa "${searchQuery.trim()}"` : ''}
            </span>
            <button
              type="button"
              className="ct-filter-reset-inline"
              onClick={handleClearAllFilters}
            >
              Đặt lại bộ lọc
            </button>
          </div>
        )}
      </div>

      <div className="ct-category-tabs-wrapper">
        <div className="ct-category-tabs-scroll">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`ct-category-tab ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="ct-tabs-arrow-btn"
          aria-label="Scroll right"
          onClick={() => {
            const el = document.querySelector('.ct-category-tabs-scroll');
            if (el) el.scrollBy({ left: 160, behavior: 'smooth' });
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>

      {/* 3. 4-Column Real Event Cards Grid OR Empty State (US-01 AC3) */}
      {filteredEvents.length === 0 ? (
        <div className="ct-empty-events-state">
          <div className="ct-empty-events-icon">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <h3 className="ct-empty-events-title">Không tìm thấy sự kiện phù hợp</h3>
          <p className="ct-empty-events-desc">
            Hiện chưa có sự kiện ở trạng thái đã công bố (PUBLISHED) khớp với danh mục, địa điểm hoặc từ khóa bạn vừa chọn.
          </p>
          <button
            type="button"
            className="ct-empty-reset-btn"
            onClick={handleClearAllFilters}
          >
            Xem tất cả sự kiện đã công bố
          </button>
        </div>
      ) : (
        <>
          <div className="ct-events-grid-4">
            {filteredEvents.map((evt) => (
              <div
                key={evt.id}
                className="ct-event-card"
                onClick={() => onSelectEvent(evt.id)}
                title={`Xem chi tiết ${evt.title}`}
              >
                {/* Card Poster with Solid Color */}
                <div
                  className="ct-card-poster"
                  style={{ backgroundColor: evt.solidColor }}
                >
                  {evt.badge && (
                    <div
                      className={`ct-card-status-badge ${
                        evt.badgeType === 'pink'
                          ? 'badge-pink'
                          : evt.badgeType === 'green'
                          ? 'badge-green'
                          : 'badge-black'
                      }`}
                    >
                      {evt.badge}
                    </div>
                  )}

                  <div className="ct-solid-card-label">
                    <span className="ct-solid-card-text">{evt.category.toUpperCase()}</span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="ct-card-body">
                  <div className="ct-card-cat-row">
                    <span
                      className="ct-card-cat-pill"
                      style={{
                        backgroundColor: evt.categoryColor.bg,
                        color: evt.categoryColor.text,
                      }}
                    >
                      {evt.category}
                    </span>
                  </div>

                  <div className="ct-card-date-venue">{evt.date}</div>

                  <h3 className="ct-card-title">{evt.title}</h3>

                  <div className="ct-card-price">{evt.price}</div>
                </div>
              </div>
            ))}
          </div>

          {/* 4. Bottom "Xem thêm" Button */}
          <div className="ct-load-more-row">
            <button
              type="button"
              className="ct-load-more-btn"
              onClick={() => alert('Đã hiển thị tất cả sự kiện công khai (PUBLISHED) mới nhất trên hệ thống!')}
            >
              Xem thêm
            </button>
          </div>
        </>
      )}

    </section>
  );
};

export default HeroSection;
