const fs = require('fs');
const pdf = require('pdf-parse');

const pdfPath = './137.e18898e18cbde18890e18d88-e18985e18bb3e188b4geezamharicenglish.pdf';
const buffer = fs.readFileSync(pdfPath);

pdf(buffer).then(data => {
    const text = data.text;
    console.log(`Total pages: ${data.numpages}`);
    console.log(`Total chars: ${text.length}`);
    console.log('--- FIRST 8000 CHARS ---');
    console.log(text.substring(0, 8000));
    
    fs.writeFileSync('./pdf_extracted.txt', text);
    console.log('\n--- FULL TEXT SAVED TO pdf_extracted.txt ---');
}).catch(err => console.error(err));
