import React, { useState, useEffect } from 'react';

const emptyStock = () => ({
  symbol: '',
  name: '',
  initialPrice: '',
  koPercent: 95,
  kiPercent: 70,
  strikePercent: 85
});

export default function FCNForm({ editingFcn, onSubmit, onCancel }) {
  const [name, setName] = useState('');
  const [bank, setBank] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [principal, setPrincipal] = useState('');
  const [annualCouponRate, setAnnualCouponRate] = useState('');
  const [couponFrequency, setCouponFrequency] = useState('Monthly');
  const [tradeDate, setTradeDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [maturityDate, setMaturityDate] = useState('');
  const [observationFrequency, setObservationFrequency] = useState('Monthly');
  const [isKnockedIn, setIsKnockedIn] = useState(false);
  const [note, setNote] = useState('');
  const [stocks, setStocks] = useState([emptyStock()]);

  // Coupon payment dates state
  const [couponPaymentDatesRaw, setCouponPaymentDatesRaw] = useState('');

  // AI Import States
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [parsing, setParsing] = useState(false);

  const handleApiKeyChange = (val) => {
    setApiKey(val);
    localStorage.setItem('gemini_api_key', val);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      alert('請先輸入並儲存您的 Gemini API Key！');
      return;
    }

    setParsing(true);

    try {
      const base64Promise = new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
      });

      const base64Data = await base64Promise;
      const mimeType = file.type;

      const promptText = `
You are a professional structured financial product assistant. Analyze this FCN contract image and extract the terms into a structured JSON format.

Output JSON structure:
{
  "name": "FCN 2026SN3984" (or similar contract code/name),
  "bank": "e.g. DBS, Standard Chartered, Fubon, Cathay, etc. If bank name is not visible, guess DBS or leave blank",
  "currency": "USD" or "TWD",
  "principal": number (e.g. 50000),
  "annualCouponRate": number (e.g. 24.00),
  "couponFrequency": "Monthly" or "Quarterly",
  "observationFrequency": "Monthly" or "Quarterly",
  "tradeDate": "YYYY-MM-DD" (E.g. if July 7th is Trade Date and current year is 2026, parse as 2026-07-07),
  "startDate": "YYYY-MM-DD" (E.g. July 16th -> 2026-07-16),
  "maturityDate": "YYYY-MM-DD" (E.g. 最終評價日 1月14日 -> 2027-01-14),
  "couponPaymentDates": ["YYYY-MM-DD", "YYYY-MM-DD", ...], (Extract the exact list of payment dates / 配息日 if shown in the image. E.g. August 19th -> 2026-08-19, September 17th -> 2026-09-17...),
  "stocks": [
    {
      "symbol": "TSM",
      "name": "台積電 ADR",
      "initialPrice": 432.57,
      "koPercent": 100.0,
      "kiPercent": 0.0,
      "strikePercent": 58.05
    }
  ],
  "note": "brief notes about the contract"
}

Important Rules for stock calculations:
1. Identify ticker symbols (e.g., TSM, AMD, MU, NVDA). If they are Taiwan stocks, add the suffix .TW (e.g., 2330.TW).
2. Look at the Strike (履約價 / 執行價), KO (提前出場價 / 提前出場價) and KI (觸及生效價 / 觸及生效價) absolute values shown in the columns.
   Calculate their percentages relative to the initialPrice (期初定價 / 標的價格) where initialPrice represents 100.0%.
   Formula: percent = (absoluteValue / initialPrice) * 100.
   - E.g. TSM Initial is 432.5700. Strike/執行價 is 251.1069. strikePercent = (251.1069 / 432.57) * 100 = 58.05%.
   - E.g. TSM KO/提前出場價 is 432.5700. koPercent = (432.5700 / 432.5700) * 100 = 100.00%.
   - E.g. TSM KI/觸及生效價 is 0.0000. kiPercent = (0.0000 / 432.5700) * 100 = 0.00%.
3. Output ONLY a valid JSON string. Do NOT wrap it in markdown code blocks like \`\`\`json.
`;

      const payload = {
        contents: [{
          parts: [
            { text: promptText },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            }
          ]
        }]
      };

      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key=${encodeURIComponent(trimmedKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let details = '';
        try {
          const errJson = await response.json();
          details = errJson?.error?.message ? ` - ${errJson.error.message}` : '';
        } catch (_) {}
        throw new Error(`Gemini API 請求失敗，狀態碼: ${response.status}${details}`);
      }

      const resData = await response.json();
      let text = resData?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) {
        throw new Error('無法從 Gemini API 取得有效回覆，請檢查圖片或金鑰是否正確');
      }

      text = text.trim();
      if (text.startsWith('```')) {
        text = text.replace(/^```(json)?/, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(text);

      setName(parsed.name || '');
      setBank(parsed.bank || '');
      setCurrency(parsed.currency || 'USD');
      setPrincipal(parsed.principal || '');
      setAnnualCouponRate(parsed.annualCouponRate || '');
      setCouponFrequency(parsed.couponFrequency || 'Monthly');
      setTradeDate(parsed.tradeDate || '');
      setStartDate(parsed.startDate || '');
      setMaturityDate(parsed.maturityDate || '');
      setObservationFrequency(parsed.observationFrequency || 'Monthly');
      setNote(parsed.note || '');
      setCouponPaymentDatesRaw(parsed.couponPaymentDates ? parsed.couponPaymentDates.join(', ') : '');
      
      if (parsed.stocks && parsed.stocks.length > 0) {
        setStocks(parsed.stocks.map(s => ({
          symbol: s.symbol || '',
          name: s.name || '',
          initialPrice: s.initialPrice || '',
          koPercent: s.koPercent !== undefined ? s.koPercent : 95,
          kiPercent: s.kiPercent !== undefined ? s.kiPercent : 70,
          strikePercent: s.strikePercent !== undefined ? s.strikePercent : 85
        })));
      }

      alert('🎉 圖片解析成功！表單已為您自動填入，請仔細檢查所有數據無誤後，再點擊最下方的「新增商品存檔」按鈕進行儲存。');
    } catch (error) {
      console.error('Error parsing image:', error);
      
      let diagMsg = "";
      try {
        const diagRes = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(trimmedKey)}`);
        if (diagRes.ok) {
          const diagJson = await diagRes.json();
          const availableModels = diagJson?.models?.map(m => m.name.replace('models/', '')) || [];
          if (availableModels.length > 0) {
            diagMsg = `\n\n您帳號可用的模型列表：\n${availableModels.join(', ')}`;
          } else {
            diagMsg = `\n\n您的專案目前無可用模型權限。`;
          }
        } else {
          diagMsg = `\n\n無法查詢可用模型列表 (狀態碼: ${diagRes.status})`;
        }
      } catch (diagErr) {
        diagMsg = `\n\n查詢可用模型出錯: ${diagErr.message}`;
      }

      alert(`❌ 圖片解析失敗: ${error.message}${diagMsg}\n\n請確認您的 Gemini API Key 是否正確，且具備 API 使用權限，或可嘗試手動輸入。`);
    } finally {
      setParsing(false);
      e.target.value = '';
    }
  };

  // Load editing data if available
  useEffect(() => {
    if (editingFcn) {
      setName(editingFcn.name || '');
      setBank(editingFcn.bank || '');
      setCurrency(editingFcn.currency || 'USD');
      setPrincipal(editingFcn.principal || '');
      setAnnualCouponRate(editingFcn.annualCouponRate || '');
      setCouponFrequency(editingFcn.couponFrequency || 'Monthly');
      setTradeDate(editingFcn.tradeDate || '');
      setStartDate(editingFcn.startDate || '');
      setMaturityDate(editingFcn.maturityDate || '');
      setObservationFrequency(editingFcn.observationFrequency || 'Monthly');
      setIsKnockedIn(editingFcn.isKnockedIn || false);
      setNote(editingFcn.note || '');
      setCouponPaymentDatesRaw(editingFcn.couponPaymentDates ? editingFcn.couponPaymentDates.join(', ') : '');
      if (editingFcn.stocks && editingFcn.stocks.length > 0) {
        // Strip out dynamic properties before editing
        setStocks(editingFcn.stocks.map(s => ({
          symbol: s.symbol || '',
          name: s.name || '',
          initialPrice: s.initialPrice || '',
          koPercent: s.koPercent || 95,
          kiPercent: s.kiPercent || 70,
          strikePercent: s.strikePercent || 85
        })));
      }
    } else {
      // Clear form
      setName('');
      setBank('');
      setCurrency('USD');
      setPrincipal('');
      setAnnualCouponRate('');
      setCouponFrequency('Monthly');
      setTradeDate('');
      setStartDate('');
      setMaturityDate('');
      setObservationFrequency('Monthly');
      setIsKnockedIn(false);
      setNote('');
      setCouponPaymentDatesRaw('');
      setStocks([emptyStock()]);
    }
  }, [editingFcn]);

  const handleAddStock = () => {
    setStocks([...stocks, emptyStock()]);
  };

  const handleRemoveStock = (index) => {
    if (stocks.length === 1) return;
    const updated = stocks.filter((_, idx) => idx !== index);
    setStocks(updated);
  };

  const handleStockChange = (index, field, value) => {
    const updated = [...stocks];
    updated[index][field] = value;
    setStocks(updated);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validations
    if (!name.trim()) return alert('請輸入商品名稱');
    if (!bank.trim()) return alert('請輸入發行銀行');
    if (!principal || Number(principal) <= 0) return alert('請輸入合約本金金額');
    if (!annualCouponRate || Number(annualCouponRate) <= 0) return alert('請輸入年化配息率');
    
    // Validate stocks
    for (let i = 0; i < stocks.length; i++) {
      const s = stocks[i];
      if (!s.symbol.trim()) return alert(`請輸入第 ${i + 1} 檔股票代號`);
      if (!s.initialPrice || Number(s.initialPrice) <= 0) {
        return alert(`請輸入第 ${i + 1} 檔股票的期初參考價`);
      }
    }

    const payload = {
      name,
      bank,
      currency,
      principal: Number(principal),
      annualCouponRate: Number(annualCouponRate),
      couponFrequency,
      tradeDate,
      startDate,
      maturityDate,
      observationFrequency,
      isKnockedIn,
      note,
      couponPaymentDates: couponPaymentDatesRaw.split(',').map(d => d.trim()).filter(Boolean),
      stocks: stocks.map(s => ({
        symbol: s.symbol.trim().toUpperCase(),
        name: s.name.trim(),
        initialPrice: Number(s.initialPrice),
        koPercent: Number(s.koPercent),
        kiPercent: Number(s.kiPercent),
        strikePercent: Number(s.strikePercent)
      }))
    };

    onSubmit(payload);
  };

    return (
    <div className="glass-card form-container">
      <div className="form-header">
        <h2>{editingFcn ? '編輯 FCN 條款內容' : '登記新購 FCN 債券商品'}</h2>
        <p>請輸入合約之交易要素與標的期初條件。系統將自動計算與揭露各標的最新收盤狀況。</p>
      </div>

      {/* AI Image Import Section */}
      {!editingFcn && (
        <div className="ai-import-card">
          <div className="ai-import-header">
            <div className="ai-import-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.25rem' }}>
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
              💡 智能合約圖片匯入 (AI Image Parser)
            </div>
            <div className="api-key-container">
              <label htmlFor="api-key" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Gemini API Key:</label>
              <div className="api-key-input-group">
                <input 
                  id="api-key"
                  type="password" 
                  className="api-key-input"
                  placeholder="輸入您的 Gemini API 金鑰"
                  value={apiKey}
                  onChange={e => handleApiKeyChange(e.target.value)}
                />
              </div>
              <small style={{ fontSize: '0.75rem' }}>
                <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'none', marginLeft: '0.5rem', fontWeight: 600 }}>獲取金鑰</a>
              </small>
            </div>
          </div>

          <div className={`upload-zone ${parsing ? 'disabled' : ''}`}>
            {parsing ? (
              <div>
                <span style={{ fontSize: '1.5rem', display: 'inline-block', animation: 'spin 1.2s linear infinite' }}>⏳</span>
                <p style={{ marginTop: '0.5rem', fontWeight: 600, color: 'var(--color-primary)' }}>AI 正在閱讀並解析您的合約圖片，請稍候...</p>
              </div>
            ) : (
              <label style={{ display: 'block', width: '100%', height: '100%', cursor: 'pointer' }}>
                <span style={{ fontSize: '2rem' }}>📸</span>
                <p style={{ fontWeight: 600, marginTop: '0.25rem' }}>點擊上傳或拖曳合約圖片至此</p>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>支援 JPG, PNG 等圖片。系統會自動利用 Gemini 解析後填入表單。</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageUpload} 
                  style={{ display: 'none' }} 
                  disabled={parsing}
                />
              </label>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group full-width">
            <label htmlFor="fcn-name">FCN 商品名稱 / 合約代碼</label>
            <input 
              id="fcn-name"
              type="text" 
              placeholder="例如: 美股 NVDA/TSLA 雙標的 12% FCN" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="fcn-bank">發行金融機構 / 銀行</label>
            <input 
              id="fcn-bank"
              type="text" 
              placeholder="例如: 富邦銀行、高盛" 
              value={bank} 
              onChange={e => setBank(e.target.value)} 
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="fcn-currency">計價幣別</label>
            <select 
              id="fcn-currency"
              value={currency} 
              onChange={e => setCurrency(e.target.value)}
            >
              <option value="USD">美元 (USD)</option>
              <option value="TWD">新台幣 (TWD)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="fcn-principal">合約投資本金</label>
            <input 
              id="fcn-principal"
              type="number" 
              placeholder="請輸入金額" 
              value={principal} 
              onChange={e => setPrincipal(e.target.value)} 
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="fcn-coupon">票息率 (年化 %)</label>
            <input 
              id="fcn-coupon"
              type="number" 
              step="0.01"
              placeholder="例如: 12" 
              value={annualCouponRate} 
              onChange={e => setAnnualCouponRate(e.target.value)} 
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="fcn-coupon-freq">配息頻率</label>
            <select 
              id="fcn-coupon-freq"
              value={couponFrequency} 
              onChange={e => setCouponFrequency(e.target.value)}
            >
              <option value="Monthly">每月配息 (Monthly)</option>
              <option value="Quarterly">每季配息 (Quarterly)</option>
              <option value="Maturity">到期一次給付 (At Maturity)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="fcn-obs-freq">價格觀察頻率</label>
            <select 
              id="fcn-obs-freq"
              value={observationFrequency} 
              onChange={e => setObservationFrequency(e.target.value)}
            >
              <option value="Monthly">每月觀察 (Monthly)</option>
              <option value="Quarterly">每季觀察 (Quarterly)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="fcn-trade-date">交易日期</label>
            <input 
              id="fcn-trade-date"
              type="date" 
              value={tradeDate} 
              onChange={e => setTradeDate(e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label htmlFor="fcn-start-date">起息日期</label>
            <input 
              id="fcn-start-date"
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label htmlFor="fcn-maturity-date">到期日期</label>
            <input 
              id="fcn-maturity-date"
              type="date" 
              value={maturityDate} 
              onChange={e => setMaturityDate(e.target.value)} 
            />
          </div>

          <div className="form-group full-width">
            <label htmlFor="fcn-payment-dates">實際配息日列表 (用逗號分隔)</label>
            <input 
              id="fcn-payment-dates"
              type="text" 
              placeholder="例如: 2026-08-19, 2026-09-17, 2026-10-19, 2026-11-19, 2026-12-17, 2027-01-20" 
              value={couponPaymentDatesRaw} 
              onChange={e => setCouponPaymentDatesRaw(e.target.value)} 
            />
            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '-0.25rem' }}>
              這將用於在「預期利息收入」中排定精確的配息日，AI 辨識圖片後會自動為您填寫。
            </small>
          </div>

          <div className="form-group">
            <div className="checkbox-group">
              <input 
                id="fcn-ki-status"
                type="checkbox" 
                checked={isKnockedIn} 
                onChange={e => setIsKnockedIn(e.target.checked)} 
              />
              <label htmlFor="fcn-ki-status">合約已觸發敲入 (KI) 事件 (手動強制設定)</label>
            </div>
          </div>

          <div className="form-group full-width">
            <label htmlFor="fcn-note">備註說明</label>
            <textarea 
              id="fcn-note"
              rows="3"
              placeholder="請輸入此商品的特殊備註 (如：各期觀察日列表、手續費、配息級距...)" 
              value={note} 
              onChange={e => setNote(e.target.value)}
            />
          </div>
        </div>

        {/* Dynamic Stock Selection Section */}
        <div className="form-divider">
          <span className="form-divider-text">連結標的股票設定</span>
        </div>

        <div className="stocks-input-list">
          {stocks.map((stock, index) => (
            <div key={index} className="stock-input-card">
              <div className="stock-input-card-header">
                <span className="stock-input-title">標的股票 #{index + 1}</span>
                {stocks.length > 1 && (
                  <button 
                    type="button" 
                    className="remove-stock-btn"
                    onClick={() => handleRemoveStock(index)}
                  >
                    移除此標的
                  </button>
                )}
              </div>

              <div className="form-grid" style={{ marginBottom: 0 }}>
                <div className="form-group">
                  <label>股票代號 (Yahoo Finance 格式)</label>
                  <input 
                    type="text" 
                    placeholder="例如: NVDA, 2330.TW" 
                    value={stock.symbol} 
                    onChange={e => handleStockChange(index, 'symbol', e.target.value)} 
                    required
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '-0.25rem' }}>
                    美股代號如 NVDA，台股代號請加上後綴，如 2330.TW
                  </small>
                </div>

                <div className="form-group">
                  <label>股票中文名稱 (非必填)</label>
                  <input 
                    type="text" 
                    placeholder="例如: 輝達" 
                    value={stock.name} 
                    onChange={e => handleStockChange(index, 'name', e.target.value)} 
                  />
                </div>

                <div className="form-group">
                  <label>期初定價參考價 (100% 價格)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="例如: 200.00" 
                    value={stock.initialPrice} 
                    onChange={e => handleStockChange(index, 'initialPrice', e.target.value)} 
                    required
                  />
                </div>

                <div className="form-group">
                  <label>敲出門檻 KO (%)</label>
                  <input 
                    type="number" 
                    placeholder="預設 95" 
                    value={stock.koPercent} 
                    onChange={e => handleStockChange(index, 'koPercent', e.target.value)} 
                    required
                  />
                </div>

                <div className="form-group">
                  <label>敲入門檻 KI (%)</label>
                  <input 
                    type="number" 
                    placeholder="預設 70" 
                    value={stock.kiPercent} 
                    onChange={e => handleStockChange(index, 'kiPercent', e.target.value)} 
                    required
                  />
                </div>

                <div className="form-group">
                  <label>強制接股履約轉換價 (%)</label>
                  <input 
                    type="number" 
                    placeholder="預設 85" 
                    value={stock.strikePercent} 
                    onChange={e => handleStockChange(index, 'strikePercent', e.target.value)} 
                    required
                  />
                </div>
              </div>
            </div>
          ))}

          <button 
            type="button" 
            className="add-stock-btn"
            onClick={handleAddStock}
          >
            + 新增連結個股標的
          </button>
        </div>

        <div className="form-actions">
          {editingFcn && (
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={onCancel}
            >
              取消
            </button>
          )}
          <button type="submit" className="btn btn-primary">
            {editingFcn ? '儲存合約變更' : '新增商品存檔'}
          </button>
        </div>
      </form>
    </div>
  );
}
