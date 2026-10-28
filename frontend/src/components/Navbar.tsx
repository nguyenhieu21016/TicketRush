import React, { useState } from 'react';

interface NavbarProps {
  systemStatusText: string;
  activeRole: 'customer' | 'organizer';
  onRoleChange: (role: 'customer' | 'organizer') => void;
  onOpenMyTickets: () => void;
  onGoHome: () => void;
  myTicketCount: number;
}

const Navbar: React.FC<NavbarProps> = ({
  systemStatusText,
  activeRole,
  onRoleChange,
  onOpenMyTickets,
  onGoHome,
  myTicketCount,
}) => {
  const [selectedLocation, setSelectedLocation] = useState('Tất cả địa điểm');
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="ct-navbar">
      <div className="ct-nav-container">
        
        {/* Brand Logo - 100% CTicket Official Style */}
        <div className="ct-brand-wrapper">
          <a
            href="#"
            className="ct-brand"
            onClick={(e) => {
              e.preventDefault();
              onGoHome();
            }}
          >
            <span className="ct-logo-prefix">C</span>
            <span className="ct-logo-text">Ticket</span>
            <span className="ct-logo-sub">Rush</span>
          </a>
        </div>

        {/* Unified Search Pill - Exactly like CTicket.vn */}
        <div className="ct-unified-search-pill">
          
          {/* Location Dropdown on Left of Pill */}
          <div className="ct-pill-location">
            <button
              type="button"
              className="ct-pill-location-btn"
              onClick={() => setIsLocationOpen(!isLocationOpen)}
            >
              <span>{selectedLocation}</span>
              <span className="ct-arrow-down">▾</span>
            </button>

            {isLocationOpen && (
              <div className="ct-location-dropdown-menu">
                {['Tất cả địa điểm', 'Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng'].map((loc) => (
                  <div
                    key={loc}
                    className={`ct-dropdown-option ${selectedLocation === loc ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedLocation(loc);
                      setIsLocationOpen(false);
                    }}
                  >
                    {loc}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="ct-pill-divider" />

          {/* Search Input on Right of Pill */}
          <div className="ct-pill-input-wrap">
            <input
              type="text"
              placeholder="Tìm kiếm sự kiện, nghệ sĩ,..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ct-pill-input"
            />
          </div>
        </div>

        {/* Right Nav Items: Vé của tôi, Hiếu Nguyễn & VN */}
        <div className="ct-nav-right">
          
          {/* My Tickets Button (No emoji, clean text and counter) */}
          <button
            type="button"
            className="ct-nav-btn ct-my-tickets-btn"
            onClick={onOpenMyTickets}
            title="Xem danh sách vé đã đặt"
          >
            <span>Vé của tôi</span>
            {myTicketCount > 0 && (
              <span className="ct-nav-badge">{myTicketCount}</span>
            )}
          </button>

          {/* User Profile / Organizer Switcher */}
          <div className="ct-user-profile-group">
            <div className="ct-profile-badge">
              <span className="ct-avatar-circle">H</span>
              <span className="ct-profile-name">Hiếu Nguyễn</span>
              <button
                type="button"
                className="ct-role-toggle-btn"
                onClick={() => onRoleChange(activeRole === 'customer' ? 'organizer' : 'customer')}
                title="Chuyển chế độ Khách mua vé / Ban tổ chức soát vé (US-19)"
              >
                <span className={`ct-role-chip ${activeRole === 'organizer' ? 'org-active' : ''}`}>
                  {activeRole === 'customer' ? 'Khách hàng' : 'Soát vé'}
                </span>
                <span className="ct-burger-icon">☰</span>
              </button>
            </div>
          </div>

          {/* Language Selector */}
          <div className="ct-lang-selector">
            <span className="ct-lang-code">VN</span>
            <span className="ct-arrow-down">▾</span>
          </div>

          {/* AWS Live Status indicator */}
          <div className="ct-aws-indicator" title="Hạ tầng AWS Live Status">
            <span className="ct-indicator-dot" />
            <span className="ct-indicator-text">{systemStatusText}</span>
          </div>

        </div>

      </div>
    </header>
  );
};

export default Navbar;
