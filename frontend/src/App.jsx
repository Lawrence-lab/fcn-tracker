import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import FCNList from './components/FCNList';
import FCNForm from './components/FCNForm';
import HistoryLog from './components/HistoryLog';
import InterestCalendar from './components/InterestCalendar';
import DeliveredStocks from './components/DeliveredStocks';

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

  // Admin password modal states
  const [pendingAction, setPendingAction] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const requestAdminPassword = (action) => {
    setPendingAction(() => action);
    setShowPasswordModal(true);
    setAdminPasswordInput('');
    setPasswordError('');
  };

  const handlePasswordModalSubmit = (e) => {
    e.preventDefault();
    if (adminPasswordInput === '940929') {
      setShowPasswordModal(false);
      if (pendingAction) {
        pendingAction();
      }
    } else {
      setPasswordError('密碼錯誤，拒絕存取！');
    }
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

  // Send test LINE message
  const handleTestLine = async () => {
    try {
      const response = await fetch('/api/fcns/test-line', { method: 'POST' });
      if (response.ok) {
        alert('✅ 測試訊息已送出！請檢查您的手機 LINE 是否有收到「測試成功」訊息。');
      } else {
        const err = await response.json();
        alert(`❌ 測試失敗: ${err.error || '未設定環境變數'}`);
      }
    } catch (error) {
      console.error('Error testing LINE connection:', error);
      alert('❌ 連線失敗，請檢查本機後端伺服器是否正常啟動。');
    }
  };

  // Create or Edit FCN submission
  const handleFormSubmit = async (payload) => {
    requestAdminPassword(async () => {
      try {
        const url = editingFcn ? `/api/fcns/${editingFcn.id}` : '/api/fcns';
        const method = editingFcn ? 'PUT' : 'POST';

        const response = await fetch(url, {
          method,
          headers: { 
            'Content-Type': 'application/json',
            'X-Admin-Password': '940929'
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const wasSettled = editingFcn && editingFcn.status !== 'Active';
          setEditingFcn(null);
          setActiveTab(wasSettled ? 'history' : 'list');
          fetchFCNS();
        } else {
          const err = await response.json();
          alert(`儲存失敗: ${err.error || '不明錯誤'}`);
        }
      } catch (error) {
        console.error('Error submitting form:', error);
        alert('網路連線失敗，請檢查後端是否啟動');
      }
    });
  };

  // Delete FCN
  const handleDeleteFcn = async (id) => {
    requestAdminPassword(async () => {
      try {
        const response = await fetch(`/api/fcns/${id}`, { 
          method: 'DELETE',
          headers: {
            'X-Admin-Password': '940929'
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
    });
  };

  // Open Edit Form
  const handleEditFcn = (fcn) => {
    setEditingFcn(fcn);
    setActiveTab('add');
  };

  // Helper to calculate estimated coupons
  const calculateEstimatedInterest = (fcn, dateStr) => {
    if (!fcn || !dateStr) return 0;
    const principal = Number(fcn.principal) || 0;
    const rate = Number(fcn.annualCouponRate) || 0;
    const singleCoupon = (principal * (rate / 100)) / 12;

    const dStart = new Date(fcn.startDate);
    const dSettle = new Date(dateStr);
    if (dSettle < dStart) return 0;

    let count = 1;
    if (fcn.couponPaymentDates && fcn.couponPaymentDates.length > 0) {
      const sorted = [...fcn.couponPaymentDates].sort((a,b) => new Date(a) - new Date(b));
      for (let i = 0; i < sorted.length - 1; i++) {
        const dCoupon = new Date(sorted[i]);
        if (dSettle >= dCoupon) {
          count++;
        } else {
          break;
        }
      }
    } else {
      const yearDiff = dSettle.getFullYear() - dStart.getFullYear();
      const monthDiff = dSettle.getMonth() - dStart.getMonth();
      count = Math.max(1, yearDiff * 12 + monthDiff + 1);
    }
    
    return Math.round(count * singleCoupon * 100) / 100;
  };

  const handleSettleDateChange = (date) => {
    setSettleDate(date);
    if (settlingFcn) {
      const estInterest = calculateEstimatedInterest(settlingFcn, date);
      setTotalCoupons(estInterest > 0 ? String(estInterest) : '');
    }
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

    const initialDate = new Date().toISOString().split('T')[0];
    setSettleDate(initialDate);
    
    const estInterest = calculateEstimatedInterest(fcn, initialDate);
    setTotalCoupons(estInterest > 0 ? String(estInterest) : '');

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

    // Validate stock and price if it is stock settlement BEFORE password prompt
    if (settleType === 'Matured-Stock') {
      const stock = getSelectedStockInfo();
      if (!stock) return alert('請選擇接股標的');
      if (!marketPriceSettle || Number(marketPriceSettle) <= 0) {
        return alert('請輸入結算收盤價');
      }
    }

    requestAdminPassword(async () => {
      const principal = Number(settlingFcn.principal) || 0;
      const couponsEarned = Number(totalCoupons) || 0;

      let settlementData = {
        settleDate,
        totalCouponsEarned: couponsEarned,
        note: settleNote
      };

      if (settleType === 'Matured-Stock') {
        const stock = getSelectedStockInfo();
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
            'X-Admin-Password': '940929'
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
    });
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
                const wasSettled = editingFcn && editingFcn.status !== 'Active';
                setEditingFcn(null);
                setActiveTab(wasSettled ? 'history' : 'list');
              }}
            />
          )}

          {activeTab === 'interest' && (
            <InterestCalendar fcns={fcns} />
          )}

          {activeTab === 'delivered' && (
            <DeliveredStocks />
          )}

          {activeTab === 'history' && (
            <HistoryLog 
              fcns={fcns}
              onRefresh={fetchFCNS}
              onEdit={handleEditFcn}
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
                  onChange={e => handleSettleDateChange(e.target.value)} 
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

      {/* Admin Password Modal Dialogue */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content glass-card" style={{ maxWidth: '400px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">🔒 需要管理權限</h3>
              <button className="close-btn" onClick={() => setShowPasswordModal(false)}>×</button>
            </div>
            
            <form onSubmit={handlePasswordModalSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
                <div className="form-group">
                  <label>管理者密碼</label>
                  <input 
                    type="password" 
                    placeholder="請輸入管理密碼以確認此操作" 
                    value={adminPasswordInput}
                    onChange={e => setAdminPasswordInput(e.target.value)}
                    required
                    autoFocus
                    style={{
                      width: '100%',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      padding: '0.6rem 0.8rem',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>
                
                {passwordError && (
                  <div style={{ color: 'var(--color-danger)', fontSize: '0.88rem', fontWeight: 500 }}>
                    ⚠️ {passwordError}
                  </div>
                )}
              </div>
              
              <div className="modal-footer" style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" className="action-btn delete" onClick={() => setShowPasswordModal(false)}>
                  取消
                </button>
                <button type="submit" className="action-btn edit">
                  確認執行
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
