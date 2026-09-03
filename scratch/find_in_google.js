import fs from 'fs/promises';

async function findPricePatterns() {
  const html = await fs.readFile('scratch/google.html', 'utf-8');
  
  // Let's search for "TSM" or "Taiwan Semiconductor Manufacturing"
  const keyword = 'Taiwan Semiconductor Manufacturing';
  const idx = html.indexOf(keyword);
  if (idx !== -1) {
    console.log(`Found keyword at index ${idx}!`);
    console.log(`Context:\n${html.substring(idx, idx + 500)}`);
  }

  // Let's search for things like "$17" or "$16" or "$15" or "$18" or "$19"
  // Wait, what is the price of TSM ADR on NYSE? 
  // Let's find occurrences of currency symbol followed by numbers or look for specific meta tags
  const metaRegex = /<meta[^>]*>/g;
  const metaTags = html.match(metaRegex) || [];
  console.log(`\nFound ${metaTags.length} meta tags:`);
  metaTags.forEach(tag => {
    if (tag.includes('price') || tag.includes('USD') || tag.includes('currency') || tag.includes('value')) {
      console.log(`- ${tag}`);
    }
  });

  // Let's search for JSON-LD scripts
  const scriptRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let match;
  console.log('\nJSON-LD Scripts:');
  while ((match = scriptRegex.exec(html)) !== null) {
    console.log(match[0].substring(0, 300));
  }
}

findPricePatterns();
