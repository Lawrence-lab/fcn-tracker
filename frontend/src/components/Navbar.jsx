import React from 'react';

export default function Navbar({ activeTab, setActiveTab }) {
  return (
    <nav className="navbar">
      <div className="brand-section">
        <div className="brand-logo">F</div>
        <div className="brand-name">FCN Portfolio Tracker</div>
      </div>
      <div className="nav-links">
        <button 
          className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          總覽儀表板
        </button>
        <button 
          className={`nav-item ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          未平倉商品
        </button>
        <button 
          className={`nav-item ${activeTab === 'interest' ? 'active' : ''}`}
          onClick={() => setActiveTab('interest')}
        >
          預期利息收入
        </button>
        <button 
          className={`nav-item ${activeTab === 'add' ? 'active' : ''}`}
          onClick={() => setActiveTab('add')}
        >
          新增 FCN
        </button>
        <button 
          className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          歷史平倉紀錄
        </button>
      </div>
    </nav>
  );
}
