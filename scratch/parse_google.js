import fs from 'fs/promises';

async function parse() {
  try {
    const html = await fs.readFile('scratch/google.html', 'utf-8');
    console.log(`HTML size: ${html.length} characters`);
    
    // Search for common stock price class: YMlKec
    const classIdx = html.indexOf('YMlKec');
    if (classIdx !== -1) {
      console.log(`Found YMlKec class at index ${classIdx}!`);
      
      // Let's find all YMlKec elements in the HTML
      const regex = /class="[^"]*YMlKec[^"]*"[^>]*>([^<]+)/g;
      let match;
      let count = 0;
      while ((match = regex.exec(html)) !== null && count < 25) {
        console.log(`Match ${count++}: value: ${match[1]}`);
      }
    } else {
      console.log('Class YMlKec not found.');
    }
  } catch (err) {
    console.error(err);
  }
}

parse();
