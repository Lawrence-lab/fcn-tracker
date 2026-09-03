// Native fetch is globally available in Node 22
const symbols = ['MSTR', 'OKLO', 'WOLF', 'SOXX', 'TSM', 'AMD', 'MU', 'NVDA'];

async function testBulkQuote() {
  const symbolList = symbols.join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbolList}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    console.log(`Status: ${res.status} ${res.statusText}`);
    if (res.ok) {
      const data = await res.json();
      const results = data?.quoteResponse?.result || [];
      console.log(`Found ${results.length} results:`);
      results.forEach(item => {
        console.log(`- ${item.symbol}: Price=${item.regularMarketPrice}, PrevClose=${item.regularMarketPreviousClose}, Name=${item.longName || item.shortName}, Currency=${item.currency}`);
      });
    } else {
      const text = await res.text();
      console.log(`Error Response: ${text}`);
    }
  } catch (err) {
    console.error('Exception:', err.message);
  }
}

testBulkQuote();
