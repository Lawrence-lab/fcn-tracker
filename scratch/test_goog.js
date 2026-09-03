async function testOklo() {
  const querySymbol = 'OKLO:NYSE';
  const url = `https://www.google.com/finance/quote/${encodeURIComponent(querySymbol)}`;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      }
    });
    console.log(`Status: ${response.status}`);
    const html = await response.text();
    const regex = /\[\[\[\[null,\["([A-Z0-9\.]+)","([A-Z0-9\.]+)"\]\],null,([\d\.]+),(?:"[^"]*"|null),([\d\.]+)/;
    const match = html.match(regex);
    if (match) {
      console.log('Match found!');
      console.log(`Symbol: ${match[1]}`);
      console.log(`Exchange: ${match[2]}`);
      console.log(`Price: ${match[3]}`);
      console.log(`Prev Close: ${match[4]}`);
    } else {
      console.log('No match found.');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testOklo();
