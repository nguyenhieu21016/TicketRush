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
  const [selectedLang, setSelectedLang] = useState<'VN' | 'EN'>('VN');
  const [isLangOpen, setIsLangOpen] = useState(false);

  return (
    <header className="ct-navbar">
      <div className="ct-nav-container">
        
        {/* Brand Logo - TicketRush Style */}
        <div className="ct-brand-wrapper">
          <a
            href="#"
            className="ct-brand"
            onClick={(e) => {
              e.preventDefault();
              onGoHome();
            }}
          >
            <span className="ct-logo-ticket">Ticket</span>
            <span className="ct-logo-rush">Rush</span>
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

          {/* User Profile / Organizer Switcher - Match screenshot style */}
          <div className="ct-user-profile-group">
            <button
              type="button"
              className="ct-profile-pill-btn"
              onClick={() => onRoleChange(activeRole === 'customer' ? 'organizer' : 'customer')}
              title="Chuyển chế độ Khách mua vé / Soát vé"
            >
              <span className="ct-profile-name">Hiếu Nguyễn</span>
              <svg className="ct-user-burger-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
          </div>

          {/* Thin Divider between User and Language as shown in image */}
          <div className="ct-nav-vertical-line" />

          {/* Language Selector (Clean pure text & chevron, no flag icons) */}
          <div className="ct-lang-selector-wrapper">
            <button
              type="button"
              className="ct-lang-btn"
              onClick={() => setIsLangOpen(!isLangOpen)}
              title="Chọn ngôn ngữ hiển thị"
            >
              <span className="ct-lang-code">{selectedLang}</span>
              <svg className="ct-lang-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            {isLangOpen && (
              <div className="ct-lang-dropdown-menu">
                <div
                  className={`ct-lang-option ${selectedLang === 'VN' ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedLang('VN');
                    setIsLangOpen(false);
                  }}
                >
                  <span className="ct-lang-option-text">Tiếng Việt (VN)</span>
                  {selectedLang === 'VN' && (
                    <svg className="ct-lang-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  )}
                </div>

                <div
                  className={`ct-lang-option ${selectedLang === 'EN' ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedLang('EN');
                    setIsLangOpen(false);
                  }}
                >
                  <span className="ct-lang-option-text">English (EN)</span>
                  {selectedLang === 'EN' && (
                    <svg className="ct-lang-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  )}
                </div>
              </div>
            )}
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
