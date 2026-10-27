import React from 'react';

const HeroSection: React.FC = () => {
  return (
    <section className="hero-section">
      <div className="badge-tag">
        <span className="badge-icon">🔥</span>
        <span>SỰ KIỆN CÔNG NGHỆ ĐỈNH CAO 2026</span>
      </div>
      <h1 className="hero-title">
        AWS Cloud Architecture &amp; <br />
        <span className="gradient-text">High Concurrency Summit</span>
      </h1>
      <p className="hero-desc">
        Hội thảo chuyên sâu về kiến trúc điện toán đám mây, khả năng chịu tải đột biến và co giãn tự động (Auto Scaling) trên AWS. Số lượng vé mở đăng ký có hạn!
      </p>

      <div className="event-meta">
        <div className="meta-item">
          <span className="meta-icon">📅</span>
          <span>28/11/2026 • 09:00 AM</span>
        </div>
        <div className="meta-item">
          <span className="meta-icon">📍</span>
          <span>Hội trường A1 - Đại học Quốc gia</span>
        </div>
        <div className="meta-item">
          <span className="meta-icon">🎟️</span>
          <span>Miễn phí (Giới hạn 300 suất)</span>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
