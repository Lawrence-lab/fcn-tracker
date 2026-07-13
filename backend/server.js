import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load local .env file if it exists (for local testing)
try {
  if (fsSync.existsSync(path.join(__dirname, '../.env'))) {
    const envFile = fsSync.readFileSync(path.join(__dirname, '../.env'), 'utf-8');
    envFile.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        process.env[key] = value;
      }
    });
    console.log('Loaded local .env environment variables successfully!');
  }
} catch (e) {
  console.log('No local .env file read:', e.message);
}

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = process.env.DATA_PATH ? path.join(process.env.DATA_PATH, 'fcns.json') : path.join(__dirname, 'data', 'fcns.json');

app.use(cors());
app.use(express.json());

// Password protection middleware for write actions (POST, PUT, DELETE)
app.use((req, res, next) => {
  const writeMethods = ['POST', 'PUT', 'DELETE'];
  if (writeMethods.includes(req.method)) {
    // Skip password check for price sync, LINE test, and LINE Webhook operations
    if (req.path === '/api/fcns/refresh' || req.path === '/api/fcns/evaluate' || req.path === '/api/fcns/test-line' || req.path === '/api/line/webhook') {
      return next();
    }
    const clientPassword = req.headers['x-admin-password'];
    if (clientPassword !== '940929') {
      return res.status(403).json({ error: '密碼錯誤，操作被拒絕！' });
    }
  }
  next();
});

// In-memory stock price cache to avoid Yahoo Finance rate limits
const priceCache = new Map();
const CACHE_DURATION_MS = 3 * 60 * 1000; // 3 minutes cache

// Fallback helper to fetch price from Nasdaq API (works in datacenter environments)
async function getStockPriceNasdaq(symbol) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  try {
    const url = `https://api.nasdaq.com/api/quote/${encodeURIComponent(normalizedSymbol)}/info?assetclass=stocks`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!response.ok) {
      throw new Error(`Nasdaq HTTP error ${response.status}`);
    }

    const data = await response.json();
    const primary = data?.data?.primaryData;
    const secondary = data?.data?.secondaryData;
    
    if (!primary || !primary.lastSalePrice) {
      throw new Error('Stock not found on Nasdaq or invalid format');
    }

    // Parse price (e.g. "$436.96" -> 436.96)
    const priceStr = primary.lastSalePrice.replace('$', '').replace(/,/g, '').trim();
    const price = parseFloat(priceStr);
    
    if (isNaN(price)) {
      throw new Error('Invalid price parsed from Nasdaq');
    }

    let prevClose = price;
    if (secondary && secondary.lastSalePrice) {
      const secPriceStr = secondary.lastSalePrice.replace('$', '').replace(/,/g, '').trim();
      const secPrice = parseFloat(secPriceStr);
      if (!isNaN(secPrice)) {
        const netChangeStr = secondary.netChange ? secondary.netChange.replace('+', '').trim() : '0';
        const netChange = parseFloat(netChangeStr);
        if (!isNaN(netChange)) {
          prevClose = secPrice - netChange;
        } else {
          prevClose = secPrice;
        }
      }
    }

    const name = data?.data?.companyName || normalizedSymbol;
    const currency = 'USD';

    return {
      price,
      prevClose,
      name,
      currency,
      updatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error fetching Nasdaq data for ${symbol}:`, error.message);
    throw error;
  }
}

// Helper to fetch price from Yahoo Finance
async function getStockPrice(symbol) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const cached = priceCache.get(normalizedSymbol);
  const now = Date.now();

  if (cached && (now - cached.timestamp < CACHE_DURATION_MS)) {
    return cached.data;
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(normalizedSymbol)}?interval=1d&range=1d`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const data = await response.json();
    const result = data?.chart?.result?.[0];
    
    if (!result) {
      throw new Error('Stock not found or invalid format');
    }

    const price = result.meta.regularMarketPrice;
    const prevClose = result.meta.chartPreviousClose;
    const name = result.meta.longName || result.meta.shortName || normalizedSymbol;
    const currency = result.meta.currency || 'USD';

    const stockInfo = {
      price,
      prevClose,
      name,
      currency,
      updatedAt: new Date().toISOString()
    };

    priceCache.set(normalizedSymbol, {
      timestamp: now,
      data: stockInfo
    });

    return stockInfo;
  } catch (error) {
    console.warn(`Yahoo Finance fetch failed for ${symbol}, trying Nasdaq API fallback:`, error.message);
    
    try {
      const stockInfo = await getStockPriceNasdaq(symbol);
      priceCache.set(normalizedSymbol, {
        timestamp: now,
        data: stockInfo
      });
      return stockInfo;
    } catch (nasdaqError) {
      console.error(`Nasdaq fallback also failed for ${symbol}:`, nasdaqError.message);
      if (cached) {
        return cached.data; // Fallback to stale cache if both fail
      }
      throw nasdaqError;
    }
  }
}

// Helpers for file DB
async function readFCNDb() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Create directories and write empty array if file missing
      await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
      await fs.writeFile(DATA_FILE, '[]', 'utf-8');
      return [];
    }
    throw error;
  }
}

async function writeFCNDb(data) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// REST APIs
// 0. Get real-time USD to TWD exchange rate (cached for 1 hour)
let exchangeRateCache = {
  USDTWD: 32.2,
  timestamp: 0
};
const EX_CACHE_DURATION = 60 * 60 * 1000;

app.get('/api/exchange-rate', async (req, res) => {
  const now = Date.now();
  if (now - exchangeRateCache.timestamp < EX_CACHE_DURATION) {
    return res.json(exchangeRateCache);
  }
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    if (response.ok) {
      const data = await response.json();
      if (data?.rates?.TWD) {
        exchangeRateCache = {
          USDTWD: data.rates.TWD,
          timestamp: now
        };
      }
    }
    res.json(exchangeRateCache);
  } catch (error) {
    console.error('Error fetching exchange rate:', error.message);
    res.json(exchangeRateCache); // fallback
  }
});

// 1. Get all FCNs with dynamic stock prices
app.get('/api/fcns', async (req, res) => {
  try {
    const fcns = await readFCNDb();
    
    // Collect all unique active stock symbols
    const symbols = new Set();
    fcns.forEach(fcn => {
      if (fcn.status === 'Active' && fcn.stocks) {
        fcn.stocks.forEach(s => {
          if (s.symbol) symbols.add(s.symbol.trim().toUpperCase());
        });
      }
    });

    // Fetch prices in parallel
    const priceMap = {};
    await Promise.all(
      Array.from(symbols).map(async (symbol) => {
        try {
          const info = await getStockPrice(symbol);
          priceMap[symbol] = info;
        } catch (error) {
          priceMap[symbol] = { price: null, prevClose: null, error: error.message };
        }
      })
    );

    // Enrich FCN data with current calculations
    const enriched = fcns.map(fcn => {
      if (!fcn.stocks) return fcn;

      const enrichedStocks = fcn.stocks.map(stock => {
        const symbolUpper = stock.symbol.trim().toUpperCase();
        const market = priceMap[symbolUpper] || {};
        
        const currentPrice = market.price;
        const prevClose = market.prevClose;
        const resolvedName = stock.name || market.name || stock.symbol;

        let currentPercent = null;
        let distanceToKo = null;
        let distanceToKi = null;
        let distanceToStrike = null;

        if (currentPrice !== null && stock.initialPrice) {
          currentPercent = (currentPrice / stock.initialPrice) * 100;
          
          const koVal = stock.initialPrice * (stock.koPercent / 100);
          const kiVal = stock.initialPrice * (stock.kiPercent / 100);
          const strikeVal = stock.initialPrice * (stock.strikePercent / 100);

          distanceToKo = ((currentPrice - koVal) / koVal) * 100;
          distanceToKi = ((currentPrice - kiVal) / kiVal) * 100;
          distanceToStrike = ((currentPrice - strikeVal) / strikeVal) * 100;
        }

        return {
          ...stock,
          name: resolvedName,
          currentPrice,
          prevClose,
          currentPercent,
          distanceToKo,
          distanceToKi,
          distanceToStrike
        };
      });

      // Determine worst-performing stock (determines FCN status)
      let worstStock = null;
      if (enrichedStocks.length > 0) {
        // filter out stocks with missing calculations
        const validStocks = enrichedStocks.filter(s => s.currentPercent !== null);
        if (validStocks.length > 0) {
          worstStock = validStocks.reduce((prev, curr) => 
            (curr.currentPercent < prev.currentPercent) ? curr : prev
          );
        }
      }

      // Check for automatic KI trigger
      let autoKiTriggered = fcn.isKnockedIn;
      if (!autoKiTriggered && worstStock && worstStock.currentPercent <= worstStock.kiPercent) {
        autoKiTriggered = true; // Auto-trip the flag
      }

      // Check for automatic KO trigger (all active stocks are >= koPercent, and past lock-in period)
      let isKoTriggered = false;
      if (fcn.status === 'Active' && fcn.startDate && enrichedStocks.length > 0) {
        const lockInMonths = fcn.lockInMonths !== undefined ? Number(fcn.lockInMonths) : 1;
        const startDate = new Date(fcn.startDate);
        const koStartDate = new Date(startDate.setMonth(startDate.getMonth() + lockInMonths));
        const today = new Date();
        
        if (today >= koStartDate) {
          isKoTriggered = enrichedStocks.every(s => s.currentPercent !== null && s.currentPercent >= s.koPercent);
        }
      }

      return {
        ...fcn,
        stocks: enrichedStocks,
        isKnockedIn: autoKiTriggered,
        isKoTriggered: isKoTriggered,
        worstStockSymbol: worstStock ? worstStock.symbol : null,
        worstStockPercent: worstStock ? worstStock.currentPercent : null
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error('API Error /api/fcns:', error);
    res.status(500).json({ error: 'Failed to retrieve FCN records' });
  }
});

// 2. Add FCN
app.post('/api/fcns', async (req, res) => {
  try {
    const newFcn = req.body;
    if (!newFcn.name || !newFcn.stocks || newFcn.stocks.length === 0) {
      return res.status(400).json({ error: 'Missing required FCN fields' });
    }

    const db = await readFCNDb();
    newFcn.id = `fcn-${Date.now()}`;
    newFcn.isKnockedIn = newFcn.isKnockedIn || false;
    newFcn.status = newFcn.status || 'Active';
    newFcn.createdAt = new Date().toISOString();

    db.push(newFcn);
    await writeFCNDb(db);
    res.status(201).json(newFcn);
  } catch (error) {
    console.error('API Error add FCN:', error);
    res.status(500).json({ error: 'Failed to add FCN record' });
  }
});

// 3. Update FCN
app.put('/api/fcns/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedFcn = req.body;
    const db = await readFCNDb();
    
    const index = db.findIndex(item => item.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'FCN record not found' });
    }

    db[index] = { ...db[index], ...updatedFcn, id }; // Prevent ID modification
    await writeFCNDb(db);
    res.json(db[index]);
  } catch (error) {
    console.error('API Error update FCN:', error);
    res.status(500).json({ error: 'Failed to update FCN record' });
  }
});

// 4. Delete FCN
app.delete('/api/fcns/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await readFCNDb();
    
    const filtered = db.filter(item => item.id !== id);
    if (filtered.length === db.length) {
      return res.status(404).json({ error: 'FCN record not found' });
    }

    await writeFCNDb(filtered);
    res.json({ message: 'FCN record deleted successfully' });
  } catch (error) {
    console.error('API Error delete FCN:', error);
    res.status(500).json({ error: 'Failed to delete FCN record' });
  }
});

// 5. Force Refresh Cache
app.post('/api/fcns/refresh', (req, res) => {
  priceCache.clear();
  res.json({ message: 'Stock price cache cleared successfully' });
});

// LINE Webhook to assist in getting user IDs or group IDs
app.post('/api/line/webhook', (req, res) => {
  console.log('--- LINE Webhook Received ---');
  console.log(JSON.stringify(req.body, null, 2));
  
  // Extra helper log to easily copy-paste IDs from Zeabur console
  const events = req.body?.events || [];
  events.forEach(evt => {
    const source = evt.source || {};
    if (source.type === 'user') {
      console.log(`Detected User ID (加好友傳訊): ${source.userId}`);
    } else if (source.type === 'group') {
      console.log(`Detected Group ID (群組識別碼): ${source.groupId}`);
    }
  });
  
  res.sendStatus(200);
});

// Helper to send push message using LINE Messaging API (Supports multicast for multiple users)
async function sendLineNotification(message) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const userIdEnv = process.env.LINE_USER_ID;

  if (!token || !userIdEnv) {
    console.log('[LINE] Skip notification: LINE_CHANNEL_ACCESS_TOKEN or LINE_USER_ID not configured in environment variables.');
    return;
  }

  // Support multiple user IDs separated by commas
  const targetIds = userIdEnv.split(',').map(id => id.trim()).filter(Boolean);
  if (targetIds.length === 0) return;

  const isMulticast = targetIds.length > 1;
  const url = isMulticast ? 'https://api.line.me/v2/bot/message/multicast' : 'https://api.line.me/v2/bot/message/push';

  const body = {
    messages: [
      {
        type: 'text',
        text: message
      }
    ]
  };

  if (isMulticast) {
    body.to = targetIds; // array of IDs
  } else {
    body.to = targetIds[0]; // single string ID (User or Group)
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`LINE API returned status ${response.status}: ${errText}`);
    }

    console.log(`[LINE] Notification sent successfully! (Recipient count: ${targetIds.length}, Type: ${isMulticast ? 'Multicast' : 'Push'})`);
  } catch (err) {
    console.error('[LINE] Failed to send notification:', err.message);
  }
}

// Helper to evaluate KI and KO triggers for active FCNs
async function evaluateFCNTriggers() {
  console.log('Running FCN price and trigger evaluation...');
  priceCache.clear(); // Clear cache to get fresh prices
  
  const fcns = await readFCNDb();
  let modifiedCount = 0;
  
  for (let fcn of fcns) {
    if (fcn.status !== 'Active') continue;
    
    let modified = false;
    
    // Check if the FCN has passed the lock-in period
    let hasObservationStarted = true;
    if (fcn.startDate) {
      const lockInMonths = fcn.lockInMonths !== undefined ? Number(fcn.lockInMonths) : 1;
      const startDate = new Date(fcn.startDate);
      const koStartDate = new Date(startDate.setMonth(startDate.getMonth() + lockInMonths));
      const today = new Date();
      if (today < koStartDate) {
        hasObservationStarted = false;
      }
    } else {
      hasObservationStarted = false;
    }

    let allStocksAboveKo = hasObservationStarted;
    
    for (let stock of fcn.stocks) {
      try {
        const market = await getStockPrice(stock.symbol);
        if (market.price !== null) {
          const currentPercent = (market.price / stock.initialPrice) * 100;
          
          // Check if this stock touched KI (Knock-In)
          const kiPercent = stock.kiPercent;
          if (kiPercent > 0 && currentPercent <= kiPercent && !fcn.isKnockedIn) {
            fcn.isKnockedIn = true;
            modified = true;
            console.log(`[Auto-Trigger] FCN "${fcn.name}" has knocked-in because stock ${stock.symbol} touched ${currentPercent.toFixed(2)}% (KI barrier is ${kiPercent}%)`);
          }

          if (currentPercent < stock.koPercent) {
            allStocksAboveKo = false;
          }
        } else {
          allStocksAboveKo = false;
        }
      } catch (err) {
        allStocksAboveKo = false;
        console.error(`Error checking triggers for stock ${stock.symbol} in FCN "${fcn.name}":`, err.message);
      }
    }
    
    if (allStocksAboveKo) {
      console.log(`[Auto-Trigger Alert] FCN "${fcn.name}" has met KO (Knock-out) conditions. All underlying stocks are at or above their KO barriers.`);
      
      const msg = `🔔 FCN 敲出提醒！\n\n您的商品「${fcn.name}」所有標的皆已高於敲出水位 (${fcn.stocks?.[0]?.koPercent}%)，已滿足每日敲出條件 (KO)！\n\n請登入系統辦理結算平倉：\nhttps://fcn-tracking.zeabur.app/`;
      await sendLineNotification(msg);
    }

    if (modified) {
      modifiedCount++;
    }
  }
  
  if (modifiedCount > 0) {
    await writeFCNDb(fcns);
    console.log(`Evaluation complete. Saved updates for ${modifiedCount} FCN records.`);
  } else {
    console.log('Evaluation complete. No database changes required.');
  }
  
  return modifiedCount;
}

// 6. Force Evaluation of Triggers
app.post('/api/fcns/evaluate', async (req, res) => {
  try {
    const updatedCount = await evaluateFCNTriggers();
    res.json({ message: `Evaluation complete. Updated ${updatedCount} FCN records.` });
  } catch (error) {
    console.error('API Error evaluate FCNs:', error);
    res.status(500).json({ error: 'Failed to run trigger evaluation' });
  }
});

// 7. Test LINE Notify / Bot Connection
app.post('/api/fcns/test-line', async (req, res) => {
  try {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const userId = process.env.LINE_USER_ID;
    
    if (!token || !userId) {
      return res.status(400).json({ error: '本機尚未設定 LINE_CHANNEL_ACCESS_TOKEN 或 LINE_USER_ID 環境變數' });
    }
    
    await sendLineNotification('測試訊息：您的 FCN 系統本機測試連線成功！📬');
    res.json({ message: '測試通知發送成功，請檢查您的手機 LINE 帳號！' });
  } catch (error) {
    console.error('Test LINE error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Schedule daily FCN trigger checks at 5:30 AM (Asia/Taipei time)
cron.schedule('30 5 * * *', async () => {
  try {
    await evaluateFCNTriggers();
  } catch (error) {
    console.error('Error in scheduled daily FCN evaluation:', error);
  }
});

// Serve frontend in production
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
