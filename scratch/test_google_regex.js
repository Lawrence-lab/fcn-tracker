import fs from 'fs/promises';

async function testRegex() {
  const html = await fs.readFile('scratch/google.html', 'utf-8');
  
  // The array starts with [[[[null,["SYMBOL","EXCHANGE"]],null,PRICE,
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
}

testRegex();
