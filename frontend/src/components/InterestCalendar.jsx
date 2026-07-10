import React from 'react';

export default function InterestCalendar({ fcns }) {
  const activeFcns = fcns.filter(item => item.status === 'Active' && item.currency === 'USD');

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

  // Compile all schedules (only for USD active FCNs)
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
        totalUSD: 0
      };
    }
    acc[month].payments.push(pay);
    acc[month].totalUSD += pay.amount;
    return acc;
  }, {});

  // Sort months chronologically
  const sortedMonths = Object.values(monthlyGroups).sort((a, b) => a.month.localeCompare(b.month));

  // Calculate total projected USD earnings
  const grandTotalUSD = allPayments.reduce((acc, pay) => acc + pay.amount, 0);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
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
        <h2 className="fcn-section-title">預期美元配息收入行事曆</h2>
      </div>

      {/* Summary Card (USD only, styled full width or nice card layout) */}
      <div style={{ marginBottom: '2rem' }}>
        <div className="glass-card stat-card success" style={{ maxWidth: '400px' }}>
          <span className="stat-label">預估累計美元利息總額 (USD)</span>
          <span className="stat-value" style={{ fontSize: '1.8rem', color: 'var(--color-success)' }}>
            {formatCurrency(grandTotalUSD)}
          </span>
          <span className="stat-value-sub">基於目前所有 Active 商品持有至到期之假設</span>
        </div>
      </div>

      {sortedMonths.length === 0 ? (
        <div className="glass-card empty-state">
          <div className="empty-state-icon">📅</div>
          <h3>目前無預估配息日程</h3>
          <p>請確認是否有登錄未平倉的美元 FCN 商品。</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {sortedMonths.map((group) => {
            return (
              <div key={group.month} className="glass-card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--color-primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                    📅 {formatMonthTitle(group.month)}
                  </h3>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-success)' }}>
                    月配息小計: {formatCurrency(group.totalUSD)}
                  </div>
                </div>

                {/* Payments details inside this month */}
                <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '8px', overflow: 'hidden' }}>
                  <table className="stocks-table" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.01)' }}>
                        <th style={{ padding: '0.6rem 1rem' }}>來源 FCN 商品</th>
                        <th style={{ padding: '0.6rem 1rem' }}>約定配息日期</th>
                        <th style={{ padding: '0.6rem 1rem', textAlign: 'right' }}>本期預估利息</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.payments.map((pay, idx) => (
                        <tr key={`${pay.fcnId}-${idx}`}>
                          <td style={{ padding: '0.6rem 1rem', fontWeight: 600 }}>
                            {pay.fcnName}
                          </td>
                          <td style={{ padding: '0.6rem 1rem' }}>
                            {pay.dateStr || '估計日'}
                          </td>
                          <td style={{ padding: '0.6rem 1rem', textAlign: 'right', color: 'var(--color-success)', fontWeight: 600 }}>
                            {formatCurrency(pay.amount)}
                          </td>
                        </tr>
                      ))}
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
