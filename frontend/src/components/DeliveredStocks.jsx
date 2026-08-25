import React, { useState, useEffect } from 'react';

export default function DeliveredStocks() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [usdToTwd, setUsdToTwd] = useState(32.2);

  // Fetch exchange rate on mount
  useEffect(() => {
    fetch('/api/exchange-rate')
      .then(res => res.json())
      .then(data => {
        if (data && data.USDTWD) {
          setUsdToTwd(data.USDTWD);
        }
      })
      .catch(err => console.error('Failed to fetch exchange rate:', err));
  }, []);
  
  // Form Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [adminPassword, setAdminPassword] = useState('');

  // Custom delete password modal states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  
  // Form Fields
  const [fcnCode, setFcnCode] = useState('');
  const [isin, setIsin] = useState('');
  const [productType, setProductType] = useState('FCN');
  const [issuer, setIssuer] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [annualCouponRate, setAnnualCouponRate] = useState('');
  const [accruedDays, setAccruedDays] = useState('');
  const [totalDays, setTotalDays] = useState('');
  const [couponPerUnit, setCouponPerUnit] = useState('');
  const [finalValuationDate, setFinalValuationDate] = useState('');
  const [maturityDate, setMaturityDate] = useState('');
  const [stockName, setStockName] = useState('');
  const [stockSymbol, setStockSymbol] = useState('');
  const [stockCurrency, setStockCurrency] = useState('USD');
  const [valuationClosePrice, setValuationClosePrice] = useState('');
  const [strikePrice, setStrikePrice] = useState('');
  const [exchangeRate, setExchangeRate] = useState('1');
  const [deliveredShares, setDeliveredShares] = useState('');
  const [fractionalShares, setFractionalShares] = useState('');
  const [fractionalCash, setFractionalCash] = useState('');
  const [totalInterestReceived, setTotalInterestReceived] = useState('');
  const [note, setNote] = useState('');

  // Fetch all delivered stock positions
  const fetchList = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/delivered-stocks');
      if (response.ok) {
        const data = await response.json();
        setList(data);
      }
    } catch (err) {
      console.error('Error fetching delivered stocks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  // Calculate stats
  const totalCost = list.reduce((sum, item) => sum + (item.totalCost || 0), 0);
  const totalValue = list.reduce((sum, item) => sum + (item.currentValue || item.totalCost || 0), 0);
  const totalPnL = totalValue - totalCost;
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
  const totalCouponEarned = list.reduce((sum, item) => sum + (item.totalInterestReceived || 0), 0);
  
  // Calculate net overall P&L (PnL + Coupon)
  const totalNetOverallPnL = totalPnL + totalCouponEarned;
  const totalNetOverallPnLPct = totalCost > 0 ? (totalNetOverallPnL / totalCost) * 100 : 0;

  // Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stockSymbol || !strikePrice || !deliveredShares) {
      alert('請填寫必填欄位 (股票代號、每股成本、交收股數)');
      return;
    }

    const payload = {
      fcnCode,
      isin,
      productType,
      issuer,
      currency,
      annualCouponRate: annualCouponRate ? Number(annualCouponRate) : null,
      accruedDays: accruedDays ? Number(accruedDays) : null,
      totalDays: totalDays ? Number(totalDays) : null,
      couponPerUnit: couponPerUnit ? Number(couponPerUnit) : null,
      finalValuationDate,
      maturityDate,
      stockName,
      stockSymbol,
      stockCurrency,
      valuationClosePrice: valuationClosePrice ? Number(valuationClosePrice) : null,
      strikePrice: Number(strikePrice),
      exchangeRate: Number(exchangeRate) || 1,
      deliveredShares: Number(deliveredShares),
      fractionalShares: fractionalShares ? Number(fractionalShares) : null,
      fractionalCash: fractionalCash ? Number(fractionalCash) : null,
      totalInterestReceived: totalInterestReceived ? Number(totalInterestReceived) : 0,
      note
    };

    try {
      const url = editingItem 
        ? `/api/delivered-stocks/${editingItem.id}`
        : '/api/delivered-stocks';
      const method = editingItem ? 'PUT' : 'POST';

      const headers = { 'Content-Type': 'application/json' };
      if (adminPassword) {
        headers['X-Admin-Password'] = adminPassword;
      }

      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setIsModalOpen(false);
        setEditingItem(null);
        clearForm();
        fetchList();
      } else {
        const err = await response.json();
        alert(err.error || '儲存失敗，請檢查輸入資訊');
      }
    } catch (err) {
      alert('請求失敗: ' + err.message);
    }
  };

  // Open Edit Form
  const handleEdit = (item) => {
    setEditingItem(item);
    setFcnCode(item.fcnCode || '');
    setIsin(item.isin || '');
    setProductType(item.productType || 'FCN');
    setIssuer(item.issuer || '');
    setCurrency(item.currency || 'USD');
    setAnnualCouponRate(item.annualCouponRate !== null ? String(item.annualCouponRate) : '');
    setAccruedDays(item.accruedDays !== null ? String(item.accruedDays) : '');
    setTotalDays(item.totalDays !== null ? String(item.totalDays) : '');
    setCouponPerUnit(item.couponPerUnit !== null ? String(item.couponPerUnit) : '');
    setFinalValuationDate(item.finalValuationDate || '');
    setMaturityDate(item.maturityDate || '');
    setStockName(item.stockName || '');
    setStockSymbol(item.stockSymbol || '');
    setStockCurrency(item.stockCurrency || 'USD');
    setValuationClosePrice(item.valuationClosePrice !== null ? String(item.valuationClosePrice) : '');
    setStrikePrice(String(item.strikePrice || ''));
    setExchangeRate(String(item.exchangeRate || '1'));
    setDeliveredShares(String(item.deliveredShares || ''));
    setFractionalShares(item.fractionalShares !== null ? String(item.fractionalShares) : '');
    setFractionalCash(item.fractionalCash !== null ? String(item.fractionalCash) : '');
    setTotalInterestReceived(item.totalInterestReceived !== undefined ? String(item.totalInterestReceived) : '');
    setNote(item.note || '');
    setAdminPassword('');
    setIsModalOpen(true);
  };

  // Delete Item
  const handleDelete = (id) => {
    if (!window.confirm('確定要刪除此筆接股持倉紀錄嗎？此操作不可復原。')) {
      return;
    }
    setPendingDeleteId(id);
    setShowPasswordModal(true);
    setAdminPasswordInput('');
    setPasswordError('');
  };

  const handlePasswordModalSubmit = async (e) => {
    e.preventDefault();
    if (adminPasswordInput === '940929') {
      setShowPasswordModal(false);
      if (pendingDeleteId) {
        try {
          const response = await fetch(`/api/delivered-stocks/${pendingDeleteId}`, {
            method: 'DELETE',
            headers: { 'X-Admin-Password': '940929' }
          });
          if (response.ok) {
            fetchList();
          } else {
            const err = await response.json();
            alert(err.error || '刪除失敗，密碼錯誤或權限不足');
          }
        } catch (err) {
          alert('刪除請求失敗: ' + err.message);
        }
      }
    } else {
      setPasswordError('密碼錯誤，拒絕存取！');
    }
  };

  const clearForm = () => {
    setEditingItem(null);
    setFcnCode('');
    setIsin('');
    setProductType('FCN');
    setIssuer('');
    setCurrency('USD');
    setAnnualCouponRate('');
    setAccruedDays('');
    setTotalDays('');
    setCouponPerUnit('');
    setFinalValuationDate('');
    setMaturityDate('');
    setStockName('');
    setStockSymbol('');
    setStockCurrency('USD');
    setValuationClosePrice('');
    setStrikePrice('');
    setExchangeRate('1');
    setDeliveredShares('');
    setFractionalShares('');
    setFractionalCash('');
    setTotalInterestReceived('');
    setNote('');
    setAdminPassword('');
  };

  const formatCurrency = (val, dec = 2) => {
    if (val === null || val === undefined) return '--';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec
    }).format(val);
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Filter List
  const filteredList = list.filter(item => {
    const q = search.toLowerCase();
    return (
      (item.fcnCode || '').toLowerCase().includes(q) ||
      (item.stockSymbol || '').toLowerCase().includes(q) ||
      (item.stockName || '').toLowerCase().includes(q) ||
      (item.issuer || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="delivered-stocks-container">
      {/* 1. Header with Add Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 className="fcn-section-title" style={{ margin: 0 }}>接股持倉與到期明細</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            追蹤 FCN 到期後實物交割的股票資產，計算最新未實現損益。
          </p>
        </div>
        <button 
          className="action-btn edit" 
          style={{ padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
          onClick={() => {
            clearForm();
            setIsModalOpen(true);
          }}
        >
          ➕ 新增接股紀錄
        </button>
      </div>

      {/* 2. Premium Stat Cards */}
      <div className="stats-grid" style={{ marginBottom: '2rem' }}>
        <div className="glass-card stat-card">
          <div className="stat-label">當前持股總市值 (USD)</div>
          <div className="stat-value">${formatCurrency(totalValue, 2)}</div>
          <div className="stat-value-twd" style={{ fontSize: '0.85rem', color: '#c084fc', marginTop: '0.1rem', fontWeight: 600 }}>
            折合台幣: NT$ {formatCurrency(totalValue * usdToTwd, 0)}
          </div>
          <div className="stat-subtext" style={{ color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
            取得成本計：${formatCurrency(totalCost, 2)} (折合 NT$ {formatCurrency(totalCost * usdToTwd, 0)})
          </div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-label">未實現帳面損益 (USD)</div>
          <div className={`stat-value ${totalPnL >= 0 ? 'text-success' : 'text-danger'}`}>
            {totalPnL >= 0 ? '+' : ''}${formatCurrency(totalPnL, 2)}
          </div>
          <div className={`stat-value-twd ${totalPnL >= 0 ? 'text-success' : 'text-danger'}`} style={{ fontSize: '0.85rem', marginTop: '0.1rem', fontWeight: 600 }}>
            折合台幣: {totalPnL >= 0 ? '+' : ''}NT$ {formatCurrency(totalPnL * usdToTwd, 0)}
          </div>
          <div className={`stat-subtext ${totalPnL >= 0 ? 'text-success' : 'text-danger'}`} style={{ fontWeight: 600, marginTop: '0.4rem' }}>
            {totalPnL >= 0 ? '▲' : '▼'} {totalPnLPct.toFixed(2)}%
          </div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-label">累計已收利息總和 (USD)</div>
          <div className="stat-value" style={{ color: 'var(--color-gold)' }}>
            ${formatCurrency(totalCouponEarned, 2)}
          </div>
          <div className="stat-value-twd" style={{ fontSize: '0.85rem', color: 'var(--color-gold)', marginTop: '0.1rem', fontWeight: 600 }}>
            折合台幣: NT$ {formatCurrency(totalCouponEarned * usdToTwd, 0)}
          </div>
          <div className="stat-subtext" style={{ color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
            到期前已實現利息收益
          </div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-label">加計利息後總損益 (USD)</div>
          <div className={`stat-value ${totalNetOverallPnL >= 0 ? 'text-success' : 'text-danger'}`}>
            {totalNetOverallPnL >= 0 ? '+' : ''}${formatCurrency(totalNetOverallPnL, 2)}
          </div>
          <div className={`stat-value-twd ${totalNetOverallPnL >= 0 ? 'text-success' : 'text-danger'}`} style={{ fontSize: '0.85rem', marginTop: '0.1rem', fontWeight: 600 }}>
            折合台幣: {totalNetOverallPnL >= 0 ? '+' : ''}NT$ {formatCurrency(totalNetOverallPnL * usdToTwd, 0)}
          </div>
          <div className={`stat-subtext ${totalNetOverallPnL >= 0 ? 'text-success' : 'text-danger'}`} style={{ fontWeight: 600, marginTop: '0.4rem' }}>
            {totalNetOverallPnL >= 0 ? '▲' : '▼'} {totalNetOverallPnLPct.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* 3. Search Bar */}
      <div className="glass-card search-bar" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
        <input
          type="text"
          placeholder="搜尋商品代號、標的名稱、發行機構..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1,
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            padding: '0.6rem 1rem',
            color: 'var(--text-primary)',
            fontSize: '0.95rem'
          }}
        />
      </div>

      {/* 4. List View */}
      {loading ? (
        <div className="glass-card empty-state" style={{ padding: '4rem' }}>
          <div className="loading-spinner"></div>
          <p style={{ marginTop: '1rem' }}>正在載入實時股價與持倉資料...</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="glass-card empty-state" style={{ padding: '4rem' }}>
          <div className="empty-state-icon">📈</div>
          <p>尚無任何接股持倉紀錄。點擊右上方「新增接股紀錄」開始建立！</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredList.map(item => {
            const isExpanded = expandedId === item.id;
            const livePrice = item.currentPrice;
            const strike = item.strikePrice;
            const pctDiff = livePrice && strike ? ((livePrice - strike) / strike * 100) : null;
            
            return (
              <div 
                key={item.id} 
                className={`glass-card holding-card ${isExpanded ? 'active' : ''}`}
                style={{ 
                  borderLeft: `4px solid ${pctDiff !== null && pctDiff >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}`,
                  transition: 'var(--transition-normal)'
                }}
              >
                {/* Main Card Strip */}
                <div 
                  onClick={() => toggleExpand(item.id)}
                  style={{ 
                    padding: '1.2rem', 
                    display: 'grid', 
                    gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1.2fr 1.2fr auto', 
                    alignItems: 'center', 
                    cursor: 'pointer',
                    gap: '1rem'
                  }}
                >
                  {/* Stock Symbol & FCN Code */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {item.stockSymbol}
                      </span>
                      <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.08)', padding: '0.1rem 0.4rem', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                        {item.fcnCode || '自訂持倉'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      {item.stockName || '股票名稱'}
                    </div>
                  </div>

                  {/* Quantity & Strike */}
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>交收股數 / 成本</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600 }}>{formatCurrency(item.deliveredShares, 0)} 股</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>${formatCurrency(item.strikePrice, 4)}</div>
                  </div>

                  {/* Current Live Price */}
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>最新市價</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      ${formatCurrency(livePrice, 2)}
                    </div>
                    {pctDiff !== null && (
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: pctDiff >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {pctDiff >= 0 ? '▲' : '▼'} {pctDiff.toFixed(2)}%
                      </div>
                    )}
                  </div>

                  {/* Total Value */}
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>持股總市值</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600 }}>
                      ${formatCurrency(item.currentValue || item.totalCost, 2)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#c084fc', fontWeight: 500 }}>
                      NT$ {formatCurrency((item.currentValue || item.totalCost) * usdToTwd, 0)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      成本: ${formatCurrency(item.totalCost, 2)}
                    </div>
                  </div>

                  {/* Unrealized PnL & Coupon */}
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>帳面損益 / 已收利息</div>
                    <div style={{ 
                       fontSize: '0.95rem', 
                      fontWeight: 700, 
                      color: item.unrealizedPnL >= 0 ? 'var(--color-success)' : 'var(--color-danger)' 
                    }}>
                      {item.unrealizedPnL >= 0 ? '+' : ''}{formatCurrency(item.unrealizedPnL, 2)}
                    </div>
                    <div style={{ 
                      fontSize: '0.78rem', 
                      fontWeight: 600, 
                      color: item.unrealizedPnL >= 0 ? 'var(--color-success)' : 'var(--color-danger)' 
                    }}>
                      NT$ {item.unrealizedPnL >= 0 ? '+' : ''}{formatCurrency(item.unrealizedPnL * usdToTwd, 0)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-gold)', fontWeight: 600, marginTop: '0.2rem' }}>
                      利息: +{formatCurrency(item.totalInterestReceived || 0, 2)}
                    </div>
                  </div>

                  {/* Net PnL after Coupon */}
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>加計利息後淨損益</div>
                    <div style={{ 
                      fontSize: '1rem', 
                      fontWeight: 800, 
                      color: (item.netPnL !== null ? item.netPnL : (item.unrealizedPnL + (item.totalInterestReceived || 0))) >= 0 ? 'var(--color-success)' : 'var(--color-danger)' 
                    }}>
                      {(item.netPnL !== null ? item.netPnL : (item.unrealizedPnL + (item.totalInterestReceived || 0))) >= 0 ? '+' : ''}
                      {formatCurrency(item.netPnL !== null ? item.netPnL : (item.unrealizedPnL + (item.totalInterestReceived || 0)), 2)}
                    </div>
                    <div style={{ 
                      fontSize: '0.82rem', 
                      fontWeight: 700, 
                      color: (item.netPnL !== null ? item.netPnL : (item.unrealizedPnL + (item.totalInterestReceived || 0))) >= 0 ? 'var(--color-success)' : 'var(--color-danger)' 
                    }}>
                      NT$ {(item.netPnL !== null ? item.netPnL : (item.unrealizedPnL + (item.totalInterestReceived || 0))) >= 0 ? '+' : ''}
                      {formatCurrency((item.netPnL !== null ? item.netPnL : (item.unrealizedPnL + (item.totalInterestReceived || 0))) * usdToTwd, 0)}
                    </div>
                  </div>

                  {/* Expand arrow */}
                  <div style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>
                    {isExpanded ? '▲' : '▼'}
                  </div>
                </div>

                {/* Expanded Details Grid */}
                {isExpanded && (
                  <div style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.15)', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
                      {/* Left: Receipt Table Replication */}
                      <div>
                        <div style={{ 
                          border: '1px solid var(--border-color)', 
                          borderRadius: '8px', 
                          overflow: 'hidden', 
                          background: 'rgba(15,23,42,0.6)' 
                        }}>
                          <div style={{ 
                            background: 'rgba(6, 182, 212, 0.1)', 
                            padding: '0.6rem', 
                            textAlign: 'center', 
                            fontWeight: 700, 
                            borderBottom: '1px solid var(--border-color)',
                            fontSize: '0.95rem'
                          }}>
                            ({item.fcnCode || 'FCN'} 到期接股票明細)
                          </div>
                          
                          {/* Receipt Rows */}
                          {[
                            ['商品代號', item.fcnCode || '--', 'var(--color-primary)'],
                            ['到期型態', '到期接股票', 'var(--color-danger)', true],
                            ['ISIN', item.isin || '--'],
                            ['商品類型', item.productType || 'FCN'],
                            ['發行機構', item.issuer || '--'],
                            ['計價幣別', item.currency || 'USD'],
                            ['配息率(年率)', item.annualCouponRate !== null ? `${item.annualCouponRate}%` : '--'],
                            ['當期符合計息天數', item.accruedDays !== null ? `${item.accruedDays} 天` : '--'],
                            ['當期總天數', item.totalDays !== null ? `${item.totalDays} 天` : '--'],
                            ['每單位配息金額 (當期)', item.couponPerUnit !== null ? `$${formatCurrency(item.couponPerUnit, 2)} (折合 NT$ ${formatCurrency(item.couponPerUnit * usdToTwd, 0)})` : '--', 'var(--color-success)'],
                            ['FCN 期間已收利息總和', `$${formatCurrency(item.totalInterestReceived || 0, 2)} (折合 NT$ ${formatCurrency((item.totalInterestReceived || 0) * usdToTwd, 0)})`, 'var(--color-gold)', true],
                            ['最終評價日', item.finalValuationDate || '--'],
                            ['到期日', item.maturityDate || '--'],
                            ['是否轉換股票', '是', 'var(--color-danger)', true],
                            ['轉換股票名稱', item.stockName || '--'],
                            ['轉換股票代號', item.stockSymbol || '--'],
                            ['轉換股票幣別', item.stockCurrency || 'USD'],
                            ['最終評價日收盤價', item.valuationClosePrice !== null ? `$${formatCurrency(item.valuationClosePrice, 2)} (折合 NT$ ${formatCurrency(item.valuationClosePrice * usdToTwd, 0)})` : '--'],
                            ['交收股票執行價 (每股成本)', `$${formatCurrency(item.strikePrice, 4)} (折合 NT$ ${formatCurrency(item.strikePrice * usdToTwd, 2)})`],
                            ['匯率', item.exchangeRate || '1'],
                            ['每單位交收股數', `${formatCurrency(item.deliveredShares, 0)} 股`],
                            ['每單位零股', item.fractionalShares !== null ? formatCurrency(item.fractionalShares, 4) : '--'],
                            ['每單位零股折現(USD)', item.fractionalCash !== null ? `$${formatCurrency(item.fractionalCash, 2)} (折合 NT$ ${formatCurrency(item.fractionalCash * usdToTwd, 0)})` : '--', 'var(--color-success)']
                          ].map(([label, val, color, isBold], idx) => (
                            <div 
                              key={idx} 
                              style={{ 
                                display: 'flex', 
                                borderBottom: idx === 22 ? 'none' : '1px solid var(--border-color)',
                                fontSize: '0.85rem'
                              }}
                            >
                              <div style={{ 
                                width: '45%', 
                                padding: '0.45rem 0.8rem', 
                                background: 'rgba(255,255,255,0.03)', 
                                borderRight: '1px solid var(--border-color)',
                                color: 'var(--text-secondary)'
                              }}>
                                {label}
                              </div>
                              <div style={{ 
                                width: '55%', 
                                padding: '0.45rem 0.8rem', 
                                color: color || 'var(--text-primary)',
                                fontWeight: isBold || color ? 700 : 400
                              }}>
                                {val}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Right: Notes & Operations */}
                      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontWeight: 600 }}>持倉備註說明</h4>
                          <div style={{ 
                            background: 'rgba(0,0,0,0.2)', 
                            padding: '1rem', 
                            borderRadius: '6px', 
                            fontSize: '0.9rem', 
                            color: 'var(--text-secondary)',
                            lineHeight: '1.5',
                            minHeight: '100px'
                          }}>
                            {item.note || '無備註資訊。'}
                          </div>
                        </div>

                        {/* Operations Buttons */}
                        <div style={{ display: 'flex', gap: '0.8rem', marginTop: '2rem' }}>
                          <button className="action-btn edit" onClick={() => handleEdit(item)} style={{ flex: 1 }}>
                            編輯紀錄
                          </button>
                          <button className="action-btn delete" onClick={() => handleDelete(item.id)} style={{ flex: 1 }}>
                            刪除持倉
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Add / Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-card" style={{ maxWidth: '850px', width: '90%' }}>
            <div className="modal-header">
              <h3 className="modal-title">{editingItem ? '編輯接股持倉紀錄' : '新增接股持倉紀錄'}</h3>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
                
                {/* Section 1: 商品基本資訊 */}
                <h4 style={{ color: 'var(--color-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem', marginBottom: '0.8rem' }}>
                  一、商品與合約基本資訊
                </h4>
                <div className="form-grid" style={{ marginBottom: '1.5rem' }}>
                  <div className="form-group">
                    <label>商品代號 (必填)</label>
                    <input 
                      type="text" 
                      placeholder="例如: 2026SN0452"
                      value={fcnCode} 
                      onChange={e => setFcnCode(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label>ISIN 代碼</label>
                    <input 
                      type="text" 
                      placeholder="例如: XS3246581147"
                      value={isin} 
                      onChange={e => setIsin(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label>發行機構 (Issuer)</label>
                    <input 
                      type="text" 
                      placeholder="例如: Natixis / DBS"
                      value={issuer} 
                      onChange={e => setIssuer(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label>配息年率 (%)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      placeholder="例如: 29.16"
                      value={annualCouponRate} 
                      onChange={e => setAnnualCouponRate(e.target.value)} 
                    />
                  </div>
                </div>

                {/* Section 2: 到期與配息 */}
                <h4 style={{ color: 'var(--color-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem', marginBottom: '0.8rem' }}>
                  二、當期計息與天數明細
                </h4>
                <div className="form-grid" style={{ marginBottom: '1.5rem' }}>
                  <div className="form-group">
                    <label>符合計息天數</label>
                    <input 
                      type="number" 
                      placeholder="例如: 21"
                      value={accruedDays} 
                      onChange={e => setAccruedDays(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label>當期總天數</label>
                    <input 
                      type="number" 
                      placeholder="例如: 21"
                      value={totalDays} 
                      onChange={e => setTotalDays(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label>每單位配息金額 (USD)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      placeholder="例如: 243.00"
                      value={couponPerUnit} 
                      onChange={e => setCouponPerUnit(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label>最終評價日</label>
                    <input 
                      type="date" 
                      value={finalValuationDate} 
                      onChange={e => setFinalValuationDate(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label>到期日 / 交收日</label>
                    <input 
                      type="date" 
                      value={maturityDate} 
                      onChange={e => setMaturityDate(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label>FCN 期間已收利息總和 (USD)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      placeholder="例如: 14580.00"
                      value={totalInterestReceived} 
                      onChange={e => setTotalInterestReceived(e.target.value)} 
                    />
                  </div>
                </div>

                {/* Section 3: 股票交收明細 */}
                <h4 style={{ color: 'var(--color-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem', marginBottom: '0.8rem' }}>
                  三、轉換股票交收明細
                </h4>
                <div className="form-grid" style={{ marginBottom: '1.5rem' }}>
                  <div className="form-group">
                    <label>轉換股票代號 (必填)</label>
                    <input 
                      type="text" 
                      placeholder="例如: OKLO"
                      value={stockSymbol} 
                      onChange={e => setStockSymbol(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label>轉換股票名稱</label>
                    <input 
                      type="text" 
                      placeholder="例如: Oklo Inc"
                      value={stockName} 
                      onChange={e => setStockName(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label>最終評價日收盤價 (USD)</label>
                    <input 
                      type="number" 
                      step="0.0001" 
                      placeholder="例如: 41.22"
                      value={valuationClosePrice} 
                      onChange={e => setValuationClosePrice(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label>交收股票執行價 / 每股成本 (必填)</label>
                    <input 
                      type="number" 
                      step="0.0001" 
                      placeholder="例如: 53.5015"
                      value={strikePrice} 
                      onChange={e => setStrikePrice(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label>每單位交收股數 (必填)</label>
                    <input 
                      type="number" 
                      placeholder="例如: 186"
                      value={deliveredShares} 
                      onChange={e => setDeliveredShares(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label>每單位零股 (股數)</label>
                    <input 
                      type="number" 
                      step="0.0001" 
                      placeholder="例如: 0.9110"
                      value={fractionalShares} 
                      onChange={e => setFractionalShares(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label>每單位零股折現 (USD)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      placeholder="例如: 37.55"
                      value={fractionalCash} 
                      onChange={e => setFractionalCash(e.target.value)} 
                    />
                  </div>
                </div>

                {/* Section 4: 備註與權限 */}
                <h4 style={{ color: 'var(--color-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem', marginBottom: '0.8rem' }}>
                  四、備註與管理密碼
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '0.5rem' }}>
                  <div className="form-group">
                    <label>備註說明</label>
                    <textarea 
                      placeholder="可輸入交收原因、損益提醒等..."
                      value={note} 
                      onChange={e => setNote(e.target.value)}
                      style={{ 
                        width: '100%', 
                        minHeight: '80px',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        padding: '0.5rem 0.8rem',
                        color: 'var(--text-primary)',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                  <div className="form-group" style={{ maxWidth: '300px' }}>
                    <label>管理密碼 (送出驗證)</label>
                    <input 
                      type="password" 
                      placeholder="請輸入後台管理密碼"
                      value={adminPassword} 
                      onChange={e => setAdminPassword(e.target.value)} 
                    />
                  </div>
                </div>

              </div>

              <div className="modal-footer" style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" className="action-btn delete" onClick={() => setIsModalOpen(false)}>
                  取消
                </button>
                <button type="submit" className="action-btn edit">
                  儲存持倉
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Password Modal Dialogue for deletion */}
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
                      color: 'var(--text-primary)',
                      fontFamily: 'inherit'
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
