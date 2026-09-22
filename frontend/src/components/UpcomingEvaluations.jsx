import React, { useState } from 'react';

export default function UpcomingEvaluations({ fcns, onEdit, onSettle, onRefresh }) {
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState('ALL'); // 'ALL' | 'DAILY' | '7DAYS' | '30DAYS' | 'FUTURE'
  const [selectedOwner, setSelectedOwner] = useState('ALL');
  const [koStatusFilter, setKoStatusFilter] = useState('ALL'); // 'ALL' | 'READY' | 'CLOSE' | 'NOT_READY'
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    if (onRefresh) await onRefresh();
    setTimeout(() => setRefreshing(false), 800);
  };

  const formatCurrency = (val, cur = 'USD') => {
    return new Intl.NumberFormat('zh-TW', {
      style: 'currency',
      currency: cur,
      minimumFractionDigits: 0
    }).format(val);
  };

  // Determine current reference date based on local time / New York market
  const now = new Date();
  const todayStr = now.toLocaleDateString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\//g, '-');

  // Extract all active FCNs
  const activeFcns = fcns.filter(f => f.status === 'Active');

  // Extract all unique owners
  const allOwners = Array.from(new Set(activeFcns.map(f => (f.owner || '').trim()).filter(Boolean)));

  // Calculate upcoming evaluation details for each active FCN
  const upcomingItems = activeFcns.map(fcn => {
    const isStepDown = fcn.name.toLowerCase().includes('stepdown') || 
                       fcn.name.toLowerCase().includes('step down') || 
                       (fcn.note && (fcn.note.toLowerCase().includes('stepdown') || fcn.note.toLowerCase().includes('step down')));

    let nextObservationDate = null;
    let diffDays = null;
    let isDailyActive = false;
    let observationType = '';
    let periodInfo = '';
    let totalObservationCount = 0;
    let currentPeriodIndex = 0;

    if (isStepDown) {
      // Step-Down FCN: specific observation dates
      const dates = (fcn.observationDates && fcn.observationDates.length > 0)
        ? [...fcn.observationDates].sort()
        : (fcn.couponPaymentDates ? [...fcn.couponPaymentDates].sort() : []);

      totalObservationCount = dates.length;
      
      // Filter out past observation dates (auto-removal of past dates!)
      const futureDates = dates.filter(d => d >= todayStr);
      
      if (futureDates.length > 0) {
        nextObservationDate = futureDates[0];
        currentPeriodIndex = dates.indexOf(nextObservationDate) + 1;
        const dToday = new Date(todayStr);
        dToday.setHours(0,0,0,0);
        const dTarget = new Date(nextObservationDate);
        dTarget.setHours(0,0,0,0);
        diffDays = Math.round((dTarget - dToday) / (1000 * 60 * 60 * 24));
        observationType = 'Step-Down 每月定日比價';
        periodInfo = `第 ${currentPeriodIndex} / ${totalObservationCount} 期比價`;
      }
    } else {
      // Non-Step-Down FCN: evaluates daily after the first observation date
      let firstObsDateStr = null;
      if (fcn.observationDates && fcn.observationDates.length > 0) {
        const sortedDates = [...fcn.observationDates].sort();
        firstObsDateStr = sortedDates[0];
      } else if (fcn.couponPaymentDates && fcn.couponPaymentDates.length > 0) {
        const sortedDates = [...fcn.couponPaymentDates].sort();
        firstObsDateStr = sortedDates[0];
      } else if (fcn.startDate) {
        const lockInMonths = fcn.lockInMonths !== undefined ? Number(fcn.lockInMonths) : 1;
        const startDate = new Date(fcn.startDate);
        const koStartDate = new Date(startDate.setMonth(startDate.getMonth() + lockInMonths));
        firstObsDateStr = koStartDate.toLocaleDateString('zh-TW', {
          timeZone: 'Asia/Taipei',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).replace(/\//g, '-');
      }

      if (firstObsDateStr) {
        const dToday = new Date(todayStr);
        dToday.setHours(0,0,0,0);
        const dFirstObs = new Date(firstObsDateStr);
        dFirstObs.setHours(0,0,0,0);

        if (dToday >= dFirstObs) {
          // Passed first observation date -> Currently in Daily Evaluation!
          isDailyActive = true;
          nextObservationDate = todayStr;
          diffDays = 0;
          observationType = '首期已過 • 美股每日比價中';
          periodInfo = '每個美股交易日收盤比價';
        } else {
          // In lock-in period before first observation date
          nextObservationDate = firstObsDateStr;
          diffDays = Math.round((dFirstObs - dToday) / (1000 * 60 * 60 * 24));
          observationType = '首期比價日 (此後每日比價)';
          periodInfo = `首期比價日：${firstObsDateStr}`;
        }
      }
    }

    // Underlying Stocks Analysis
    const stocks = fcn.stocks || [];
    let worstStock = null;
    let allStocksAboveKo = stocks.length > 0;
    let anyStockBelowKi = false;

    stocks.forEach(s => {
      const currentPct = typeof s.currentPercent === 'number' ? s.currentPercent : 0;
      const koPct = typeof s.koPercent === 'number' ? s.koPercent : 95;
      const kiPct = typeof s.kiPercent === 'number' ? s.kiPercent : 70;
      
      const distToKo = currentPct - koPct;
      const distToKi = currentPct - kiPct;

      if (!worstStock || currentPct < worstStock.currentPercent) {
        worstStock = {
          ...s,
          currentPercent: currentPct,
          koPercent: koPct,
          kiPercent: kiPct,
          distToKo,
          distToKi
        };
      }

      if (currentPct < koPct) {
        allStocksAboveKo = false;
      }
      if (kiPct > 0 && currentPct <= kiPct) {
        anyStockBelowKi = true;
      }
    });

    const worstDistToKo = worstStock ? worstStock.distToKo : -999;
    const isCloseToKo = !allStocksAboveKo && worstDistToKo >= -5; // within 5% of KO

    return {
      fcn,
      isStepDown,
      nextObservationDate,
      diffDays,
      isDailyActive,
      observationType,
      periodInfo,
      stocks,
      worstStock,
      allStocksAboveKo,
      anyStockBelowKi,
      worstDistToKo,
      isCloseToKo
    };
  })
  // Exclude contracts that have no future observation dates (all passed or matured)
  .filter(item => item.nextObservationDate !== null);

  // Sorting: From Closest to Farthest (從近到遠)
  // 1. diffDays ascending (0 [Daily/Today] -> 1 -> 7 -> 30)
  // 2. If same diffDays, sort by worstDistToKo descending (closest to KO first)
  const sortedItems = [...upcomingItems].sort((a, b) => {
    if (a.diffDays !== b.diffDays) {
      return a.diffDays - b.diffDays;
    }
    return b.worstDistToKo - a.worstDistToKo;
  });

  // Filter according to user UI selections
  const filteredItems = sortedItems.filter(item => {
    // 1. Search Query
    const q = search.toLowerCase().trim();
    if (q) {
      const matchName = (item.fcn.name || '').toLowerCase().includes(q);
      const matchBank = (item.fcn.bank || '').toLowerCase().includes(q);
      const matchOwner = (item.fcn.owner || '').toLowerCase().includes(q);
      const matchStock = item.stocks.some(s => 
        (s.symbol || '').toLowerCase().includes(q) || 
        (s.name || '').toLowerCase().includes(q)
      );
      if (!matchName && !matchBank && !matchOwner && !matchStock) {
        return false;
      }
    }

    // 2. Owner Filter
    if (selectedOwner !== 'ALL' && (item.fcn.owner || '').trim() !== selectedOwner) {
      return false;
    }

    // 3. Time Filter
    if (timeFilter === 'DAILY' && !item.isDailyActive) return false;
    if (timeFilter === '7DAYS' && (item.diffDays < 0 || item.diffDays > 7)) return false;
    if (timeFilter === '30DAYS' && (item.diffDays < 0 || item.diffDays > 30)) return false;
    if (timeFilter === 'FUTURE' && item.diffDays <= 30) return false;

    // 4. KO Status Filter
    if (koStatusFilter === 'READY' && !item.allStocksAboveKo) return false;
    if (koStatusFilter === 'CLOSE' && !item.isCloseToKo) return false;
    if (koStatusFilter === 'NOT_READY' && (item.allStocksAboveKo || item.isCloseToKo)) return false;

    return true;
  });

  // KPI Summary Calculations
  const countTotal = upcomingItems.length;
  const countDaily = upcomingItems.filter(i => i.isDailyActive).length;
  const countReadyKo = upcomingItems.filter(i => i.allStocksAboveKo).length;
  const countNext7Days = upcomingItems.filter(i => i.diffDays >= 0 && i.diffDays <= 7).length;

  return (
    <div className="upcoming-evaluations-container">
      {/* Header Title Section */}
      <div className="fcn-section-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h2 className="fcn-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span>🎯</span> 即將比價 (KO) 監控時程
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.3rem' }}>
            自動從近到遠排列所有未平倉合約的下次比價日與 Worst-of 標的水位。比價日過後或敲出結算後將自動滾動或自清單移除。
          </p>
        </div>

        <button 
          className={`refresh-button ${refreshing ? 'spinning' : ''}`}
          onClick={handleRefresh}
          disabled={refreshing}
          style={{ padding: '0.5rem 1rem' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
          {refreshing ? '股價更新中...' : '同步最新行情'}
        </button>
      </div>

      {/* Top Summary Stat Cards */}
      <div className="stats-grid" style={{ marginBottom: '1.75rem' }}>
        <div className="glass-card stat-card">
          <div className="stat-label">即將比價總合約數</div>
          <div className="stat-value" style={{ color: 'var(--text-primary)' }}>
            {countTotal} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>張</span>
          </div>
          <div className="stat-sub">未平倉且包含後續比價日</div>
        </div>

        <div className="glass-card stat-card" style={{ borderLeft: '4px solid #38bdf8' }}>
          <div className="stat-label">⚡ 每日比價進行中</div>
          <div className="stat-value" style={{ color: '#38bdf8' }}>
            {countDaily} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>張</span>
          </div>
          <div className="stat-sub">首期已過，每交易日收盤比價</div>
        </div>

        <div className="glass-card stat-card" style={{ borderLeft: '4px solid var(--color-success)' }}>
          <div className="stat-label">🎉 目前已達 KO 水位</div>
          <div className="stat-value" style={{ color: 'var(--color-success)' }}>
            {countReadyKo} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>張</span>
          </div>
          <div className="stat-sub">全標的皆過門檻，比價日將敲出</div>
        </div>

        <div className="glass-card stat-card" style={{ borderLeft: '4px solid #c084fc' }}>
          <div className="stat-label">📅 未來 7 天內比價</div>
          <div className="stat-value" style={{ color: '#c084fc' }}>
            {countNext7Days} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>張</span>
          </div>
          <div className="stat-sub">即將於一週內迎來比價日</div>
        </div>
      </div>

      {/* Control & Filter Toolbar */}
      <div className="glass-card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search Box */}
          <input 
            type="text" 
            placeholder="搜尋商品代碼、銀行、股票代號或擁有者..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)}
            style={{ 
              flex: '1 1 240px',
              padding: '0.5rem 0.9rem', 
              fontSize: '0.85rem', 
              background: 'rgba(0,0,0,0.3)', 
              border: '1px solid var(--border-color)', 
              borderRadius: '8px', 
              color: '#fff' 
            }}
          />

          {/* Time Filter */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {[
              { key: 'ALL', label: '全部時程' },
              { key: 'DAILY', label: '⚡ 每日比價中' },
              { key: '7DAYS', label: '7 天內' },
              { key: '30DAYS', label: '30 天內' }
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setTimeFilter(tab.key)}
                style={{
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: '1px solid',
                  cursor: 'pointer',
                  background: timeFilter === tab.key ? 'var(--color-primary)' : 'rgba(255,255,255,0.04)',
                  borderColor: timeFilter === tab.key ? 'var(--color-primary)' : 'var(--border-color)',
                  color: timeFilter === tab.key ? '#fff' : 'var(--text-secondary)'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Owner Filter */}
          {allOwners.length > 0 && (
            <select
              value={selectedOwner}
              onChange={(e) => setSelectedOwner(e.target.value)}
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.8rem',
                background: '#111827',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: '#38bdf8',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <option value="ALL">全部擁有者 ({activeFcns.length})</option>
              {allOwners.map(name => (
                <option key={name} value={name}>👤 {name}</option>
              ))}
            </select>
          )}

          {/* KO Status Filter */}
          <select
            value={koStatusFilter}
            onChange={(e) => setKoStatusFilter(e.target.value)}
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.8rem',
              background: '#111827',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              color: koStatusFilter === 'READY' ? 'var(--color-success)' : 'var(--text-secondary)',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <option value="ALL">全部 KO 狀態</option>
            <option value="READY">🎉 已達敲出水位</option>
            <option value="CLOSE">🔥 接近敲出 (距 KO &lt; 5%)</option>
            <option value="NOT_READY">⏳ 尚未達標</option>
          </select>
        </div>
      </div>

      {/* Main Upcoming Items List (Sorted From Closest to Farthest) */}
      {filteredItems.length === 0 ? (
        <div className="glass-card empty-state" style={{ padding: '3rem 2rem' }}>
          <div className="empty-state-icon" style={{ fontSize: '3rem' }}>🎯</div>
          <h3 style={{ fontSize: '1.25rem', marginTop: '0.5rem' }}>目前沒有符合條件的即將比價合約</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            所有合約的比價日若已過期或已平倉，系統將自動從此清單移除。
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {filteredItems.map(({
            fcn,
            isStepDown,
            nextObservationDate,
            diffDays,
            isDailyActive,
            observationType,
            periodInfo,
            stocks,
            worstStock,
            allStocksAboveKo,
            anyStockBelowKi,
            worstDistToKo,
            isCloseToKo
          }, index) => {
            return (
              <div 
                key={fcn.id} 
                className="glass-card" 
                style={{ 
                  padding: '1.35rem', 
                  borderRadius: '12px',
                  borderLeft: allStocksAboveKo 
                    ? '5px solid var(--color-success)' 
                    : isCloseToKo 
                      ? '5px solid var(--color-warning)' 
                      : isDailyActive 
                        ? '5px solid #38bdf8' 
                        : '5px solid rgba(255,255,255,0.15)',
                  transition: 'all 0.2s ease',
                  boxShadow: allStocksAboveKo ? '0 0 20px rgba(16, 185, 129, 0.12)' : 'none'
                }}
              >
                {/* Header Banner: Timing, Days Countdown, and FCN Name */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.9rem', marginBottom: '1rem' }}>
                  
                  {/* Left: Timing & Countdown Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      background: isDailyActive ? 'rgba(56, 189, 248, 0.15)' : diffDays <= 3 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                      border: `1px solid ${isDailyActive ? 'rgba(56, 189, 248, 0.35)' : diffDays <= 3 ? 'rgba(239, 68, 68, 0.35)' : 'rgba(168, 85, 247, 0.35)'}`,
                      padding: '0.4rem 0.85rem',
                      borderRadius: '8px'
                    }}>
                      <span style={{ fontSize: '1.2rem' }}>
                        {isDailyActive ? '⚡' : '📅'}
                      </span>
                      <div>
                        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                          下次比價日
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', letterSpacing: '0.5px' }}>
                          {isDailyActive ? '美股今日收盤' : nextObservationDate}
                        </div>
                      </div>
                    </div>

                    {/* Countdown Tag */}
                    <span style={{
                      padding: '0.3rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      background: isDailyActive 
                        ? 'rgba(56, 189, 248, 0.12)' 
                        : diffDays === 0 
                          ? 'rgba(239, 68, 68, 0.2)' 
                          : diffDays <= 7 
                            ? 'rgba(245, 158, 11, 0.2)' 
                            : 'rgba(255, 255, 255, 0.06)',
                      color: isDailyActive 
                        ? '#38bdf8' 
                        : diffDays === 0 
                          ? 'var(--color-danger)' 
                          : diffDays <= 7 
                            ? 'var(--color-warning)' 
                            : 'var(--text-secondary)',
                      border: '1px solid rgba(255,255,255,0.08)'
                    }}>
                      {isDailyActive ? '⚡ 每日比價中' : diffDays === 0 ? '🔥 今日比價' : diffDays === 1 ? '⏰ 明日比價' : `⏳ 還有 ${diffDays} 天`}
                    </span>

                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      • {observationType} {periodInfo ? `(${periodInfo})` : ''}
                    </span>
                  </div>

                  {/* Right: KO Condition Status Badge */}
                  <div>
                    {allStocksAboveKo ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        background: 'rgba(16, 185, 129, 0.18)',
                        color: 'var(--color-success)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        padding: '0.35rem 0.85rem',
                        borderRadius: '20px',
                        fontSize: '0.85rem',
                        fontWeight: 700
                      }}>
                        🎉 已滿足敲出 (KO) 門檻！
                      </span>
                    ) : isCloseToKo ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        background: 'rgba(245, 158, 11, 0.18)',
                        color: 'var(--color-warning)',
                        border: '1px solid rgba(245, 158, 11, 0.35)',
                        padding: '0.35rem 0.85rem',
                        borderRadius: '20px',
                        fontSize: '0.85rem',
                        fontWeight: 700
                      }}>
                        🔥 接近 KO 水位 (差 {Math.abs(worstDistToKo).toFixed(1)}%)
                      </span>
                    ) : (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--text-secondary)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        padding: '0.35rem 0.85rem',
                        borderRadius: '20px',
                        fontSize: '0.85rem',
                        fontWeight: 600
                      }}>
                        ⏳ 距 KO 還差 {Math.abs(worstDistToKo).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Contract Basic Details & Worst-Of Layout */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', alignItems: 'center' }}>
                  
                  {/* Left Column: Contract Identity */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {fcn.name}
                      </span>
                      {fcn.owner && (
                        <span style={{ fontSize: '0.75rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.12)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.25)', fontWeight: 600 }}>
                          👤 {fcn.owner}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                      <span>🏢 {fcn.bank}</span>
                      <span>•</span>
                      <span>💰 本金: {formatCurrency(fcn.principal, fcn.currency)}</span>
                      <span>•</span>
                      <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>📈 年息: {fcn.annualCouponRate}%</span>
                      <span>•</span>
                      <span>📅 到期: {fcn.maturityDate}</span>
                    </div>
                  </div>

                  {/* Right Column: Worst-of Stock Card */}
                  {worstStock && (
                    <div style={{
                      background: 'rgba(0, 0, 0, 0.25)',
                      border: `1px solid ${worstStock.distToKo >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                      padding: '0.85rem 1rem',
                      borderRadius: '10px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                          🎯 Worst-of 最差標的表現
                        </span>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: worstStock.distToKo >= 0 ? 'var(--color-success)' : worstStock.distToKo >= -5 ? 'var(--color-warning)' : 'var(--color-danger)'
                        }}>
                          {worstStock.distToKo >= 0 ? '✅ 已過 KO' : `差 ${Math.abs(worstStock.distToKo).toFixed(2)}% KO`}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div>
                          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', marginRight: '0.4rem' }}>
                            {worstStock.symbol}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {worstStock.name}
                          </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{
                            fontSize: '1.2rem',
                            fontWeight: 800,
                            color: worstStock.distToKo >= 0 ? 'var(--color-success)' : worstStock.currentPercent >= 100 ? '#fff' : 'var(--color-warning)'
                          }}>
                            {worstStock.currentPercent.toFixed(2)}%
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.3rem' }}>
                            (KO: {worstStock.koPercent}%)
                          </span>
                        </div>
                      </div>

                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem' }}>
                        <span>現價: ${worstStock.currentPrice ? worstStock.currentPrice.toFixed(2) : '--'} (期初 ${worstStock.initialPrice})</span>
                        <span>距 KI 門檻: +{worstStock.distToKi.toFixed(1)}%</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* All Underlying Stocks Mini Overview */}
                <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px dashed rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
                    全部連結標的收盤狀態 ({stocks.length} 檔)：
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem' }}>
                    {stocks.map(s => {
                      const pct = typeof s.currentPercent === 'number' ? s.currentPercent : 0;
                      const isOverKo = pct >= s.koPercent;
                      const isWorst = worstStock && s.symbol === worstStock.symbol;

                      return (
                        <div 
                          key={s.symbol}
                          style={{
                            background: isWorst ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${isWorst ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255,255,255,0.05)'}`,
                            padding: '0.5rem 0.75rem',
                            borderRadius: '6px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: isWorst ? '#fbbf24' : '#fff' }}>
                              {s.symbol}
                            </span>
                            {isWorst && (
                              <span style={{ fontSize: '0.65rem', color: '#fbbf24', marginLeft: '0.3rem', background: 'rgba(245,158,11,0.2)', padding: '1px 4px', borderRadius: '3px' }}>
                                Worst
                              </span>
                            )}
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              ${s.currentPrice ? s.currentPrice.toFixed(2) : '--'}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: isOverKo ? 'var(--color-success)' : 'var(--text-primary)' }}>
                              {pct.toFixed(1)}%
                            </div>
                            <div style={{ fontSize: '0.65rem', color: isOverKo ? 'var(--color-success)' : 'var(--text-muted)' }}>
                              {isOverKo ? '✅ 已過 KO' : `差 ${(s.koPercent - pct).toFixed(1)}%`}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Operations Footer */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                  <button 
                    type="button" 
                    className="action-btn edit"
                    onClick={() => onEdit && onEdit(fcn)}
                    style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem' }}
                  >
                    ✏️ 編輯條款
                  </button>
                  <button 
                    type="button" 
                    className={`action-btn settle ${allStocksAboveKo ? 'ko-highlight' : ''}`}
                    onClick={() => onSettle && onSettle(fcn)}
                    style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem' }}
                  >
                    {allStocksAboveKo ? '⚡ 辦理敲出結算' : '辦理平倉'}
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
