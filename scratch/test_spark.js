// Native fetch is globally available in Node 22
const symbols = ['MSTR', 'OKLO', 'SOXX', 'AVGO'];

async function testSpark() {
  const symbolList = symbols.join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${symbolList}&range=1d&interval=5m`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    console.log(`Status: ${res.status} ${res.statusText}`);
    if (res.ok) {
      const data = await res.json();
      console.log('Spark Response Keys:', Object.keys(data));
      const sparkData = data?.spark?.result || [];
      console.log(`Found ${sparkData.length} results:`);
      sparkData.forEach(item => {
        const symbol = item.symbol;
        const response = item.response?.[0];
        const meta = response?.meta;
        const indicators = response?.indicators?.quote?.[0] || {};
        const closeArray = indicators.close || [];
        const currentPrice = meta?.regularMarketPrice || closeArray[closeArray.length - 1];
        const prevClose = meta?.chartPreviousClose;
        console.log(`- ${symbol}: Price=${currentPrice}, PrevClose=${prevClose}, Name=${meta?.longName || meta?.shortName || symbol}`);
      });
    } else {
      const text = await res.text();
      console.log('Error Response:', text);
    }
  } catch (err) {
    console.error('Exception:', err.message);
  }
}

testSpark();
