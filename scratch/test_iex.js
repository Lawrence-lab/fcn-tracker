// Native fetch is globally available in Node 22
const symbols = ['MSTR', 'OKLO', 'SOXX', 'AVGO'];

async function testIex() {
  const symbolList = symbols.join(',').toLowerCase();
  const url = `https://api.iextrading.com/1.0/tops/last?symbols=${symbolList}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    console.log(`Status: ${res.status} ${res.statusText}`);
    if (res.ok) {
      const data = await res.json();
      console.log('IEX Response:', JSON.stringify(data, null, 2));
    } else {
      const text = await res.text();
      console.log('Error Response:', text);
    }
  } catch (err) {
    console.error('Exception:', err.message);
  }
}

testIex();
