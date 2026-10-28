import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="ct-footer">
      <div className="ct-footer-container">
        
        {/* Column 1: TicketRush Brand & Slogan */}
        <div className="ct-footer-col ct-footer-brand-col">
          <div className="ct-footer-logo">
            <span className="ct-logo-ticket">Ticket</span>
            <span className="ct-logo-rush">Rush</span>
          </div>
          <p className="ct-footer-slogan">
            Nền tảng bán vé trực tuyến uy tín tại Việt Nam
          </p>
          <p className="ct-footer-desc">
            TicketRush - Mua vé dễ dàng, nâng tầm trải nghiệm.
          </p>
        </div>

        {/* Column 2: TicketRush xin chào! */}
        <div className="ct-footer-col">
          <h4 className="ct-footer-heading">TicketRush xin chào!</h4>
          <ul className="ct-footer-links">
            <li><a href="#about">Về chúng tôi</a></li>
            <li><a href="#policy">Quy chế hoạt động</a></li>
            <li><a href="#privacy">Chính sách bảo mật thông tin</a></li>
            <li><a href="#payment-policy">Chính sách bảo mật thanh toán</a></li>
            <li><a href="#payment-methods">Phương thức thanh toán</a></li>
            <li><a href="#partners">Đối tác của chúng tôi</a></li>
            <li><a href="#terms">Điều khoản sử dụng</a></li>
          </ul>
        </div>

        {/* Column 3: Dịch vụ và Ưu đãi */}
        <div className="ct-footer-col">
          <h4 className="ct-footer-heading">Dịch vụ và Ưu đãi</h4>
          <ul className="ct-footer-links">
            <li><a href="#customers">Dành cho Khách hàng</a></li>
            <li><a href="#promotions">Khuyến mại</a></li>
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
            <li><a href="#dispute">Cơ chế giải quyết tranh chấp/ Khiếu nại</a></li>
          </ul>
        </div>

      </div>

      {/* Bottom copyright line */}
      <div className="ct-footer-bottom">
        <div className="ct-footer-container ct-footer-bottom-inner">
          <p>All rights reserved 2026 © TicketRush</p>
          <div className="ct-footer-social">
            <span className="ct-footer-fb-icon">f</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
