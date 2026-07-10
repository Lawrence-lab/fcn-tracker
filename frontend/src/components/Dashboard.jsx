import React from 'react';

export default function Dashboard({ fcns }) {
  const activeFcns = fcns.filter(item => item.status === 'Active');
  
  // Calculate capital totals by currency
  const totals = activeFcns.reduce((acc, curr) => {
    const currency = curr.currency || 'USD';
    const principal = Number(curr.principal) || 0;
    acc[currency] = (acc[currency] || 0) + principal;
    return acc;
  }, {});

  // Calculate weighted average coupon rate
  const totalPrincipalUSD = activeFcns.filter(f => f.currency === 'USD').reduce((sum, f) => sum + (Number(f.principal) || 0), 0);
  const totalPrincipalTWD = activeFcns.filter(f => f.currency === 'TWD').reduce((sum, f) => sum + (Number(f.principal) || 0), 0);
  
  let averageCoupon = 0;
  if (activeFcns.length > 0) {
    const sumCoupons = activeFcns.reduce((sum, f) => sum + (Number(f.annualCouponRate) || 0), 0);
    averageCoupon = sumCoupons / activeFcns.length;
  }

  // Count special states
  const kiCount = activeFcns.filter(f => f.isKnockedIn).length;
  
  // Identify high risk items (stocks with distance to KI <= 5% and not yet knocked in, or already knocked in)
  const dangerStocks = [];
  activeFcns.forEach(fcn => {
    if (!fcn.stocks) return;
    fcn.stocks.forEach(stock => {
      if (stock.currentPercent !== null) {
        const distToKi = stock.currentPercent - stock.kiPercent;
        // In danger if already KI-ed or if within 5% of KI barrier
        if (fcn.isKnockedIn && stock.currentPercent <= stock.kiPercent) {
          dangerStocks.push({
            fcnId: fcn.id,
            fcnName: fcn.name,
            symbol: stock.symbol,
            stockName: stock.name,
            currentPercent: stock.currentPercent,
            kiPercent: stock.kiPercent,
            distToKi: distToKi,
            status: '已敲入 (Breached KI)'
          });
        } else if (distToKi <= 5 && distToKi > 0) {
          dangerStocks.push({
            fcnId: fcn.id,
            fcnName: fcn.name,
            symbol: stock.symbol,
            stockName: stock.name,
            currentPercent: stock.currentPercent,
            kiPercent: stock.kiPercent,
            distToKi: distToKi,
            status: `接近敲入點 (僅差 ${distToKi.toFixed(2)}%)`
          });
        }
      }
    });
  });

  const formatCurrency = (val, cur) => {
    return new Intl.NumberFormat('zh-TW', {
      style: 'currency',
      currency: cur,
      minimumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="dashboard-container">
      {/* Risk Warning Center */}
      {dangerStocks.length > 0 && (
        <div className="alerts-section">
          <div className="alerts-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span>高風險標的警報中心 ({dangerStocks.length})</span>
          </div>
          <div className="alerts-list">
            {dangerStocks.map((item, idx) => (
              <div key={`${item.fcnId}-${item.symbol}-${idx}`} className="alert-item">
                <div>
                  <span className="alert-name">{item.fcnName}</span>
                  <span style={{ margin: '0 0.5rem', color: 'var(--text-muted)' }}>|</span>
                  <span>標的：</span>
                  <span className="alert-stock-badge">{item.symbol} {item.stockName}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span>當前價位：<strong>{item.currentPercent?.toFixed(2)}%</strong></span>
                  <span>(KI 門檻: {item.kiPercent}%)</span>
                  <span style={{ 
                    color: item.status.includes('已') ? 'var(--color-danger)' : 'var(--color-warning)',
                    fontWeight: 700
                  }}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Summary Grid */}
      <div className="dashboard-grid">
        <div className="glass-card stat-card">
          <span className="stat-label">美元未平倉本金</span>
          <span className="stat-value">
            {formatCurrency(totals['USD'] || 0, 'USD')}
          </span>
        </div>

        <div className="glass-card stat-card">
          <span className="stat-label">台幣未平倉本金</span>
          <span className="stat-value">
            {formatCurrency(totals['TWD'] || 0, 'TWD')}
          </span>
        </div>

        <div className="glass-card stat-card success">
          <span className="stat-label">平均年化收益率</span>
          <span className="stat-value">
            {averageCoupon.toFixed(2)}%
          </span>
        </div>

        <div className="glass-card stat-card warning">
          <span className="stat-label">未平倉商品總數</span>
          <span className="stat-value">
            {activeFcns.length} <span className="stat-value-sub">檔</span>
          </span>
        </div>

        <div className="glass-card stat-card danger">
          <span className="stat-label">已觸及敲入 (KI) 商品</span>
          <span className="stat-value">
            {kiCount} <span className="stat-value-sub">檔</span>
          </span>
        </div>
      </div>

      {/* Helpful educational info in nice clean presentation */}
      <div className="glass-card" style={{ marginTop: '2rem', borderLeft: '4px solid var(--color-primary)' }}>
        <h3 style={{ marginBottom: '0.75rem', fontWeight: 600 }}>💡 FCN 小知識小工具</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
          <strong>Fixed Coupon Note (FCN)</strong> 是一種「賣出賣權 (Sell Put)」結合「固定配息」的結構型商品。<br />
          只要連結的所有標的股價<strong>未曾跌破敲入價 (KI)</strong> 且<strong>未提前敲出 (KO)</strong>，投資人便可領回全額本金與高額利息。<br />
          若任何一檔標的在存續期間跌破 KI，且到期時未能回升至履約價 (Strike) 以上，投資人必須以履約價<strong>強制買入表現最差的那檔股票 (Worst-Of)</strong>，可能會面臨較大的本金損失。
        </p>
      </div>
    </div>
  );
}
