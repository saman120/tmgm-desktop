import React from 'react';
import { Clock } from 'lucide-react';
import './Header.css';

const Header = () => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="header-accent">
          <Clock size={16} className="pulse" />
        </div>
      </div>
      <div className="header-divider"></div>
    </header>
  );
};

export default React.memo(Header);