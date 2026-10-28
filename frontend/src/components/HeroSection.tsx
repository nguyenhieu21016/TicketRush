import React, { useState } from 'react';

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
}

interface HeroSectionProps {
  onSelectEvent: (eventId: number) => void;
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
  },
  {
    id: 12,
    title: 'AWS Cloud Architecture & High Concurrency Summit 2026',
    category: 'Hội thảo & Công nghệ',
    categoryColor: { bg: '#EEF2FF', text: '#4F46E5' },
    date: 'Hà Nội, 28 tháng 11, 2026',
    venue: 'Hội trường A1, ĐHQG Hà Nội',
    price: 'Miễn phí (Giới hạn 300 vé)',
    badge: 'Đang mở bán',
    badgeType: 'green',
    solidColor: '#E2E8F0',
    desc: 'Đại hội công nghệ điện toán đám mây đỉnh cao. Thực chiến kiến trúc chịu tải 1.500 CCU, chống oversell với ElastiCache Redis và tự động co giãn Auto Scaling trên AWS.',
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
  'Live Music',
];

const HeroSection: React.FC<HeroSectionProps> = ({ onSelectEvent }) => {
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

  const filteredEvents = activeCategory === 'Tất cả'
    ? CTICKET_EVENTS
    : CTICKET_EVENTS.filter((e) => e.category.toLowerCase().includes(activeCategory.toLowerCase()));

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
        <div className="ct-tabs-fade-right">&rsaquo;</div>
      </div>

      {/* 3. 4-Column Real Event Cards Grid with Clean Solid Color Blocks */}
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
          onClick={() => alert('Đã hiển thị tất cả sự kiện mới nhất trên CTicket!')}
        >
          Xem thêm
        </button>
      </div>

    </section>
  );
};

export default HeroSection;
