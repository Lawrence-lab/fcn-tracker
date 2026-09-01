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

// Helper to get the latest completed US trading date based on New York wall-clock time
function getLatestClosedTradingDate() {
  const nyStr = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  const nyDate = new Date(nyStr);
  const year = nyDate.getFullYear();
  const month = nyDate.getMonth();
  const date = nyDate.getDate();
  
  // US markets close at 4:00 PM EST/EDT
  const marketCloseToday = new Date(year, month, date, 16, 0, 0);
  
  let latestTradingDate = new Date(year, month, date);
  if (nyDate < marketCloseToday) {
    latestTradingDate.setDate(latestTradingDate.getDate() - 1);
  }
  
  // Adjust for weekends (if Saturday, go back to Friday; if Sunday, go back to Friday)
  let checkDay = latestTradingDate.getDay();
  if (checkDay === 6) {
    latestTradingDate.setDate(latestTradingDate.getDate() - 1);
  } else if (checkDay === 0) {
    latestTradingDate.setDate(latestTradingDate.getDate() - 2);
  }
  
  const y = latestTradingDate.getFullYear();
  const m = String(latestTradingDate.getMonth() + 1).padStart(2, '0');
  const d = String(latestTradingDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Helper for fetch with timeout (prevents slow APIs from locking the server)
async function fetchWithTimeout(url, options = {}, timeoutMs = 3000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

// In-memory stock price cache to avoid Yahoo Finance rate limits
const priceCache = new Map();
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes cache

// Fallback helper to fetch price from Nasdaq API (works in datacenter environments)
async function getStockPriceNasdaq(symbol) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  try {
    const url = `https://api.nasdaq.com/api/quote/${encodeURIComponent(normalizedSymbol)}/info?assetclass=stocks`;
    const response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    }, 3000);

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

// Helper to fetch price from Google Finance as the primary stable source on cloud IP
async function getStockPriceGoogle(symbol) {
  const sym = symbol.trim().toUpperCase();
  let querySymbol = sym;
  
  if (!sym.includes(':')) {
    const exchange = ['TSM', 'OKLO', 'WOLF'].includes(sym) ? 'NYSE' : 'NASDAQ';
    querySymbol = `${sym}:${exchange}`;
  }

  try {
    const info = await fetchGoogleFinance(querySymbol);
    if (info) return info;
  } catch (err) {
    console.warn(`[Google Finance] Failed for ${querySymbol}:`, err.message);
  }

  // Fallback to alternate exchange if not already specified with colon
  if (!sym.includes(':')) {
    const origExchange = ['TSM', 'OKLO', 'WOLF'].includes(sym) ? 'NYSE' : 'NASDAQ';
    const altExchange = origExchange === 'NASDAQ' ? 'NYSE' : 'NASDAQ';
    const altQuerySymbol = `${sym}:${altExchange}`;
    try {
      const info = await fetchGoogleFinance(altQuerySymbol);
      if (info) return info;
    } catch (err) {
      console.warn(`[Google Finance] Alternate failed for ${altQuerySymbol}:`, err.message);
    }
  }

  throw new Error(`Google Finance price not found for ${symbol}`);
}

async function fetchGoogleFinance(querySymbol) {
  const url = `https://www.google.com/finance/quote/${encodeURIComponent(querySymbol)}`;
  const response = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    }
  }, 4000);

  if (!response.ok) {
    throw new Error(`HTTP error ${response.status} from Google Finance`);
  }

  const html = await response.text();
  const tickerOnly = querySymbol.split(':')[0].trim().toUpperCase();

  // Find all initDataCallbacks
  const regex = /AF_initDataCallback\s*\(\s*\{\s*key\s*:\s*'(ds:16|ds:9)'[\s\S]*?data\s*:\s*([\s\S]*?)\s*,\s*sideChannel/g;
  let match;
  let parsedInfo = null;

  while ((match = regex.exec(html)) !== null) {
    const key = match[1];
    const dataStr = match[2];
    try {
      const data = JSON.parse(dataStr);
      let stockData = data?.[0]?.[0];
      if (!stockData) continue;

      if (key === 'ds:16') {
        let unwrapped = stockData;
        if (Array.isArray(unwrapped[0])) {
          unwrapped = unwrapped[0];
        }

        const symbolArray = unwrapped[1];
        if (Array.isArray(symbolArray) && symbolArray[0] && symbolArray[0].trim().toUpperCase() === tickerOnly) {
          const priceObj = unwrapped[5];
          const price = Array.isArray(priceObj) ? parseFloat(priceObj[0]) : null;
          const prevClose = parseFloat(unwrapped[7]);
          const name = unwrapped[2] || tickerOnly;
          const currency = unwrapped[4] || 'USD';

          if (price !== null && !isNaN(price)) {
            parsedInfo = {
              price,
              prevClose: isNaN(prevClose) ? null : prevClose,
              name: name.trim(),
              currency,
              updatedAt: new Date().toISOString()
            };
            break;
          }
        }
      } else if (key === 'ds:9') {
        const symbolArray = stockData[1];
        if (Array.isArray(symbolArray) && symbolArray[0] && symbolArray[0].trim().toUpperCase() === tickerOnly) {
          const price = parseFloat(stockData[6]);
          const prevClose = parseFloat(stockData[15]);
          const name = stockData[14] || tickerOnly;
          const currency = stockData[12] || 'USD';

          if (!isNaN(price)) {
            parsedInfo = {
              price,
              prevClose: isNaN(prevClose) ? null : prevClose,
              name: name.trim(),
              currency,
              updatedAt: new Date().toISOString()
            };
            break;
          }
        }
      }
    } catch (err) {
      // ignore parse errors and proceed to the next block
    }
  }

  if (parsedInfo) {
    return parsedInfo;
  }

  throw new Error(`Google Finance price not found or validation failed for ${querySymbol}`);
}

// Helper to fetch price from Yahoo Finance
async function getStockPrice(symbol) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const cached = priceCache.get(normalizedSymbol);
  const now = Date.now();

  if (cached && (now - cached.timestamp < CACHE_DURATION_MS)) {
    return cached.data;
  }

  // Try Google Finance first
  try {
    const googleInfo = await getStockPriceGoogle(normalizedSymbol);
    priceCache.set(normalizedSymbol, {
      timestamp: now,
      data: googleInfo
    });
    return googleInfo;
  } catch (googleErr) {
    console.warn(`[Price Engine] Google Finance failed for ${symbol}, falling back to Yahoo:`, googleErr.message);
  }

  // Stagger requests to avoid concurrent burst rate limits on cloud IP
  await new Promise(resolve => setTimeout(resolve, Math.random() * 600));

  const hosts = [
    'query1.finance.yahoo.com',
    'query2.finance.yahoo.com'
  ];

  let lastError = null;

  for (const host of hosts) {
    try {
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(normalizedSymbol)}?interval=1d&range=1d`;
      const response = await fetchWithTimeout(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
        }
      }, 2500);

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status} from ${host}`);
      }

      const data = await response.json();
      const result = data?.chart?.result?.[0];
      
      if (!result) {
        throw new Error(`Invalid data format from ${host}`);
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
      console.warn(`Yahoo Finance query on ${host} failed for ${symbol}:`, error.message);
      lastError = error;
    }
  }

  // Fallback to Nasdaq API if both Yahoo Finance hosts fail
  console.warn(`All Yahoo Finance hosts failed for ${symbol}. Trying Nasdaq API fallback...`);
  try {
    const stockInfo = await getStockPriceNasdaq(normalizedSymbol);
    priceCache.set(normalizedSymbol, {
      timestamp: now,
      data: stockInfo
    });
    return stockInfo;
  } catch (nasdaqError) {
    console.error(`Nasdaq fallback also failed for ${symbol}:`, nasdaqError.message);
    if (cached) {
      console.log(`Using stale cache for ${symbol} as fallback.`);
      return cached.data;
    }
    throw new Error(`Failed to fetch stock price for ${symbol}: ${lastError?.message || nasdaqError.message}`);
  }
}

// Bulk fetch stock prices from Yahoo Finance Spark API (fast, handles multiple symbols, rate-limit proof)
async function fetchBulkStockPrices(symbolsArray) {
  if (symbolsArray.length === 0) return {};
  
  const symbolList = symbolsArray.join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(symbolList)}&range=1d&interval=5m`;
  
  try {
    const response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      }
    }, 4000);
    
    if (!response.ok) {
      throw new Error(`Spark API returned status ${response.status}`);
    }
    
    const data = await response.json();
    const results = data?.spark?.result || [];
    const priceMap = {};
    
    results.forEach(item => {
      if (!item.symbol) return;
      const symbol = item.symbol.toUpperCase();
      const resObj = item.response?.[0];
      const meta = resObj?.meta;
      const closeArray = resObj?.indicators?.quote?.[0]?.close || [];
      
      if (meta) {
        const price = meta.regularMarketPrice || closeArray[closeArray.length - 1] || null;
        const prevClose = meta.chartPreviousClose || null;
        const name = meta.longName || meta.shortName || symbol;
        const currency = meta.currency || 'USD';
        
        priceMap[symbol] = {
          price,
          prevClose,
          name,
          currency,
          updatedAt: new Date().toISOString()
        };
      }
    });
    
    return priceMap;
  } catch (error) {
    console.error('Failed to fetch bulk stock prices via Spark API:', error.message);
    throw error;
  }
}

// Helpers for file DB
async function readFCNDb() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Ensure parent directory exists
      await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
      
      // Attempt to copy template database from project repository to the persistent path
      const templatePath = path.join(__dirname, 'data', 'fcns.json');
      try {
        const templateRaw = await fs.readFile(templatePath, 'utf-8');
        await fs.writeFile(DATA_FILE, templateRaw, 'utf-8');
        console.log(`[Database Init] Copied template database to persistent path: ${DATA_FILE}`);
        return JSON.parse(templateRaw);
      } catch (templateErr) {
        // Fallback to empty array if template also missing
        await fs.writeFile(DATA_FILE, '[]', 'utf-8');
        return [];
      }
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

// Global lock to prevent multiple background fetches from running concurrently
let isFetchingPrices = false;

app.get('/api/exchange-rate', async (req, res) => {
  const now = Date.now();
  if (now - exchangeRateCache.timestamp < EX_CACHE_DURATION) {
    return res.json(exchangeRateCache);
  }
  try {
    const response = await fetchWithTimeout('https://open.er-api.com/v6/latest/USD', {}, 3000);
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

// Diagnostic route to test Yahoo Finance subdomains on cloud
app.get('/api/test-spark', async (req, res) => {
  const cacheEntries = {};
  priceCache.forEach((val, key) => {
    cacheEntries[key] = val;
  });
  res.json({
    isFetchingPrices,
    cache: cacheEntries
  });
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

    // Fetch prices using Stale-While-Revalidate (SWR) non-blocking revalidation
    const now = Date.now();
    const symbolsToFetch = [];
    const priceMap = {};

    // 1. Build priceMap immediately using cached data (even if expired)
    Array.from(symbols).forEach(symbol => {
      const cached = priceCache.get(symbol);
      if (cached) {
        priceMap[symbol] = cached.data;
        // If cache is expired, queue symbol for background revalidation
        if (now - cached.timestamp >= CACHE_DURATION_MS) {
          symbolsToFetch.push(symbol);
        }
      } else {
        // If not cached at all, we must fetch it in the background
        symbolsToFetch.push(symbol);
      }
    });

    // 2. Trigger background revalidation if needed and not already running
    if (symbolsToFetch.length > 0 && !isFetchingPrices) {
      isFetchingPrices = true;
      // Float the promise in the background so we do NOT block the HTTP response
      (async () => {
        try {
          console.log(`[Background Fetch] Revalidating ${symbolsToFetch.length} stock prices in bulk: ${symbolsToFetch.join(', ')}`);
          let bulkResults = {};
          try {
            bulkResults = await fetchBulkStockPrices(symbolsToFetch);
          } catch (bulkError) {
            console.warn('[Background Fetch] Bulk revalidation failed (will use fallback):', bulkError.message);
          }
          
          // Populate cache for successfully fetched symbols
          symbolsToFetch.forEach(symbol => {
            if (bulkResults[symbol]) {
              priceCache.set(symbol, {
                timestamp: Date.now(),
                data: bulkResults[symbol]
              });
            }
          });

          // Run staggered fallback for any symbols that failed bulk load
          for (let i = 0; i < symbolsToFetch.length; i++) {
            const symbol = symbolsToFetch[i];
            if (!bulkResults[symbol]) {
              if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 300));
              }
              try {
                console.log(`[Background Fetch] Running fallback query for ${symbol}...`);
                const info = await getStockPrice(symbol);
                priceCache.set(symbol, {
                  timestamp: Date.now(),
                  data: info
                });
              } catch (err) {
                console.warn(`[Background Fetch] Fallback failed for ${symbol}:`, err.message);
                // Cache the error for 3 minutes to avoid hammering Yahoo Finance
                priceCache.set(symbol, {
                  timestamp: Date.now() - (CACHE_DURATION_MS - 3 * 60 * 1000), // Expirable in 3 mins
                  data: { price: null, prevClose: null, error: err.message }
                });
              }
            }
          }
        } catch (fatalError) {
          console.error('[Background Fetch] Fatal error in background loop:', fatalError.message);
        } finally {
          isFetchingPrices = false;
        }
      })();
    }

    // Enrich FCN data with current calculations
    let anyDbModified = false;
    const enriched = fcns.map(fcn => {
      if (fcn.status !== 'Active') {
        return fcn;
      }
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
          distanceToStrike,
          error: market.error || null
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

      let dbModified = false;

      // Check for automatic KI trigger (skip for European KI during the term)
      let autoKiTriggered = fcn.isKnockedIn || false;
      const isEuropeanKi = fcn.isEuropeanKi !== undefined ? fcn.isEuropeanKi : true;
      
      if (!isEuropeanKi && enrichedStocks.length > 0) {
        enrichedStocks.forEach(s => {
          if (s.currentPercent !== null && s.kiPercent > 0) {
            const isBelowKiNow = s.currentPercent <= s.kiPercent;
            const origStock = fcn.stocks.find(os => os.symbol === s.symbol);
            if (origStock) {
              const wasBelowKi = origStock.wasBelowKi || false;
              if (isBelowKiNow && !wasBelowKi) {
                origStock.wasBelowKi = true;
                fcn.isKnockedIn = true;
                autoKiTriggered = true;
                dbModified = true;
              } else if (!isBelowKiNow && wasBelowKi) {
                origStock.wasBelowKi = false;
                dbModified = true;
              }
            }
          }
        });
      }

      // Check for automatic KO trigger
      let isKoTriggered = fcn.isKoTriggered || false;
      if (!isKoTriggered && fcn.status === 'Active' && fcn.startDate && enrichedStocks.length > 0) {
        const lockInMonths = fcn.lockInMonths !== undefined ? Number(fcn.lockInMonths) : 1;
        const startDate = new Date(fcn.startDate);
        const koStartDate = new Date(startDate.setMonth(startDate.getMonth() + lockInMonths));
        const todayStr = getLatestClosedTradingDate();
        
        const isStepDown = fcn.name.toLowerCase().includes('stepdown') || 
                           fcn.name.toLowerCase().includes('step down') || 
                           (fcn.note && (fcn.note.toLowerCase().includes('stepdown') || fcn.note.toLowerCase().includes('step down')));

        let isEvaluationDay = false;
        if (isStepDown) {
          // Step Down FCNs: only evaluate on specific observation/payment dates
          const datesToCheck = (fcn.observationDates && fcn.observationDates.length > 0) 
            ? fcn.observationDates 
            : (fcn.couponPaymentDates || []);
          isEvaluationDay = datesToCheck.includes(todayStr);
        } else {
          // Non-Step Down FCNs: evaluate daily starting from the first observation date
          let firstObsDateStr = null;
          if (fcn.observationDates && fcn.observationDates.length > 0) {
            const sortedDates = [...fcn.observationDates].sort((a, b) => new Date(a) - new Date(b));
            firstObsDateStr = sortedDates[0];
          } else if (fcn.couponPaymentDates && fcn.couponPaymentDates.length > 0) {
            const sortedDates = [...fcn.couponPaymentDates].sort((a, b) => new Date(a) - new Date(b));
            firstObsDateStr = sortedDates[0];
          } else {
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
            isEvaluationDay = dToday >= dFirstObs;
          }
        }

        if (isEvaluationDay) {
          const allStocksAboveKo = enrichedStocks.every(s => s.currentPercent !== null && s.currentPercent >= s.koPercent);
          if (allStocksAboveKo) {
            isKoTriggered = true;
          }
        }
      }

      if (dbModified) {
        anyDbModified = true;
        // Find and update the original item inside the fcns array so it gets saved
        const idx = fcns.findIndex(item => item.id === fcn.id);
        if (idx !== -1) {
          fcns[idx].isKnockedIn = fcn.isKnockedIn;
          fcns[idx].stocks = fcn.stocks; // Update stocks array to persist wasBelowKi status
        }
      }

      return {
        ...fcn,
        stocks: enrichedStocks,
        isKnockedIn: autoKiTriggered,
        isKoTriggered: isKoTriggered,
        isEuropeanKi: isEuropeanKi,
        worstStockSymbol: worstStock ? worstStock.symbol : null,
        worstStockPercent: worstStock ? worstStock.currentPercent : null
      };
    });

    // Write back to DB if any persistent trigger status changed
    if (anyDbModified) {
      await writeFCNDb(fcns);
      console.log('[DB Auto-Commit] Saved updated persistent KI/KO triggers to JSON database.');
    }

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
    newFcn.isKoTriggered = newFcn.isKoTriggered || false;
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

// 3.5. Download Backup (requires admin password)
app.get('/api/fcns/backup/download', async (req, res) => {
  try {
    const password = req.headers['x-admin-password'] || req.query.password;
    if (password !== '940929') {
      return res.status(401).json({ error: '密碼錯誤，拒絕存取' });
    }

    const fcns = await readFCNDb();
    const delivered = await readDeliveredDb();

    const dateStr = new Date().toLocaleDateString('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\//g, '');
    
    res.setHeader('Content-Disposition', `attachment; filename=fcn_portfolio_backup_${dateStr}.json`);
    res.setHeader('Content-Type', 'application/json');
    res.json({
      backupDate: new Date().toISOString(),
      fcns,
      delivered
    });
  } catch (error) {
    console.error('Backup API Error:', error);
    res.status(500).json({ error: '產出備份檔案失敗' });
  }
});

// 3.6. Restore Backup (requires admin password)
app.post('/api/fcns/backup/restore', async (req, res) => {
  try {
    const password = req.headers['x-admin-password'] || req.body.password;
    if (password !== '940929') {
      return res.status(401).json({ error: '密碼錯誤，拒絕存取' });
    }

    const { fcns, delivered } = req.body;
    if (!fcns || !delivered) {
      return res.status(400).json({ error: '無效的備份檔案格式' });
    }

    // Write both databases
    await writeFCNDb(fcns);
    await writeDeliveredDb(delivered);

    res.json({ message: '資料庫還原成功' });
  } catch (error) {
    console.error('Backup Restore Error:', error);
    res.status(500).json({ error: '還原備份失敗' });
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
    if (fcn.koNotified) continue; // Skip KO check only if notification already sent
    
    let modified = false;
    
    let isEvaluationDay = false;
    const todayStr = getLatestClosedTradingDate();

    const isStepDown = fcn.name.toLowerCase().includes('stepdown') || 
                       fcn.name.toLowerCase().includes('step down') || 
                       (fcn.note && (fcn.note.toLowerCase().includes('stepdown') || fcn.note.toLowerCase().includes('step down')));

    if (isStepDown) {
      // Step Down FCNs: only evaluate on specific observation/payment dates
      const datesToCheck = (fcn.observationDates && fcn.observationDates.length > 0) 
        ? fcn.observationDates 
        : (fcn.couponPaymentDates || []);
      isEvaluationDay = datesToCheck.includes(todayStr);
    } else {
      // Non-Step Down FCNs: evaluate daily starting from the first observation date
      let firstObsDateStr = null;
      if (fcn.observationDates && fcn.observationDates.length > 0) {
        const sortedDates = [...fcn.observationDates].sort((a, b) => new Date(a) - new Date(b));
        firstObsDateStr = sortedDates[0];
      } else if (fcn.couponPaymentDates && fcn.couponPaymentDates.length > 0) {
        const sortedDates = [...fcn.couponPaymentDates].sort((a, b) => new Date(a) - new Date(b));
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
        isEvaluationDay = dToday >= dFirstObs;
      }
    }

    let allStocksAboveKo = isEvaluationDay;
    let worstStock = null;
    
    for (let stock of fcn.stocks) {
      try {
        const market = await getStockPrice(stock.symbol);
        if (market.price !== null) {
          const currentPercent = (market.price / stock.initialPrice) * 100;
          const stockName = market.name || stock.name || stock.symbol;
          
          const stockPerformance = {
            symbol: stock.symbol,
            name: stockName,
            currentPercent,
            strikePercent: stock.strikePercent,
            kiPercent: stock.kiPercent
          };
          
          if (!worstStock || currentPercent < worstStock.currentPercent) {
            worstStock = stockPerformance;
          }
          
          // Check if stock closed below KI barrier (send daily LINE notification whenever below KI price)
          const kiPercent = stock.kiPercent;
          if (kiPercent > 0 && currentPercent <= kiPercent) {
            console.log(`[Daily KI Alert] FCN "${fcn.name}" stock ${stock.symbol} closed at ${currentPercent.toFixed(2)}% (below KI barrier ${kiPercent}%)`);
            
            // Send LINE notification for daily KI trigger
            const kiMsg = `⚠️ FCN 敲入警報！\n\n您的商品「${fcn.name}」連結標的 ${stock.symbol} 今日收盤價跌至期初價的 ${currentPercent.toFixed(2)}%，低於 KI 門檻 (${kiPercent}%)！\n\n請登入系統查看風險狀況：\nhttps://fcn-tracking.zeabur.app/`;
            await sendLineNotification(kiMsg);
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
    
    if (allStocksAboveKo && !fcn.koNotified) {
      console.log(`[Auto-Trigger Alert] FCN "${fcn.name}" has met KO (Knock-out) conditions. All underlying stocks are at or above their KO barriers.`);
      fcn.isKoTriggered = true;
      fcn.koNotified = true;
      modified = true;
      
      const msg = `🔔 FCN 敲出提醒！\n\n您的商品「${fcn.name}」所有標的皆已高於敲出水位 (${fcn.stocks?.[0]?.koPercent}%)，已滿足評價敲出條件 (KO)！\n\n請登入系統辦理結算平倉：\nhttps://fcn-tracking.zeabur.app/`;
      await sendLineNotification(msg);
    }

    // Check if today is the maturity date (based on US latest closed trading date) to send a LINE reminder
    if (fcn.maturityDate && !fcn.maturityNotified && !fcn.isKoTriggered) {
      const todayStr = getLatestClosedTradingDate();

      if (fcn.maturityDate === todayStr) {
        console.log(`[Maturity Alert] FCN "${fcn.name}" has reached maturity date: ${fcn.maturityDate}`);
        
        // EKI check: check if worst stock is below strikePercent at maturity
        const isStrikeBreached = worstStock && worstStock.currentPercent <= worstStock.strikePercent;
        const outcomeText = isStrikeBreached 
          ? `⚠️ 最差標的 (${worstStock.symbol}) 已跌破履約價 (${worstStock.strikePercent}%)，到期將進行【實物交割 (接股)】。` 
          : `🎉 所有標的皆高於履約價，到期將進行【現金全額收回】！`;

        const msg = `🔔 FCN 到期提醒！\n\n您的商品「${fcn.name}」已於今日（${fcn.maturityDate}）達到合約到期日！\n\n最終標的表現：\n最差標的為 ${worstStock ? worstStock.symbol : '無'} (${worstStock ? worstStock.currentPercent.toFixed(2) : 0}%)\n\n${outcomeText}\n\n請登入系統辦理結算平倉：\nhttps://fcn-tracking.zeabur.app/`;
        
        fcn.maturityNotified = true;
        modified = true;
        await sendLineNotification(msg);
      }
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

// --- Delivered Stocks API Endpoints ---
const DELIVERED_DB_PATH = process.env.DATA_PATH 
  ? path.join(process.env.DATA_PATH, 'delivered_stocks.json') 
  : path.join(__dirname, 'data', 'delivered_stocks.json');

async function readDeliveredDb() {
  try {
    const raw = await fs.readFile(DELIVERED_DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.mkdir(path.dirname(DELIVERED_DB_PATH), { recursive: true });
      const templatePath = path.join(__dirname, 'data', 'delivered_stocks.json');
      try {
        const templateRaw = await fs.readFile(templatePath, 'utf-8');
        await fs.writeFile(DELIVERED_DB_PATH, templateRaw, 'utf-8');
        return JSON.parse(templateRaw);
      } catch (err) {
        await fs.writeFile(DELIVERED_DB_PATH, '[]', 'utf-8');
        return [];
      }
    }
    console.error('Error reading delivered stocks db:', error);
    return [];
  }
}

async function writeDeliveredDb(data) {
  try {
    await fs.mkdir(path.dirname(DELIVERED_DB_PATH), { recursive: true });
    await fs.writeFile(DELIVERED_DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing delivered stocks db:', error);
  }
}

app.get('/api/delivered-stocks', async (req, res) => {
  try {
    const list = await readDeliveredDb();
    const enrichedList = [];
    
    for (let item of list) {
      let currentPrice = null;
      let prevClose = null;
      let error = null;
      
      try {
        const market = await getStockPrice(item.stockSymbol);
        currentPrice = market.price;
        prevClose = market.prevClose;
      } catch (err) {
        error = err.message;
      }
      
      const shares = Number(item.deliveredShares) || 0;
      const strike = Number(item.strikePrice) || 0;
      const totalCost = shares * strike;
      const totalInterest = Number(item.totalInterestReceived) || 0;
      
      let currentValue = null;
      let unrealizedPnL = null;
      let unrealizedPnLPct = null;
      let netPnL = null;
      
      if (currentPrice !== null) {
        currentValue = shares * currentPrice;
        unrealizedPnL = currentValue - totalCost;
        netPnL = unrealizedPnL + totalInterest;
        if (totalCost > 0) {
          unrealizedPnLPct = (currentPrice - strike) / strike * 100;
        }
      }
      
      enrichedList.push({
        ...item,
        currentPrice,
        prevClose,
        currentValue,
        totalCost,
        unrealizedPnL,
        unrealizedPnLPct,
        netPnL,
        error
      });
    }
    
    res.json(enrichedList);
  } catch (error) {
    console.error('GET delivered stocks error:', error);
    res.status(500).json({ error: 'Failed to retrieve delivered stocks' });
  }
});

app.post('/api/delivered-stocks', async (req, res) => {
  try {
    const list = await readDeliveredDb();
    const newItem = {
      id: `ds-${Date.now()}`,
      fcnCode: req.body.fcnCode || '',
      isin: req.body.isin || '',
      productType: req.body.productType || 'FCN',
      issuer: req.body.issuer || '',
      currency: req.body.currency || 'USD',
      annualCouponRate: req.body.annualCouponRate !== undefined ? Number(req.body.annualCouponRate) : null,
      accruedDays: req.body.accruedDays !== undefined ? Number(req.body.accruedDays) : null,
      totalDays: req.body.totalDays !== undefined ? Number(req.body.totalDays) : null,
      couponPerUnit: req.body.couponPerUnit !== undefined ? Number(req.body.couponPerUnit) : null,
      finalValuationDate: req.body.finalValuationDate || '',
      maturityDate: req.body.maturityDate || '',
      stockName: req.body.stockName || '',
      stockSymbol: (req.body.stockSymbol || '').trim().toUpperCase(),
      stockCurrency: req.body.stockCurrency || 'USD',
      valuationClosePrice: req.body.valuationClosePrice !== undefined ? Number(req.body.valuationClosePrice) : null,
      strikePrice: req.body.strikePrice !== undefined ? Number(req.body.strikePrice) : 0,
      exchangeRate: req.body.exchangeRate !== undefined ? Number(req.body.exchangeRate) : 1,
      deliveredShares: req.body.deliveredShares !== undefined ? Number(req.body.deliveredShares) : 0,
      fractionalShares: req.body.fractionalShares !== undefined ? Number(req.body.fractionalShares) : null,
      fractionalCash: req.body.fractionalCash !== undefined ? Number(req.body.fractionalCash) : null,
      totalInterestReceived: req.body.totalInterestReceived !== undefined ? Number(req.body.totalInterestReceived) : 0,
      note: req.body.note || '',
      createdAt: new Date().toISOString()
    };

    if (!newItem.stockSymbol) {
      return res.status(400).json({ error: 'Stock symbol is required' });
    }

    list.push(newItem);
    await writeDeliveredDb(list);
    
    // Warm up price cache for this stock asynchronously
    getStockPrice(newItem.stockSymbol).catch(() => {});

    res.status(201).json(newItem);
  } catch (error) {
    console.error('POST delivered stock error:', error);
    res.status(500).json({ error: 'Failed to save delivered stock record' });
  }
});

app.put('/api/delivered-stocks/:id', async (req, res) => {
  try {
    const list = await readDeliveredDb();
    const index = list.findIndex(item => item.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Record not found' });
    }

    const item = list[index];
    const updatedItem = {
      ...item,
      fcnCode: req.body.fcnCode !== undefined ? req.body.fcnCode : item.fcnCode,
      isin: req.body.isin !== undefined ? req.body.isin : item.isin,
      productType: req.body.productType !== undefined ? req.body.productType : item.productType,
      issuer: req.body.issuer !== undefined ? req.body.issuer : item.issuer,
      currency: req.body.currency !== undefined ? req.body.currency : item.currency,
      annualCouponRate: req.body.annualCouponRate !== undefined ? Number(req.body.annualCouponRate) : item.annualCouponRate,
      accruedDays: req.body.accruedDays !== undefined ? Number(req.body.accruedDays) : item.accruedDays,
      totalDays: req.body.totalDays !== undefined ? Number(req.body.totalDays) : item.totalDays,
      couponPerUnit: req.body.couponPerUnit !== undefined ? Number(req.body.couponPerUnit) : item.couponPerUnit,
      finalValuationDate: req.body.finalValuationDate !== undefined ? req.body.finalValuationDate : item.finalValuationDate,
      maturityDate: req.body.maturityDate !== undefined ? req.body.maturityDate : item.maturityDate,
      stockName: req.body.stockName !== undefined ? req.body.stockName : item.stockName,
      stockSymbol: req.body.stockSymbol !== undefined ? (req.body.stockSymbol || '').trim().toUpperCase() : item.stockSymbol,
      stockCurrency: req.body.stockCurrency !== undefined ? req.body.stockCurrency : item.stockCurrency,
      valuationClosePrice: req.body.valuationClosePrice !== undefined ? Number(req.body.valuationClosePrice) : item.valuationClosePrice,
      strikePrice: req.body.strikePrice !== undefined ? Number(req.body.strikePrice) : item.strikePrice,
      exchangeRate: req.body.exchangeRate !== undefined ? Number(req.body.exchangeRate) : item.exchangeRate,
      deliveredShares: req.body.deliveredShares !== undefined ? Number(req.body.deliveredShares) : item.deliveredShares,
      fractionalShares: req.body.fractionalShares !== undefined ? Number(req.body.fractionalShares) : item.fractionalShares,
      fractionalCash: req.body.fractionalCash !== undefined ? Number(req.body.fractionalCash) : item.fractionalCash,
      totalInterestReceived: req.body.totalInterestReceived !== undefined ? Number(req.body.totalInterestReceived) : item.totalInterestReceived,
      note: req.body.note !== undefined ? req.body.note : item.note,
      updatedAt: new Date().toISOString()
    };

    list[index] = updatedItem;
    await writeDeliveredDb(list);
    
    // Warm up price cache for this stock asynchronously
    getStockPrice(updatedItem.stockSymbol).catch(() => {});

    res.json(updatedItem);
  } catch (error) {
    console.error('PUT delivered stock error:', error);
    res.status(500).json({ error: 'Failed to update delivered stock record' });
  }
});

app.delete('/api/delivered-stocks/:id', async (req, res) => {
  try {
    const list = await readDeliveredDb();
    const index = list.findIndex(item => item.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Record not found' });
    }

    list.splice(index, 1);
    await writeDeliveredDb(list);
    res.json({ message: 'Record deleted successfully' });
  } catch (error) {
    console.error('DELETE delivered stock error:', error);
    res.status(500).json({ error: 'Failed to delete delivered stock record' });
  }
});

// Schedule daily FCN trigger checks at 8:30 AM (Asia/Taipei time, Tuesday through Saturday only)
cron.schedule('30 8 * * 2-6', async () => {
  try {
    await evaluateFCNTriggers();
  } catch (error) {
    console.error('Error in scheduled daily FCN evaluation:', error);
  }
}, {
  scheduled: true,
  timezone: "Asia/Taipei"
});

// Serve frontend in production
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
