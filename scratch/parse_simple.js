import fs from 'fs/promises';

async function parse() {
  const html = await fs.readFile('scratch/google.html', 'utf-8');
  
  // Find index of "NYSE: TSM" or similar
  const tickerIndex = html.indexOf('NYSE: TSM') !== -1 ? html.indexOf('NYSE: TSM') : html.indexOf('TSM');
  if (tickerIndex !== -1) {
    console.log(`Ticker index: ${tickerIndex}`);
    console.log(`Context around Ticker:\n${html.substring(tickerIndex - 300, tickerIndex + 300)}\n`);
  }

  // Google Finance price is typically in a div with data-last-price or class starting with YMlKec
  // Let's print any tag that contains the number 397 (which was the price of TSM at the time)
  const priceRegex = /<[^>]*>[^<]*397[^<]*<\/[^>]*>/g;
  const matches = html.match(priceRegex) || [];
  console.log(`Found ${matches.length} tags matching 397:`);
  matches.slice(0, 15).forEach(m => console.log(`- ${m}`));

  // Let's search for the class names containing numbers or prices
  const classRegex = /class="([^"]+)"[^>]*>[^<]*\$[^<]*</g;
  const classMatches = html.match(classRegex) || [];
  console.log(`\nFound ${classMatches.length} class matches for currency symbol:`);
  classMatches.slice(0, 15).forEach(m => console.log(`- ${m}`));
}

parse();
