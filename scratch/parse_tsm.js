import fs from 'fs/promises';

async function parse() {
  const html = await fs.readFile('scratch/google.html', 'utf-8');
  
  // Search for the price (which was 397.555 or around 397)
  const target = '397';
  let idx = 0;
  while ((idx = html.indexOf(target, idx)) !== -1) {
    console.log(`Found target at index ${idx}!`);
    console.log(`Context: ${html.substring(idx - 100, idx + 100)}\n`);
    idx += target.length;
  }
}

parse();
