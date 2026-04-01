import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer';
import 'dotenv/config';

// -----------------------------------------
// 1. Data Loading
// -----------------------------------------
async function loadKidaseData() {
    const dataPath = path.resolve('./src/data/qidasie_hawaryat.json');
    const raw = await fs.readFile(dataPath, 'utf-8');
    const parts = JSON.parse(raw);
    // Select a random part
    return parts[Math.floor(Math.random() * parts.length)];
}

// -----------------------------------------
// 2. AI Insight Generation (Theological Amharic)
// -----------------------------------------
async function generateInsight(segment) {
    const prompt = `CRITICAL SYSTEM INSTRUCTION: Output MUST BE in Perfect, Elegant, Theological AMHARIC (Mistir/ምስጢር). DO NOT output English, HTML, or Markdown.

You are a Liturgical Scholar and Spiritual Father of the Ethiopian Orthodox Tewahedo Church.
Analyze this segment of the Anaphora of the Apostles (Qidasie Hawaryat):

Liturgy Part: ${segment.liturgy_part}
Priest Says: ${segment.priest_geez} (${segment.priest_amharic})
People Respond: ${segment.people_geez} (${segment.people_amharic})

Explain the deep spiritual symbolic mystery (Mistir) of this specific exchange in the Apostles' Liturgy. Why is this dialogue essential? Write 1-2 profound sentences in AMHARIC that reflect "Quiet-Luxury" spiritual wisdom.`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn('⚠ GEMINI_API_KEY not found. Using fallback hardcoded insight.');
        return "ይህ ቅዱስ ውይይት በክህነቱና በምእመናን መካከል ያለውን ሰማያዊ አንድነት የሚገልጽ ሲሆን፥ ልባችንን ወደ እግዚአብሔር መንግሥት ከፍ እንድናደርግ ያሳስበናል።";
    }

    try {
        console.log('Generating AI Insight in Amharic...');
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://github.com/burakaza27-ops/daily-drip-'
            },
            body: JSON.stringify({
                model: 'google/gemini-2.0-flash-001',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7
            })
        });

        if (!res.ok) throw new Error(`API returned ${res.status}`);
        const data = await res.json();
        return data.choices[0].message.content.trim().replace(/"/g, '');
    } catch (e) {
        console.error('AI Generation Failed:', e);
        return "ይህ ሚስጥራዊ ንግግር የሰውን ልጅ ከፈጣሪው ጋር የሚያገናኝ የጸሎት መሰላል ነው፤ ይህም በቤተክርስቲያን አንድነት ውስጥ የሚገኝ የጸጋ ምንጭ ነው።";
    }
}

// -----------------------------------------
// 3. Template Rendering (Puppeteer with Font Detection)
// -----------------------------------------
async function renderHtmlToImage(segment, insight) {
    console.log('Injecting data into template...');
    const tplPath = path.resolve('./templates/liturgy_teaching.html');
    let html = await fs.readFile(tplPath, 'utf-8');

    html = html.replace('{{liturgy_part}}', segment.liturgy_part)
               .replace('{{priest_geez}}', segment.priest_geez)
               .replace('{{priest_amharic}}', segment.priest_amharic)
               .replace('{{people_geez}}', segment.people_geez)
               .replace('{{people_amharic}}', segment.people_amharic)
               .replace('{{teaching_insight}}', insight);

    const tmpHtmlPath = path.resolve('./templates/temp_render.html');
    await fs.writeFile(tmpHtmlPath, html);

    console.log('Booting Puppeteer...');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 });
        
        await page.goto(`file://${tmpHtmlPath}`, { waitUntil: 'networkidle0' });

        // CRITICAL: Wait for fonts (Abyssinica SIL & Noto Sans) to load
        console.log('Waiting for sacred fonts to load...');
        await page.evaluateHandle('document.fonts.ready');

        const outputDir = path.resolve('./output');
        await fs.mkdir(outputDir, { recursive: true });
        
        const outputPath = path.join(outputDir, `liturgy_${segment.id}_${Date.now()}.png`);
        await page.screenshot({ path: outputPath, type: 'png' });
        
        console.log(`✅ Media successfully rendered: ${outputPath}`);
        return outputPath;
    } finally {
        await browser.close();
        await fs.unlink(tmpHtmlPath).catch(() => {});
    }
}

// -----------------------------------------
// 4. Telegram Broadcasting
// -----------------------------------------
async function broadcastToTelegram(imagePath, caption) {
    const token = process.env.TELEGRAM_TOKEN;
    const chatIdsRaw = process.env.TELEGRAM_CHAT_IDS;
    
    if (!token || !chatIdsRaw) {
        console.warn('⚠ Telegram credentials missing. Skipping broadcast.');
        return;
    }

    const chatIds = chatIdsRaw.split(',').map(id => id.trim()).filter(id => id);
    console.log('Broadcasting to Telegram...');
    
    const fileBuffer = await fs.readFile(imagePath);
    const fileBlob = new Blob([fileBuffer], { type: 'image/png' });

    for (const chatId of chatIds) {
        try {
            const formData = new FormData();
            formData.append('chat_id', chatId);
            formData.append('caption', caption);
            formData.append('parse_mode', 'HTML');
            formData.append('photo', fileBlob, path.basename(imagePath));

            const url = `https://api.telegram.org/bot${token}/sendPhoto`;
            const res = await fetch(url, { method: 'POST', body: formData });

            if (!res.ok) throw new Error(await res.text());
            console.log(`✅ Sent to chat: ${chatId}`);
        } catch (e) {
            console.error(`❌ Failed for chat: ${chatId}`, e);
        }
    }
}

// -----------------------------------------
// Main Execution
// -----------------------------------------
async function main() {
    const args = process.argv.slice(2);
    const contentType = args.includes('--type=liturgy_teaching') ? 'liturgy_teaching' : 'default';

    if (contentType === 'liturgy_teaching') {
        console.log('🚀 Starting Perfection Phase: Kidase Liturgy');
        const segment = await loadKidaseData();
        
        const insight = await generateInsight(segment);
        console.log(`Insight Generated (Amharic)`);
        
        const outputPath = await renderHtmlToImage(segment, insight);
        
        const caption = `<b>❖ 📅 የዕለቱ ቅዳሴ ምስጢር ❖</b>\n\n📖 <b>${segment.liturgy_part}</b>\n\n✨ <i>${insight}</i>\n\nለመንፈሳዊ ቤተሰብዎ ያካፍሉ 🕊️`;
        
        await broadcastToTelegram(outputPath, caption);
    } else {
        console.log('Invalid or unspecified content type.');
    }
}

main().catch(console.error);
