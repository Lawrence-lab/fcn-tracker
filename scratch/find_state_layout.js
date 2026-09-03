async function findLayout() {
  const querySymbol = 'OKLO:NYSE';
  const url = `https://www.google.com/finance/quote/${encodeURIComponent(querySymbol)}`;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      }
    });
    const html = await response.text();
    
    // Find all <script> tags containing AF_initDataCallback
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/g;
    let match;
    let count = 0;
    while ((match = scriptRegex.exec(html)) !== null) {
      const scriptContent = match[1];
      if (scriptContent.includes('AF_initDataCallback')) {
        count++;
        // If this script block contains 41.09 or OKLO, inspect it!
        if (scriptContent.includes('41.09') || scriptContent.includes('OKLO')) {
          console.log(`\n--- Script Block ${count} (Length: ${scriptContent.length}) ---`);
          // Print snippet around OKLO
          const idx = scriptContent.indexOf('OKLO');
          if (idx !== -1) {
            console.log(`Snippet around OKLO:\n${scriptContent.substring(idx - 100, idx + 400)}`);
          } else {
            console.log('OKLO not found in this block, but block contains 41.09.');
            const idxVal = scriptContent.indexOf('41.09');
            console.log(`Snippet around 41.09:\n${scriptContent.substring(idxVal - 100, idxVal + 200)}`);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

findLayout();
