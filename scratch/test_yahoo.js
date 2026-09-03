// Native fetch is globally available in Node 22

const symbols = ['MSTR', 'OKLO', 'WOLF', 'SOXX'];

async function testYahoo(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
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
      const result = data?.chart?.result?.[0];
      if (result) {
        console.log(`Price: ${result.meta.regularMarketPrice}`);
        console.log(`PrevClose: ${result.meta.chartPreviousClose}`);
      } else {
        console.log('No result in response.');
      }
    } else {
      const text = await res.text();
      console.log(`Error Response: ${text.substring(0, 300)}`);
    }
  } catch (err) {
    console.error(`Fetch exception for ${symbol}:`, err.message);
  }
}

async function run() {
  for (const s of symbols) {
    await testYahoo(s);
  }
}

run();
