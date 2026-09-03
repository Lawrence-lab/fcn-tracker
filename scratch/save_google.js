// Native fetch is globally available in Node 22
async function saveGoogleFinance() {
  const url = 'https://www.google.com/finance/quote/TSM:NYSE';
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (res.ok) {
      const html = await res.text();
      // Write html to a scratch file
      const fs = await import('fs/promises');
      await fs.writeFile('scratch/google.html', html, 'utf-8');
      console.log('Successfully saved google.html!');
    } else {
      console.log(`Failed with status: ${res.status}`);
    }
  } catch (err) {
    console.error(err);
  }
}

saveGoogleFinance();
