import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="ct-footer">
      <div className="ct-footer-container">
        
        {/* Column 1: CTicket Brand & Slogan */}
        <div className="ct-footer-col ct-footer-brand-col">
          <div className="ct-footer-logo">
            <span className="ct-logo-prefix">C</span>
            <span className="ct-footer-logo-text">Ticket</span>
          </div>
          <p className="ct-footer-slogan">
            Nền tảng bán vé trực tuyến uy tín tại Việt Nam
          </p>
          <p className="ct-footer-desc">
            CTicket - Mua vé dễ dàng, nâng tầm trải nghiệm.
          </p>
          <div className="ct-footer-badges">
            <span className="ct-footer-pill">AWS High Concurrency</span>
            <span className="ct-footer-pill">Redis Cache Protected</span>
          </div>
        </div>

        {/* Column 2: CTicket xin chào! */}
        <div className="ct-footer-col">
          <h4 className="ct-footer-heading">CTicket xin chào!</h4>
          <ul className="ct-footer-links">
            <li><a href="#about">Về chúng tôi</a></li>
            <li><a href="#policy">Quy chế hoạt động</a></li>
            <li><a href="#privacy">Chính sách bảo mật thông tin</a></li>
            <li><a href="#payment-policy">Chính sách bảo mật thanh toán</a></li>
            <li><a href="#payment-methods">Phương thức thanh toán</a></li>
          </ul>
        </div>

        {/* Column 3: Dịch vụ và Ưu đãi */}
        <div className="ct-footer-col">
          <h4 className="ct-footer-heading">Dịch vụ và Ưu đãi</h4>
          <ul className="ct-footer-links">
            <li><a href="#customers">Dành cho Khách hàng</a></li>
            <li><a href="#promotions">Khuyến mại</a></li>
            <li><a href="#organizers">Dành cho Ban tổ chức</a></li>
            <li><a href="#api">Hệ thống TicketRush API</a></li>
          </ul>
        </div>

        {/* Column 4: Liên hệ và Hỗ trợ */}
        <div className="ct-footer-col">
          <h4 className="ct-footer-heading">Liên hệ và Hỗ trợ</h4>
          <ul className="ct-footer-links">
            <li><a href="#contact">Liên hệ chúng tôi</a></li>
            <li><a href="#faq">Câu hỏi thường gặp</a></li>
            <li><a href="#articles">Bài viết liên quan</a></li>
            <li><a href="#guide">Hướng dẫn sử dụng</a></li>
            <li><a href="#feedback">Danh sách phản ánh/ góp ý</a></li>
          </ul>
        </div>

      </div>

      {/* Bottom copyright line */}
      <div className="ct-footer-bottom">
        <div className="ct-footer-container ct-footer-bottom-inner">
          <p>© 2026 CTicket • Được vận hành bởi TicketRush Team (AWS Cloud Computing Architecture)</p>
          <p className="ct-footer-credits">
            Nhóm môn học: Phan Huy Anh (Lead) • Nguyễn Tất Bình (Network/Sec) • Trần Đức Hoàng (API/Lambda) • Nguyễn Văn Hiếu (DB/Storage)
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
