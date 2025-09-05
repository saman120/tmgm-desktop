// src/components/Header.js
import React from 'react';
import { CheckCircle, Clock } from 'lucide-react';
import './Header.css';

const Header = () => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="header-icon">
          <CheckCircle size={24} />
        </div>
        <div className="header-text">
          <h1 className="header-title">Task Manager</h1>
          <p className="header-subtitle">Stay focused and get things done</p>
        </div>
        <div className="header-accent">
          <Clock size={20} className="pulse" />
        </div>
      </div>
      <div className="header-divider"></div>
    </header>
  );
};

export default Header;