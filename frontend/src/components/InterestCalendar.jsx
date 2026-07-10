import React, { useState, useEffect } from 'react';

export default function InterestCalendar({ fcns }) {
  const [filterCurrency, setFilterCurrency] = useState('ALL');
  const [usdToTwd, setUsdToTwd] = useState(32.2); // Default fallback rate

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

  const activeFcns = fcns.filter(item => item.status === 'Active');

  // Helper to generate projected payment schedule for a single FCN
  const getProjectedInterest = (fcn) => {
    const schedule = [];
    const principal = Number(fcn.principal) || 0;
    const rate = Number(fcn.annualCouponRate) || 0;
    if (principal <= 0 || rate <= 0) return schedule;

    const start = new Date(fcn.startDate);
    const end = new Date(fcn.maturityDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return schedule;

    let monthlyAmount = principal * (rate / 100 / 12);
    let quarterlyAmount = principal * (rate / 100 / 4);

    // If explicit payment dates are recorded, use them!
    if (fcn.couponPaymentDates && fcn.couponPaymentDates.length > 0) {
      let paymentAmount = monthlyAmount;
      if (fcn.couponFrequency === 'Quarterly') {
        paymentAmount = quarterlyAmount;
      } else if (fcn.couponFrequency === 'Maturity') {
        paymentAmount = principal * (rate / 100);
      }

      fcn.couponPaymentDates.forEach(dateStr => {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          schedule.push({
            fcnId: fcn.id,
            fcnName: fcn.name,
            currency: fcn.currency,
            month: monthKey,
            dateStr: dateStr,
            amount: paymentAmount
          });
        }
      });
      return schedule;
    }

    // Fallback: estimate dates monthly/quarterly if not explicitly set
    let current = new Date(start);
    if (fcn.couponFrequency === 'Monthly') {
      current.setMonth(current.getMonth() + 1);
      while (current <= end || (current.getFullYear() === end.getFullYear() && current.getMonth() === end.getMonth())) {
        const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
        const estimatedDateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
        schedule.push({
          fcnId: fcn.id,
          fcnName: fcn.name,
          currency: fcn.currency,
          month: monthKey,
          dateStr: estimatedDateStr,
          amount: monthlyAmount
        });
        current.setMonth(current.getMonth() + 1);
      }
    } else if (fcn.couponFrequency === 'Quarterly') {
      current.setMonth(current.getMonth() + 3);
      while (current <= end || (current.getFullYear() === end.getFullYear() && current.getMonth() === end.getMonth())) {
        const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
        const estimatedDateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
        schedule.push({
          fcnId: fcn.id,
          fcnName: fcn.name,
          currency: fcn.currency,
          month: monthKey,
          dateStr: estimatedDateStr,
          amount: quarterlyAmount
        });
        current.setMonth(current.getMonth() + 3);
      }
    } else {
      // At Maturity
      const monthKey = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`;
      const diffTime = Math.abs(end - start);
      const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
      schedule.push({
        fcnId: fcn.id,
        fcnName: fcn.name,
        currency: fcn.currency,
        month: monthKey,
        dateStr: fcn.maturityDate,
        amount: principal * (rate / 100) * diffYears
      });
    }
    return schedule;
  };

  // Compile all schedules
  let allPayments = [];
  activeFcns.forEach(fcn => {
    allPayments = [...allPayments, ...getProjectedInterest(fcn)];
  });

  // Group payments by month
  const monthlyGroups = allPayments.reduce((acc, pay) => {
    const month = pay.month;
    if (!acc[month]) {
      acc[month] = {
        month,
        payments: [],
        totals: { USD: 0, TWD: 0 }
      };
    }
    acc[month].payments.push(pay);
    acc[month].totals[pay.currency] += pay.amount;
    return acc;
  }, {});

  // Sort months chronologically
  const sortedMonths = Object.values(monthlyGroups).sort((a, b) => a.month.localeCompare(b.month));

  // Filter months if specific currency selected
  const filteredMonths = sortedMonths.map(group => {
    const payments = group.payments.filter(p => filterCurrency === 'ALL' || p.currency === filterCurrency);
    const totals = { ...group.totals };
    return {
      ...group,
      payments,
      totals
    };
  }).filter(group => group.payments.length > 0);

  // Calculate total projected earnings
  const grandTotals = allPayments.reduce((acc, pay) => {
    acc[pay.currency] = (acc[pay.currency] || 0) + pay.amount;
    return acc;
  }, { USD: 0, TWD: 0 });

  const combinedTwdTotal = grandTotals.TWD + (grandTotals.USD * usdToTwd);

  const formatCurrency = (val, cur) => {
    return new Intl.NumberFormat(cur === 'TWD' ? 'zh-TW' : 'en-US', {
      style: 'currency',
      currency: cur,
      minimumFractionDigits: 2
    }).format(val);
  };

  const formatMonthTitle = (monthStr) => {
    const [year, month] = monthStr.split('-');
    return `${year} 年 ${Number(month)} 月`;
  };

  return (
    <div className="interest-calendar-container">
      <div className="fcn-section-header">
        <h2 className="fcn-section-title">預期配息利息收入行事曆</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            參考匯率：1 USD = {usdToTwd.toFixed(2)} TWD
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="dashboard-grid" style={{ marginBottom: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <div className="glass-card stat-card success">
          <span className="stat-label">預估累計美元利息 (USD)</span>
          <span className="stat-value" style={{ fontSize: '1.6rem', color: 'var(--color-success)' }}>
            {formatCurrency(grandTotals.USD, 'USD')}
          </span>
          <span className="stat-value-sub">各合約原始美金收益加總</span>
        </div>

        <div className="glass-card stat-card success" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <span className="stat-label" style={{ color: '#c084fc' }}>合併預估總收益 (折合台幣)</span>
          <span className="stat-value" style={{ fontSize: '1.6rem', color: '#c084fc' }}>
            {formatCurrency(combinedTwdTotal, 'TWD')}
          </span>
          <span className="stat-value-sub">USD 按 1:{usdToTwd.toFixed(2)} 匯率折算台幣後加總</span>
        </div>
      </div>

      {filteredMonths.length === 0 ? (
        <div className="glass-card empty-state">
          <div className="empty-state-icon">📅</div>
          <h3>目前無預估配息日程</h3>
          <p>請確認是否有登錄未平倉商品，或調整幣別篩選器。</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {filteredMonths.map((group) => {
            const combinedMonthlyTwd = group.totals.TWD + (group.totals.USD * usdToTwd);
            return (
              <div key={group.month} className="glass-card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--color-primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                    📅 {formatMonthTitle(group.month)}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {group.totals.USD > 0 && (
                        <span>USD: {formatCurrency(group.totals.USD, 'USD')}</span>
                      )}
                      {group.totals.TWD > 0 && (
                        <span>TWD: {formatCurrency(group.totals.TWD, 'TWD')}</span>
                      )}
                    </div>
                    {filterCurrency === 'ALL' && (
                      <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#c084fc' }}>
                        月配息折合台幣小計: {formatCurrency(combinedMonthlyTwd, 'TWD')}
                      </span>
                    )}
                    {filterCurrency === 'USD' && (
                      <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-success)' }}>
                        月配息小計: {formatCurrency(group.totals.USD, 'USD')}
                      </span>
                    )}
                    {filterCurrency === 'TWD' && (
                      <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-success)' }}>
                        月配息小計: {formatCurrency(group.totals.TWD, 'TWD')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Payments details inside this month */}
                <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '8px', overflow: 'hidden' }}>
                  <table className="stocks-table" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.01)' }}>
                        <th style={{ padding: '0.6rem 1rem' }}>來源 FCN 商品</th>
                        <th style={{ padding: '0.6rem 1rem' }}>約定配息日期</th>
                        <th style={{ padding: '0.6rem 1rem' }}>幣別</th>
                        <th style={{ padding: '0.6rem 1rem', textAlign: 'right' }}>本期預估利息</th>
                        <th style={{ padding: '0.6rem 1rem', textAlign: 'right' }}>折合台幣 (TWD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.payments.map((pay, idx) => {
                        const convertedTwd = pay.currency === 'TWD' ? pay.amount : pay.amount * usdToTwd;
                        return (
                          <tr key={`${pay.fcnId}-${idx}`}>
                            <td style={{ padding: '0.6rem 1rem', fontWeight: 600 }}>
                              {pay.fcnName}
                            </td>
                            <td style={{ padding: '0.6rem 1rem' }}>
                              {pay.dateStr || '估計日'}
                            </td>
                            <td style={{ padding: '0.6rem 1rem' }}>
                              <span className="stock-ticker-badge">{pay.currency}</span>
                            </td>
                            <td style={{ padding: '0.6rem 1rem', textAlign: 'right', color: 'var(--color-success)', fontWeight: 600 }}>
                              {formatCurrency(pay.amount, pay.currency)}
                            </td>
                            <td style={{ padding: '0.6rem 1rem', textAlign: 'right', color: '#c084fc', fontWeight: 600 }}>
                              {formatCurrency(convertedTwd, 'TWD')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
