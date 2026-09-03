import fs from 'fs/promises';

async function parse() {
  const html = await fs.readFile('scratch/google.html', 'utf-8');
  
  // Search for the word "TSM" in the script tags
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/g;
  let match;
  let count = 0;
  while ((match = scriptRegex.exec(html)) !== null) {
    const content = match[1];
    if (content.includes('TSM') && content.includes('NYSE')) {
      console.log(`\n--- Script Block ${count++} (Size: ${content.length}) ---`);
      // Print first 500 chars and last 500 chars of this script block
      console.log(`Start:\n${content.substring(0, 400)}`);
      console.log(`End:\n${content.substring(content.length - 400)}`);
    }
  }
}

parse();
