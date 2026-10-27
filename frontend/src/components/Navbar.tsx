import React from 'react';

interface NavbarProps {
  systemStatusText: string;
}

const Navbar: React.FC<NavbarProps> = ({ systemStatusText }) => {
  return (
    <header className="navbar">
      <div className="nav-container">
        <div className="brand">
          <span className="brand-icon">⚡</span>
          <span className="brand-name">
            Ticket<span className="gradient-text">Rush</span>
          </span>
        </div>
        <div className="system-status">
          <span className="status-pulse"></span>
          <span className="status-text" id="systemStatusText">{systemStatusText}</span>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
