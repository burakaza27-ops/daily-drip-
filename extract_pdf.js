import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';

const pdfPath = './137.e18898e18cbde18890e18d88-e18985e18bb3e188b4geezamharicenglish.pdf';
const data = new Uint8Array(fs.readFileSync(pdfPath));

async function extract() {
    const doc = await getDocument({ data }).promise;
    console.log(`Total pages: ${doc.numPages}`);
    
    let fullText = '';
    // Extract first 30 pages to understand structure
    const pagesToRead = Math.min(doc.numPages, 30);
    
    for (let i = 1; i <= pagesToRead; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str).join(' ');
        fullText += `\n--- PAGE ${i} ---\n${pageText}`;
    }

    fs.writeFileSync('./pdf_extracted.txt', fullText);
    console.log(`Extracted ${pagesToRead} pages to pdf_extracted.txt`);
    // Print first 6000 chars
    console.log(fullText.substring(0, 6000));
}

extract().catch(console.error);
