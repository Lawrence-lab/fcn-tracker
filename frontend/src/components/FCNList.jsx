import React, { useState } from 'react';

export default function FCNList({ fcns, onEdit, onDelete, onSettle, onRefresh }) {
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const activeFcns = fcns.filter(
    item => item.status === 'Active' && 
    (item.name.toLowerCase().includes(search.toLowerCase()) || 
     item.bank.toLowerCase().includes(search.toLowerCase()))
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setTimeout(() => setRefreshing(false), 800);
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const formatCurrency = (val, cur) => {
    return new Intl.NumberFormat('zh-TW', {
      style: 'currency',
      currency: cur,
      minimumFractionDigits: 0
    }).format(val);
  };

  const getStockPercentColor = (pct, ki, strike, ko) => {
    if (pct <= ki) return 'var(--color-danger)';
    if (pct < strike) return 'var(--color-warning)';
    if (pct >= ko) return 'var(--color-purple)';
    return 'var(--color-success)';
  };

  // Dynamic Stock Progress Slider Generator
  const renderStockGauge = (stock, isWorst) => {
    const { symbol, name, initialPrice, currentPrice, koPercent, kiPercent, strikePercent, currentPercent } = stock;

    if (currentPercent === null || currentPrice === null) {
      return (
        <div key={symbol} className="stock-detail-item">
          <div className="stock-detail-header">
            <div className="stock-ticker-info">
              <span className="stock-ticker-badge">{symbol}</span>
              <span className="stock-name-label">{name}</span>
            </div>
            <span style={{ color: 'var(--text-muted)' }}>暫無即時股價資料</span>
          </div>
        </div>
      );
    }

    // Auto-scale limits for the slider to fit all critical points nicely
    const minPercent = Math.min(50, currentPercent - 6, kiPercent - 6);
    const maxPercent = Math.max(112, currentPercent + 6, koPercent + 6);
    const rangeSpan = maxPercent - minPercent;

    const getLeft = (val) => {
      const pos = ((val - minPercent) / rangeSpan) * 100;
      return `${Math.max(0, Math.min(100, pos))}%`;
    };

    // Calculate absolute prices for badges
    const kiPrice = initialPrice * (kiPercent / 100);
    const strikePrice = initialPrice * (strikePercent / 100);
    const koPrice = initialPrice * (koPercent / 100);

    const priceChange = currentPrice - (stock.prevClose || initialPrice);
    const priceChangePct = (priceChange / (stock.prevClose || initialPrice)) * 100;

    // Group close milestones to prevent overlap (within 3%)
    const rawMarkers = [
      { key: 'ki', pct: kiPercent, price: kiPrice, name: 'KI' },
      { key: 'strike', pct: strikePercent, price: strikePrice, name: '履約' },
      { key: 'initial', pct: 100.0, price: initialPrice, name: '期初' },
      { key: 'ko', pct: koPercent, price: koPrice, name: 'KO' }
    ];

    // Sort by percentage
    rawMarkers.sort((a, b) => a.pct - b.pct);

    const mergedMarkers = [];
    rawMarkers.forEach(marker => {
      if (mergedMarkers.length === 0) {
        mergedMarkers.push({
          pctSum: marker.pct,
          count: 1,
          keys: [marker.key],
          names: [marker.name],
          prices: [marker.price],
          pcts: [marker.pct]
        });
      } else {
        const last = mergedMarkers[mergedMarkers.length - 1];
        const avgPct = last.pctSum / last.count;
        if (Math.abs(marker.pct - avgPct) < 3.0) {
          last.pctSum += marker.pct;
          last.count += 1;
          last.keys.push(marker.key);
          last.names.push(marker.name);
          last.prices.push(marker.price);
          last.pcts.push(marker.pct);
        } else {
          mergedMarkers.push({
            pctSum: marker.pct,
            count: 1,
            keys: [marker.key],
            names: [marker.name],
            prices: [marker.price],
            pcts: [marker.pct]
          });
        }
      }
    });

    return (
      <div key={symbol} className="stock-detail-item" style={{ borderLeft: isWorst ? '3px solid var(--color-danger)' : '1px solid var(--border-color)' }}>
        <div className="stock-detail-header">
          <div className="stock-ticker-info">
            <span className="stock-ticker-badge">{symbol}</span>
            <span className="stock-name-label">{name}</span>
            {isWorst && <span className="stock-worst-badge">Worst (綠角)</span>}
          </div>
          <div className="stock-price-info">
            <span className="stock-price-current">{currentPrice.toFixed(2)}</span>
            <span className={`stock-price-change ${priceChange >= 0 ? 'up' : 'down'}`}>
              {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChangePct).toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Custom CSS Gauge Slider */}
        <div className="gauge-container">
          <div className="gauge-line">
            {/* Background sections colored by risk zone */}
            <div 
              className="gauge-range ki-strike" 
              style={{ left: getLeft(minPercent), width: `calc(${getLeft(kiPercent)} - ${getLeft(minPercent)})` }}
            />
            <div 
              className="gauge-range strike-initial" 
              style={{ left: getLeft(kiPercent), width: `calc(${getLeft(strikePercent)} - ${getLeft(kiPercent)})` }}
            />
            <div 
              className="gauge-range initial-ko" 
              style={{ left: getLeft(strikePercent), width: `calc(${getLeft(koPercent)} - ${getLeft(strikePercent)})` }}
            />
            <div 
              className="gauge-range initial-ko" 
              style={{ left: getLeft(koPercent), width: `calc(${getLeft(maxPercent)} - ${getLeft(koPercent)})` }}
              style={{ opacity: 0.15, background: 'var(--color-purple)' }}
            />

            {/* Milestones marker dots */}
            {mergedMarkers.map((marker, idx) => {
              const avgPct = marker.pctSum / marker.count;
              const displayLabel = marker.count > 1 
                ? `${marker.names.join('/')} ${marker.pcts[0].toFixed(0)}% (${marker.prices[0].toFixed(1)})`
                : `${marker.names[0]} ${marker.pcts[0].toFixed(0)}% (${marker.prices[0].toFixed(1)})`;
              
              return (
                <div 
                  key={idx}
                  className={`gauge-point ${marker.keys[0]}`} 
                  style={{ left: getLeft(avgPct) }} 
                  data-label={displayLabel} 
                />
              );
            })}

            {/* Current Price Pin indicator */}
            <div className="gauge-marker-current" style={{ left: getLeft(currentPercent) }}>
              <div className={`gauge-marker-label ${currentPercent <= kiPercent ? 'danger' : ''}`}>
                當前 {currentPercent.toFixed(1)}%
              </div>
              <div className={`gauge-pin ${currentPercent <= kiPercent ? 'danger' : ''}`} />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStocksTable = (stocks, worstStockSymbol) => {
    return (
      <div className="stocks-table-wrapper">
        <table className="stocks-table">
          <thead>
            <tr>
              <th>標的</th>
              <th>期初參考價</th>
              <th>提前出場價 (KO)</th>
              <th>觸及生效價 (KI)</th>
              <th>執行價 (Strike)</th>
              <th>最新市價</th>
              <th style={{ textAlign: 'right' }}>當前幅度</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((stock) => {
              const { symbol, name, initialPrice, currentPrice, koPercent, kiPercent, strikePercent, currentPercent } = stock;
              const isWorst = symbol === worstStockSymbol;

              const kiPrice = initialPrice * (kiPercent / 100);
              const strikePrice = initialPrice * (strikePercent / 100);
              const koPrice = initialPrice * (koPercent / 100);

              return (
                <tr 
                  key={symbol} 
                  className={isWorst ? 'worst-row' : ''}
                >
                  <td>
                    <span className="stock-ticker-badge" style={{ marginRight: '0.5rem' }}>
                      {symbol}
                    </span>
                    <span className="stock-name-label">{name}</span>
                    {isWorst && <span className="stock-worst-badge" style={{ marginLeft: '0.5rem' }}>Worst</span>}
                  </td>
                  <td>{initialPrice.toFixed(4)}</td>
                  <td>{koPrice.toFixed(4)} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({koPercent}%)</span></td>
                  <td>
                    {kiPercent === 0 ? '0.0000' : kiPrice.toFixed(4)} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({kiPercent}%)</span>
                  </td>
                  <td>{strikePrice.toFixed(4)} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({strikePercent}%)</span></td>
                  <td style={{ color: currentPrice >= initialPrice ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600 }}>
                    {currentPrice !== null ? currentPrice.toFixed(4) : '讀取中...'}
                  </td>
                  <td style={{ textAlign: 'right', color: currentPercent >= 100 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600 }}>
                    {currentPercent !== null ? `${currentPercent.toFixed(2)}%` : '讀取中...'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="fcn-list-container">
      <div className="fcn-section-header">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <h2 className="fcn-section-title">未平倉商品列表</h2>
          <input 
            type="text" 
            placeholder="搜尋商品名稱或銀行..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', width: '220px', background: '#111827', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }}
          />
        </div>
        <button 
          className={`refresh-button ${refreshing ? 'spinning' : ''}`}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
          {refreshing ? '更新股價中...' : '同步最新股價'}
        </button>
      </div>

      {activeFcns.length === 0 ? (
        <div className="glass-card empty-state">
          <div className="empty-state-icon">📂</div>
          <h3>沒有找到未平倉的 FCN 商品</h3>
          <p>請點擊「新增 FCN」開始記錄您的第一張合約，或調整搜尋過濾條件。</p>
        </div>
      ) : (
        <div className="fcn-grid">
          {activeFcns.map((item) => {
            const isExpanded = expandedId === item.id;
            
            // Format observation details
            const worstStockText = item.worstStockSymbol 
              ? `${item.worstStockSymbol} (${item.worstStockPercent?.toFixed(1)}%)`
              : '無數據';

            return (
              <div 
                key={item.id} 
                className={`glass-card fcn-card ${isExpanded ? 'expanded' : ''}`}
                onClick={() => toggleExpand(item.id)}
              >
                {/* Header Row */}
                <div className="fcn-card-main">
                  <div className="fcn-info">
                    <div className="fcn-title">{item.name}</div>
                    <div className="fcn-meta">
                      <span className="fcn-meta-item">
                        🏢 {item.bank}
                      </span>
                      <span className="fcn-meta-item">•</span>
                      <span className="fcn-meta-item">
                        📅 到期日: {item.maturityDate}
                      </span>
                    </div>
                  </div>

                  <div className="fcn-val">
                    <span className="fcn-val-label">本金</span>
                    <span className="fcn-val-number">
                      {formatCurrency(item.principal, item.currency)}
                    </span>
                  </div>

                  <div className="fcn-val">
                    <span className="fcn-val-label">年化票息率</span>
                    <span className="fcn-val-number success">
                      {item.annualCouponRate}%
                    </span>
                  </div>

                  <div className="fcn-val">
                    <span className="fcn-val-label">最差標的</span>
                    <span className={`fcn-val-number ${item.worstStockPercent <= item.stocks?.[0]?.kiPercent ? 'danger' : item.worstStockPercent < item.stocks?.[0]?.strikePercent ? 'warning' : ''}`}>
                      {worstStockText}
                    </span>
                  </div>

                  <div className="fcn-val">
                    <span className="fcn-val-label">狀態</span>
                    <span className={`fcn-badge ${item.isKoTriggered ? 'ko-triggered' : item.isKnockedIn ? 'stock' : 'active'}`}>
                      {item.isKoTriggered ? '🌟 已達 KO 條件' : item.isKnockedIn ? '已觸及 KI ⚠️' : '觀察中'}
                    </span>
                  </div>

                  <div className="fcn-expand-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>

                {/* Collapsed Detailed Section */}
                {isExpanded && (
                  <div className="fcn-details" onClick={(e) => e.stopPropagation()}>
                    <div className="fcn-details-grid">
                      {/* Left: Stocks Details */}
                      <div className="stocks-section">
                        <h4 style={{ fontWeight: 600, fontSize: '0.95rem' }}>連結標的表現 (依期初價 100% 計算)</h4>
                        {item.stocks.map((stock) => 
                          renderStockGauge(stock, stock.symbol === item.worstStockSymbol)
                        )}
                        {renderStocksTable(item.stocks, item.worstStockSymbol)}
                      </div>

                      {/* Right: Contract summary Details */}
                      <div className="contract-details-pane">
                        <h4 className="contract-pane-title">合約詳細條款</h4>
                        <div className="detail-row">
                          <span className="label">交易日期</span>
                          <span className="val">{item.tradeDate || '無'}</span>
                        </div>
                        <div className="detail-row">
                          <span className="label">起息日期</span>
                          <span className="val">{item.startDate || '無'}</span>
                        </div>
                        <div className="detail-row">
                          <span className="label">到期日期</span>
                          <span className="val">{item.maturityDate || '無'}</span>
                        </div>
                        <div className="detail-row">
                          <span className="label">配息頻率</span>
                          <span className="val">{item.couponFrequency === 'Monthly' ? '每月配息' : item.couponFrequency === 'Quarterly' ? '每季配息' : '到期一次配息'}</span>
                        </div>
                        {item.couponPaymentDates && item.couponPaymentDates.length > 0 && (
                          <div className="detail-row" style={{ flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
                            <span className="label">約定配息日列表</span>
                            <span className="val" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)', padding: '0.4rem', borderRadius: '6px', lineHeight: '1.4' }}>
                              {item.couponPaymentDates.join(', ')}
                            </span>
                          </div>
                        )}
                        <div className="detail-row">
                          <span className="label">觀察頻率</span>
                          <span className="val">{item.observationFrequency === 'Monthly' ? '每月觀察' : '每季觀察'}</span>
                        </div>
                        <div className="detail-row" style={{ flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}>
                          <span className="label">備註說明</span>
                          <span className="val" style={{ color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '6px', fontSize: '0.85rem' }}>
                            {item.note || '無備註資訊。'}
                          </span>
                        </div>

                        {/* Card Operations */}
                        <div className="card-actions">
                          <button className="action-btn edit" onClick={() => onEdit(item)}>
                            編輯條款
                          </button>
                          <button className="action-btn delete" onClick={() => {
                            if(window.confirm(`確定要刪除「${item.name}」嗎？此操作不可復原。`)) {
                              onDelete(item.id);
                            }
                          }}>
                            刪除商品
                          </button>
                          <button className={`action-btn settle ${item.isKoTriggered ? 'ko-highlight' : ''}`} onClick={() => onSettle(item)}>
                            {item.isKoTriggered ? '⚡ 辦理敲出結算' : '辦理結算平倉'}
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
    </div>
  );
}
