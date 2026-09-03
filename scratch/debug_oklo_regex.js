async function debugOklo() {
  const querySymbol = 'OKLO:NYSE';
  const url = `https://www.google.com/finance/quote/${encodeURIComponent(querySymbol)}`;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      }
    });
    const html = await response.text();
    
    // Find all blocks of AF_initDataCallback matching our regex
    const regex = /\[\[\[\[null,\["([A-Z0-9\.]+)","([A-Z0-9\.]+)"\]\],null,([\d\.]+),(?:"[^"]*"|null),([\d\.]+)/g;
    let match;
    console.log('--- All Regex Matches ---');
    while ((match = regex.exec(html)) !== null) {
      console.log(`Match at index ${match.index}:`);
      console.log(`  Symbol: ${match[1]}`);
      console.log(`  Exchange: ${match[2]}`);
      console.log(`  Value A: ${match[3]}`);
      console.log(`  Value B: ${match[4]}`);
    }
    
    // Let's also search for 41.09 and 36.84 in the script blocks to see where they are stored!
    console.log('\n--- Searching for target values 41.09 and 36.84 ---');
    const idx41 = html.indexOf('41.09');
    if (idx41 !== -1) {
      console.log(`Found 41.09 at index ${idx41}:`);
      console.log(html.substring(idx41 - 100, idx41 + 100));
    } else {
      console.log('41.09 not found in HTML source');
    }
    
    const idx36 = html.indexOf('36.84');
    if (idx36 !== -1) {
      console.log(`Found 36.84 at index ${idx36}:`);
      console.log(html.substring(idx36 - 100, idx36 + 100));
    } else {
      console.log('36.84 not found in HTML source');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

debugOklo();
