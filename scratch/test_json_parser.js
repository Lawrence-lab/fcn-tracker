async function testJsonParser(querySymbol) {
  const url = `https://www.google.com/finance/quote/${encodeURIComponent(querySymbol)}`;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      }
    });
    const html = await response.text();
    
    const match = html.match(/AF_initDataCallback\s*\(\s*\{\s*key\s*:\s*'(ds:9|ds:16)'[\s\S]*?data\s*:\s*([\s\S]*?)\s*,\s*sideChannel/);
    if (match) {
      const dataStr = match[2];
      const data = JSON.parse(dataStr);
      const stockData = data?.[0]?.[0];
      if (stockData) {
        const symbol = stockData[0]?.[1]?.[0];
        const exchange = stockData[0]?.[1]?.[1];
        const openPrice = stockData[2];
        const lowPrice = stockData[4];
        const highPrice = stockData[5];
        const currentPrice = stockData[6];
        const prevClose = stockData[15];
        const name = stockData[14];
        
        console.log(`Success for ${querySymbol}:`);
        console.log(`  Name: ${name}`);
        console.log(`  Symbol: ${symbol}`);
        console.log(`  Exchange: ${exchange}`);
        console.log(`  Open Price: ${openPrice}`);
        console.log(`  Low Price: ${lowPrice}`);
        console.log(`  High Price: ${highPrice}`);
        console.log(`  Current Price (Real): ${currentPrice}`);
        console.log(`  Previous Close (Real): ${prevClose}`);
        return;
      }
    }
    console.log(`No JSON state match found for ${querySymbol}.`);
  } catch (err) {
    console.error(`Error:`, err.message);
  }
}

async function run() {
  await testJsonParser('OKLO:NYSE');
  console.log('\n------------------\n');
  await testJsonParser('TSM:NYSE');
}

run();
