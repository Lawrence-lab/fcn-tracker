import React, { useState } from 'react';

export default function HistoryLog({ fcns, onEdit, onDelete }) {
  const [search, setSearch] = useState('');
  const [selectedOwner, setSelectedOwner] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const settledFcns = fcns.filter(item => item.status !== 'Active');

  const allOwners = Array.from(new Set(settledFcns.map(f => (f.owner || '').trim()).filter(Boolean)));

  const formatCurrency = (val, cur) => {
    return new Intl.NumberFormat('zh-TW', {
      style: 'currency',
      currency: cur,
      minimumFractionDigits: 0
    }).format(val);
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'Knocked-Out':
        return { text: '提前敲出 (KO) 結束', class: 'knocked-out' };
      case 'Matured-Cash':
        return { text: '到期現金收回', class: 'cash' };
      case 'Matured-Stock':
        return { text: '到期接股交割', class: 'stock' };
      default:
        return { text: '已平倉', class: 'active' };
    }
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Filter List
  const filteredList = settledFcns.filter(item => {
    const q = search.toLowerCase();
    const matchOwner = selectedOwner === 'all' || (item.owner || '').trim() === selectedOwner;
    return matchOwner && (
      (item.name || '').toLowerCase().includes(q) ||
      (item.bank || '').toLowerCase().includes(q) ||
      (item.owner || '').toLowerCase().includes(q) ||
      (item.note || '').toLowerCase().includes(q) ||
      (item.settlement?.note || '').toLowerCase().includes(q)
    );
  });

  const renderStocksTable = (stocks, worstStockSymbol) => {
    if (!stocks || !Array.isArray(stocks)) return null;

    const formatPrice = (val, dec = 4) => {
      if (val === null || val === undefined || typeof val !== 'number') return '--';
      return val.toFixed(dec);
    };

    return (
      <div className="stocks-table-wrapper" style={{ marginTop: '1rem' }}>
        <table className="stocks-table" style={{ fontSize: '0.85rem' }}>
          <thead>
            <tr>
              <th>標的</th>
              <th>期初參考價</th>
              <th>提前出場價 (KO)</th>
              <th>觸及生效價 (KI)</th>
              <th>執行價 (Strike)</th>
              <th>結算收盤價</th>
              <th style={{ textAlign: 'right' }}>結算幅度</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((stock) => {
              const { symbol, name, initialPrice, currentPrice, koPercent, kiPercent, strikePercent, currentPercent } = stock;
              const isWorst = symbol === worstStockSymbol;

              const kiPrice = (typeof initialPrice === 'number' && typeof kiPercent === 'number') ? (initialPrice * (kiPercent / 100)) : null;
              const strikePrice = (typeof initialPrice === 'number' && typeof strikePercent === 'number') ? (initialPrice * (strikePercent / 100)) : null;
              const koPrice = (typeof initialPrice === 'number' && typeof koPercent === 'number') ? (initialPrice * (koPercent / 100)) : null;

              return (
                <tr key={symbol} className={isWorst ? 'worst-row' : ''}>
                  <td>
                    <span className="stock-ticker-badge" style={{ marginRight: '0.5rem' }}>
                      {symbol}
                    </span>
                    <span className="stock-name-label">{name}</span>
                    {isWorst && <span className="stock-worst-badge" style={{ marginLeft: '0.5rem' }}>Worst</span>}
                  </td>
                  <td>{formatPrice(initialPrice, 4)}</td>
                  <td>
                    {koPrice !== null ? formatPrice(koPrice, 4) : '--'}
                    {typeof koPercent === 'number' && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}> ({koPercent}%)</span>}
                  </td>
                  <td>
                    {kiPrice !== null ? (kiPercent === 0 ? '0.0000' : formatPrice(kiPrice, 4)) : '--'}
                    {typeof kiPercent === 'number' && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}> ({kiPercent}%)</span>}
                  </td>
                  <td>
                    {strikePrice !== null ? formatPrice(strikePrice, 4) : '--'}
                    {typeof strikePercent === 'number' && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}> ({strikePercent}%)</span>}
                  </td>
                  <td style={{ color: currentPrice >= initialPrice ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600 }}>
                    {formatPrice(currentPrice, 4)}
                  </td>
                  <td style={{ textAlign: 'right', color: currentPercent >= 100 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600 }}>
                    {typeof currentPercent === 'number' ? `${currentPercent.toFixed(2)}%` : '--'}
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
    <div className="history-log-container">
      <div className="fcn-section-header">
        <h2 className="fcn-section-title">歷史平倉與到期紀錄</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
          查閱已平倉、提前敲出 (KO) 或到期交割的合約完整詳細條款與結算紀錄。
        </p>
      </div>

      {/* Search & Filter Bar */}
      {settledFcns.length > 0 && (
        <div className="glass-card search-bar" style={{ padding: '0.8rem 1rem', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="搜尋已到期合約名稱、發行機構、擁有者、備註..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1,
              minWidth: '220px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '0.6rem 1rem',
              color: 'var(--text-primary)',
              fontSize: '0.95rem'
            }}
          />
          {allOwners.length > 0 && (
            <select
              value={selectedOwner}
              onChange={(e) => setSelectedOwner(e.target.value)}
              style={{
                padding: '0.6rem 1rem',
                fontSize: '0.9rem',
                background: '#111827',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: '#38bdf8',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <option value="all">全部擁有者 ({settledFcns.length})</option>
              {allOwners.map(ownerName => (
                <option key={ownerName} value={ownerName}>👤 {ownerName}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {settledFcns.length === 0 ? (
        <div className="glass-card empty-state">
          <div className="empty-state-icon">📋</div>
          <h3>尚無歷史平倉紀錄</h3>
          <p>當您將未平倉的商品辦理結算平倉後，結算明細與合約條款會歸檔於此處。</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="glass-card empty-state">
          <div className="empty-state-icon">🔍</div>
          <h3>沒有符合搜尋條件的合約</h3>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {filteredList.map((item) => {
            const isExpanded = expandedId === item.id;
            const statusMeta = getStatusLabel(item.status);
            const settle = item.settlement || {};
            const totalProfit = Number(settle.netProfit) || 0;

            return (
              <div 
                key={item.id} 
                className={`glass-card holding-card ${isExpanded ? 'active' : ''}`}
                style={{ transition: 'var(--transition-normal)' }}
              >
                {/* Header Summary Strip */}
                <div 
                  onClick={() => toggleExpand(item.id)}
                  style={{ 
                    padding: '1.25rem', 
                    display: 'grid', 
                    gridTemplateColumns: '2fr 1fr 1fr 1fr auto', 
                    alignItems: 'center', 
                    cursor: 'pointer',
                    gap: '1rem'
                  }}
                >
                  {/* Name and Bank */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {item.name}
                      </span>
                      {item.owner && (
                        <span style={{ fontSize: '0.72rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.12)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.25)', fontWeight: 600 }}>
                          👤 {item.owner}
                        </span>
                      )}
                      <span className={`fcn-badge ${statusMeta.class}`} style={{ padding: '0.15rem 0.5rem', fontSize: '0.7rem' }}>
                        {statusMeta.text}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      發行機構 / 銀行: {item.bank}
                    </div>
                  </div>

                  {/* Principal */}
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>原始本金</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600 }}>
                      {formatCurrency(item.principal, item.currency)}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      利率: {item.annualCouponRate}%
                    </div>
                  </div>

                  {/* Coupons */}
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>累計實收票息</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-success)' }}>
                      {formatCurrency(settle.totalCouponsEarned || 0, item.currency)}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      到期日: {item.maturityDate}
                    </div>
                  </div>

                  {/* Profit/Loss */}
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>結算淨損益</div>
                    <div style={{ 
                      fontSize: '1.05rem', 
                      fontWeight: 700, 
                      color: totalProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' 
                    }}>
                      {totalProfit >= 0 ? '+' : ''}{formatCurrency(totalProfit, item.currency)}
                    </div>
                  </div>

                  {/* Expand arrow */}
                  <div style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>
                    {isExpanded ? '▲' : '▼'}
                  </div>
                </div>

                {/* Expanded Details Pane */}
                {isExpanded && (
                  <div style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.15)', borderTop: '1px solid var(--border-color)' }}>
                    
                    {/* Section 1: Stocks Table */}
                    <div>
                      <h4 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '0.5rem' }}>到期評價標的明細</h4>
                      {renderStocksTable(item.stocks, item.worstStockSymbol)}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', marginTop: '1.5rem' }}>
                      {/* Left: Contract Info Pane */}
                      <div className="contract-details-pane" style={{ padding: 0, background: 'none', border: 'none' }}>
                        <h4 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '0.5rem' }}>原始合約詳細條款</h4>
                        <div className="detail-row">
                          <span className="label">合約擁有者</span>
                          <span className="val" style={{ color: '#38bdf8', fontWeight: 600 }}>{item.owner ? `👤 ${item.owner}` : '本人 / 未設定'}</span>
                        </div>
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
                          <span className="label">合約備註</span>
                          <span className="val" style={{ color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '6px', fontSize: '0.85rem' }}>
                            {item.note || '無'}
                          </span>
                        </div>
                      </div>

                      {/* Right: Settle Slip & Action */}
                      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <h4 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '0.5rem' }}>合約平倉結算報告</h4>
                          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>結算日期：</span>
                              <span style={{ fontWeight: 600 }}>{settle.settleDate || '無'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>結算型態：</span>
                              <span style={{ fontWeight: 600, color: statusMeta.class === 'stock' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                                {statusMeta.text}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>實收利息總計：</span>
                              <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>
                                {formatCurrency(settle.totalCouponsEarned || 0, item.currency)}
                              </span>
                            </div>
                            {item.status === 'Matured-Stock' && (
                              <>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>接股標的與股數：</span>
                                  <span style={{ fontWeight: 600 }}>
                                    {settle.stockSymbol} ({typeof settle.sharesReceived === 'number' ? settle.sharesReceived.toFixed(4) : '--'} 股)
                                  </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>接股履約執行價：</span>
                                  <span style={{ fontWeight: 600 }}>${settle.strikePrice}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>結算評價日收盤價：</span>
                                  <span style={{ fontWeight: 600 }}>${settle.marketPriceAtSettle}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>股票市值差額損失：</span>
                                  <span style={{ fontWeight: 600, color: 'var(--color-danger)' }}>
                                    {formatCurrency(settle.stockValueLoss || 0, item.currency)}
                                  </span>
                                </div>
                              </>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.25rem', fontSize: '0.95rem' }}>
                              <span style={{ fontWeight: 700 }}>結算淨損益：</span>
                              <span style={{ fontWeight: 800, color: totalProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                {totalProfit >= 0 ? '+' : ''}{formatCurrency(totalProfit, item.currency)}
                              </span>
                            </div>
                          </div>
                          
                          {settle.note && (
                            <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px dashed rgba(245,158,11,0.2)', padding: '0.75rem', borderRadius: '6px', marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              <strong>結算備註：</strong>{settle.note}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '2rem' }}>
                          <button 
                            className="action-btn edit"
                            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}
                            onClick={() => onEdit && onEdit(item)}
                          >
                            ✏️ 編輯條款 / 擁有者
                          </button>
                          <button 
                            className="action-btn delete"
                            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}
                            onClick={() => {
                              if(window.confirm('確定要永久刪除此歷史結算紀錄嗎？')) {
                                onDelete(item.id);
                              }
                            }}
                          >
                            🗑️ 刪除歷史紀錄
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
