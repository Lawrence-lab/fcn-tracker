// Native fetch is globally available in Node 22
const symbols = ['TSM', 'MSTR', 'OKLO', 'SOXX'];

async function testQuoteSummary(symbol) {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=price`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    console.log(`\n--- Symbol: ${symbol} ---`);
    console.log(`Status: ${res.status} ${res.statusText}`);
    if (res.ok) {
      const data = await res.json();
      const priceObj = data?.quoteSummary?.result?.[0]?.price;
      if (priceObj) {
        console.log(`Price: ${priceObj.regularMarketPrice?.raw}`);
        console.log(`PrevClose: ${priceObj.regularMarketPreviousClose?.raw}`);
        console.log(`Name: ${priceObj.longName}`);
      } else {
        console.log('No price data found in response.');
      }
    } else {
      const text = await res.text();
      console.log(`Error Response: ${text}`);
    }
  } catch (err) {
    console.error('Exception:', err.message);
  }
}

async function run() {
  for (const s of symbols) {
    await testQuoteSummary(s);
  }
}

run();
