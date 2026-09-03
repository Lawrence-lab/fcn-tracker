// Native fetch is globally available in Node 22
const subdomains = [
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
  'query3.finance.yahoo.com',
  'query4.finance.yahoo.com',
  'query5.finance.yahoo.com',
  'query-v2.finance.yahoo.com'
];

async function testSubdomains() {
  for (const sub of subdomains) {
    const url = `https://${sub}/v7/finance/spark?symbols=MSTR&range=1d&interval=5m`;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      console.log(`${sub}: Status=${res.status} ${res.statusText}`);
      if (res.ok) {
        const data = await res.json();
        console.log(`- Success! Symbol = ${data?.spark?.result?.[0]?.symbol}`);
      }
    } catch (err) {
      console.log(`${sub}: Error=${err.message}`);
    }
  }
}

testSubdomains();
