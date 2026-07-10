import React from 'react';

export default function HistoryLog({ fcns, onDelete }) {
  const settledFcns = fcns.filter(item => item.status !== 'Active');

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

  return (
    <div className="history-log-container">
      <div className="fcn-section-header">
        <h2 className="fcn-section-title">歷史平倉與到期紀錄</h2>
      </div>

      {settledFcns.length === 0 ? (
        <div className="glass-card empty-state">
          <div className="empty-state-icon">📋</div>
          <h3>尚無歷史平倉紀錄</h3>
          <p>當您將未平倉的商品辦理結算平倉後，結算明細與損益分析會記錄於此處。</p>
        </div>
      ) : (
        <div className="fcn-grid">
          {settledFcns.map((item) => {
            const statusMeta = getStatusLabel(item.status);
            const settle = item.settlement || {};
            const totalProfit = Number(settle.netProfit) || 0;

            return (
              <div key={item.id} className="glass-card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {item.name}
                      <span className={`fcn-badge ${statusMeta.class}`} style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>
                        {statusMeta.text}
                      </span>
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      🏢 發行銀行: {item.bank} | 交易期間: {item.startDate} 至 {item.maturityDate}
                    </p>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>結算日</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{settle.settleDate || '無'}</div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', margin: '1rem 0', paddingTop: '1rem' }} />

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem' }}>
                  <div className="fcn-val">
                    <span className="fcn-val-label">原始本金</span>
                    <span className="fcn-val-number">
                      {formatCurrency(item.principal, item.currency)}
                    </span>
                  </div>

                  <div className="fcn-val">
                    <span className="fcn-val-label">累計實收票息 (利息)</span>
                    <span className="fcn-val-number success">
                      {formatCurrency(settle.totalCouponsEarned || 0, item.currency)}
                    </span>
                  </div>

                  {item.status === 'Matured-Stock' && (
                    <>
                      <div className="fcn-val">
                        <span className="fcn-val-label">接股明細 (Worst Stock)</span>
                        <span className="fcn-val-number danger" style={{ fontSize: '0.95rem' }}>
                          {settle.stockSymbol} ({settle.sharesReceived?.toFixed(2)} 股)
                        </span>
                        <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          履約價: {settle.strikePrice} | 結算收盤價: {settle.marketPriceAtSettle}
                        </small>
                      </div>

                      <div className="fcn-val">
                        <span className="fcn-val-label">股票市值變動損益</span>
                        <span className={`fcn-val-number ${Number(settle.stockValueLoss) <= 0 ? 'danger' : 'success'}`}>
                          {formatCurrency(settle.stockValueLoss || 0, item.currency)}
                        </span>
                      </div>
                    </>
                  )}

                  <div className="fcn-val">
                    <span className="fcn-val-label">商品結算淨損益</span>
                    <span className={`fcn-val-number ${totalProfit >= 0 ? 'success' : 'danger'}`}>
                      {totalProfit >= 0 ? '+' : ''}{formatCurrency(totalProfit, item.currency)}
                    </span>
                  </div>
                </div>

                {settle.note && (
                  <div style={{ background: 'rgba(0,0,0,0.15)', padding: '0.75rem', borderRadius: '8px', marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <strong>結算備註：</strong>{settle.note}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button 
                    className="action-btn delete"
                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                    onClick={() => {
                      if(window.confirm('確定要永久刪除此歷史結算紀錄嗎？')) {
                        onDelete(item.id);
                      }
                    }}
                  >
                    刪除歷史紀錄
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
