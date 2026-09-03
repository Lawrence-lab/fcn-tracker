// Native fetch is globally available in Node 22
const symbols = [
  { symbol: 'TSM', exchange: 'NYSE' },
  { symbol: 'MSTR', exchange: 'NASDAQ' },
  { symbol: 'OKLO', exchange: 'NYSE' },
  { symbol: 'SOXX', exchange: 'NASDAQ' }
];

async function testGoogleFinance({ symbol, exchange }) {
  const url = `https://www.google.com/finance/quote/${symbol}:${exchange}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    console.log(`\n--- Symbol: ${symbol} ---`);
    console.log(`Status: ${res.status} ${res.statusText}`);
    if (res.ok) {
      const html = await res.text();
      
      // Look for schema markup: <meta itemprop="price" content="397.44" />
      const priceRegex = /<meta[^>]*itemprop="price"[^>]*content="([^"]+)"/i;
      const priceMatch = html.match(priceRegex);
      
      // Look for previous close in Google HTML
      // Let's print a small chunk around itemprop="price" to inspect
      const idx = html.indexOf('itemprop="price"');
      if (idx !== -1) {
        console.log(`Found itemprop="price" match: ${html.substring(idx - 100, idx + 100)}`);
      }

      if (priceMatch) {
        console.log(`Parsed price: ${priceMatch[1]}`);
      } else {
        console.log('Price regex did not match.');
      }
    } else {
      console.log('Error fetching page');
    }
  } catch (err) {
    console.error('Exception:', err.message);
  }
}

async function run() {
  for (const s of symbols) {
    await testGoogleFinance(s);
  }
}

run();
