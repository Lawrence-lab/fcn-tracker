import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import FCNList from './components/FCNList';
import FCNForm from './components/FCNForm';
import HistoryLog from './components/HistoryLog';
import InterestCalendar from './components/InterestCalendar';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [fcns, setFcns] = useState([]);
  const [editingFcn, setEditingFcn] = useState(null);
  const [settlingFcn, setSettlingFcn] = useState(null);
  const [loading, setLoading] = useState(true);

  // Settlement modal states
  const [settleType, setSettleType] = useState('Knocked-Out');
  const [settleDate, setSettleDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalCoupons, setTotalCoupons] = useState('');
  const [selectedStockSymbol, setSelectedStockSymbol] = useState('');
  const [marketPriceSettle, setMarketPriceSettle] = useState('');
  const [settleNote, setSettleNote] = useState('');

  // Helper to prompt for admin password for modifying operations
  const verifyAdminPassword = () => {
    const pwd = prompt('🔒 請輸入管理密碼以執行此操作：');
    if (pwd === null) return null; // User clicked cancel
    if (pwd !== '970929') {
      alert('❌ 密碼錯誤，拒絕執行！');
      return null;
    }
    return pwd;
  };

  // Fetch FCNs
  const fetchFCNS = async () => {
    try {
      const response = await fetch('/api/fcns');
      const data = await response.json();
      if (Array.isArray(data)) {
        setFcns(data);
      }
    } catch (error) {
      console.error('Error fetching FCNs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFCNS();
  }, []);

  // Force price refresh
  const handleRefreshPrices = async () => {
    try {
      await fetch('/api/fcns/refresh', { method: 'POST' });
      await fetchFCNS();
    } catch (error) {
      console.error('Error refreshing prices:', error);
    }
  };

  // Create or Edit FCN submission
  const handleFormSubmit = async (payload) => {
    const pwd = verifyAdminPassword();
    if (!pwd) return;

    try {
      const url = editingFcn ? `/api/fcns/${editingFcn.id}` : '/api/fcns';
      const method = editingFcn ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Password': pwd
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setEditingFcn(null);
        setActiveTab('list');
        fetchFCNS();
      } else {
        const err = await response.json();
        alert(`儲存失敗: ${err.error || '不明錯誤'}`);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('網路連線失敗，請檢查後端是否啟動');
    }
  };

  // Delete FCN
  const handleDeleteFcn = async (id) => {
    const pwd = verifyAdminPassword();
    if (!pwd) return;

    try {
      const response = await fetch(`/api/fcns/${id}`, { 
        method: 'DELETE',
        headers: {
          'X-Admin-Password': pwd
        }
      });
      if (response.ok) {
        fetchFCNS();
      } else {
        const err = await response.json();
        alert(`刪除失敗: ${err.error || '不明錯誤'}`);
      }
    } catch (error) {
      console.error('Error deleting FCN:', error);
    }
  };

  // Open Edit Form
  const handleEditFcn = (fcn) => {
    setEditingFcn(fcn);
    setActiveTab('add');
  };

  // Open Settle Modal
  const handleOpenSettle = (fcn) => {
    setSettlingFcn(fcn);
    
    // Dynamically pre-select settlement type based on contract triggers
    if (fcn.isKoTriggered) {
      setSettleType('Knocked-Out');
    } else if (fcn.isKnockedIn) {
      setSettleType('Matured-Stock');
    } else {
      setSettleType('Matured-Cash');
    }

    setSettleDate(new Date().toISOString().split('T')[0]);
    setTotalCoupons('');
    setSettleNote('');
    setMarketPriceSettle('');
    if (fcn.stocks && fcn.stocks.length > 0) {
      setSelectedStockSymbol(fcn.stocks[0].symbol);
      // Pre-fill market price with current price if available
      setMarketPriceSettle(fcn.stocks[0].currentPrice || '');
    }
  };

  // Calculate default shares and strike when stock selection changes
  const getSelectedStockInfo = () => {
    if (!settlingFcn || !selectedStockSymbol) return null;
    return settlingFcn.stocks.find(s => s.symbol === selectedStockSymbol) || null;
  };

  const handleSettleStockChange = (symbol) => {
    setSelectedStockSymbol(symbol);
    if (!settlingFcn) return;
    const stock = settlingFcn.stocks.find(s => s.symbol === symbol);
    if (stock) {
      setMarketPriceSettle(stock.currentPrice || '');
    }
  };

  // Submit Settlement
  const handleSettleSubmit = async (e) => {
    e.preventDefault();
    if (!settlingFcn) return;

    const pwd = verifyAdminPassword();
    if (!pwd) return;

    const principal = Number(settlingFcn.principal) || 0;
    const couponsEarned = Number(totalCoupons) || 0;

    let settlementData = {
      settleDate,
      totalCouponsEarned: couponsEarned,
      note: settleNote
    };

    if (settleType === 'Matured-Stock') {
      const stock = getSelectedStockInfo();
      if (!stock) return alert('請選擇接股標的');
      if (!marketPriceSettle || Number(marketPriceSettle) <= 0) {
        return alert('請輸入結算收盤價');
      }

      const strikePrice = stock.initialPrice * (stock.strikePercent / 100);
      const sharesReceived = principal / strikePrice;
      const marketPrice = Number(marketPriceSettle);
      
      // Stock value loss/gain = (Market Price - Strike Price) * Shares
      const stockValueLoss = (marketPrice - strikePrice) * sharesReceived;
      const netProfit = stockValueLoss + couponsEarned;

      settlementData = {
        ...settlementData,
        stockSymbol: stock.symbol,
        stockName: stock.name,
        strikePrice,
        sharesReceived,
        marketPriceAtSettle: marketPrice,
        stockValueLoss,
        netProfit
      };
    } else {
      // For Cash maturity or Knock-out: Net Profit is just the coupons earned
      settlementData.netProfit = couponsEarned;
    }

    try {
      const response = await fetch(`/api/fcns/${settlingFcn.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Password': pwd
        },
        body: JSON.stringify({
          status: settleType,
          settlement: settlementData
        })
      });

      if (response.ok) {
        setSettlingFcn(null);
        setActiveTab('history');
        fetchFCNS();
      } else {
        const err = await response.json();
        alert(`辦理結算失敗: ${err.error || '不明錯誤'}`);
      }
    } catch (error) {
      console.error('Error settling FCN:', error);
      alert('連線失敗');
    }
  };

  return (
    <div className="app-container">
      <Navbar activeTab={activeTab} setActiveTab={(tab) => {
        if (tab !== 'add') setEditingFcn(null);
        setActiveTab(tab);
      }} />

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', color: 'var(--text-secondary)' }}>
          <div>讀取資料與股價數據中...</div>
        </div>
      ) : (
        <>
          {activeTab === 'dashboard' && <Dashboard fcns={fcns} />}
          
          {activeTab === 'list' && (
            <FCNList 
              fcns={fcns} 
              onEdit={handleEditFcn}
              onDelete={handleDeleteFcn}
              onSettle={handleOpenSettle}
              onRefresh={handleRefreshPrices}
            />
          )}

          {activeTab === 'add' && (
            <FCNForm 
              editingFcn={editingFcn}
              onSubmit={handleFormSubmit}
              onCancel={() => {
                setEditingFcn(null);
                setActiveTab('list');
              }}
            />
          )}

          {activeTab === 'interest' && (
            <InterestCalendar fcns={fcns} />
          )}

          {activeTab === 'history' && (
            <HistoryLog 
              fcns={fcns}
              onDelete={handleDeleteFcn}
            />
          )}
        </>
      )}

      {/* Settle Modal Dialogue */}
      {settlingFcn && (
        <div className="modal-overlay" onClick={() => setSettlingFcn(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>
              辦理商品結算平倉
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              商品名稱：<strong>{settlingFcn.name}</strong><br />
              原始本金：{settlingFcn.principal} {settlingFcn.currency}
            </p>

            <form onSubmit={handleSettleSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>結算類型</label>
                <select value={settleType} onChange={e => setSettleType(e.target.value)}>
                  <option value="Knocked-Out">提前敲出 (KO) 出場</option>
                  <option value="Matured-Cash">到期現金收回 (未曾觸及 KI 或回升)</option>
                  <option value="Matured-Stock">到期實物交割 (必須承接股票)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>結算日期</label>
                <input 
                  type="date" 
                  value={settleDate} 
                  onChange={e => setSettleDate(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>合約期間實收票息 (累計利息額)</label>
                <input 
                  type="number" 
                  placeholder="請輸入收到的利息總金額" 
                  value={totalCoupons} 
                  onChange={e => setTotalCoupons(e.target.value)}
                  required
                />
              </div>

              {settleType === 'Matured-Stock' && (
                <>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label>被強制接股標的 (最差股票)</label>
                    <select 
                      value={selectedStockSymbol} 
                      onChange={e => handleSettleStockChange(e.target.value)}
                    >
                      {settlingFcn.stocks.map(s => (
                        <option key={s.symbol} value={s.symbol}>{s.symbol} - {s.name}</option>
                      ))}
                    </select>
                  </div>

                  {(() => {
                    const stock = getSelectedStockInfo();
                    if (!stock) return null;
                    const strikePrice = stock.initialPrice * (stock.strikePercent / 100);
                    const shares = settlingFcn.principal / strikePrice;

                    return (
                      <div className="settle-info">
                        <strong>接股試算資訊：</strong><br />
                        • 期初定價：{stock.initialPrice} <br />
                        • 履約轉換價 ({stock.strikePercent}%)：{strikePrice.toFixed(2)} <br />
                        • 應交付股數：{shares.toFixed(2)} 股
                      </div>
                    );
                  })()}

                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label>結算基準日收盤價 (用於計算股票跌價損失)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      placeholder="請輸入結算當天股票收盤價格" 
                      value={marketPriceSettle} 
                      onChange={e => setMarketPriceSettle(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label>結算備註</label>
                <textarea 
                  rows="2"
                  placeholder="輸入此結算事件的細節描述..." 
                  value={settleNote} 
                  onChange={e => setSettleNote(e.target.value)}
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setSettlingFcn(null)}>
                  取消
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: 'var(--color-success)' }}>
                  確定平倉結算
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
