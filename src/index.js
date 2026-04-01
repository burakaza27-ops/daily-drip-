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
// 2. AI Insight Generation
// -----------------------------------------
async function generateInsight(segment) {
    const prompt = `CRITICAL SYSTEM INSTRUCTION: Output MUST BE exactly 1 to 2 sentences of profound spiritual insight in English. DO NOT output HTML, MD or anything else.

You are a Distinguished Spiritual Father of the Ethiopian Orthodox Tewahedo Church.
Analyze this specific segment of the Anaphora of the Apostles (Qidasie Hawaryat):

Role: ${segment.role}
Ge'ez: ${segment.geez_text}
English: ${segment.english_text}

Explain the deep spiritual symbolic meaning of this exact segment ("When the Priest says X, it symbolizes Y"). Make it sound like "Quiet-Luxury" spiritual wisdom. 1-2 sentences maximum.`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn('⚠ GEMINI_API_KEY not found. Using fallback hardcoded insight.');
        return "In this sacred exchange, the physical and spiritual realms unite, reminding us of the eternal presence of the Holy Trinity in our daily communion.";
    }

    try {
        console.log('Generating AI Insight...');
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
        return "This sacred dialogue anchors our faith, acting as a spiritual compass guiding us towards eternal heavenly grace.";
    }
}

// -----------------------------------------
// 3. Template Rendering (Puppeteer)
// -----------------------------------------
async function renderHtmlToImage(segment, insight) {
    console.log('Injecting data into template...');
    const tplPath = path.resolve('./templates/liturgy_teaching.html');
    let html = await fs.readFile(tplPath, 'utf-8');

    // Role mapping formatting
    const roleMapping = {
        'Priest': 'Priest ጵርስፎራ',
        'Deacon': 'Deacon ዲያቆን',
        'People': 'People ሕዝብ'
    };
    const roleStr = roleMapping[segment.role] || segment.role;

    html = html.replace('{{role}}', roleStr)
               .replace('{{geez_text}}', segment.geez_text)
               .replace('{{amharic_text}}', segment.amharic_text)
               .replace('{{english_text}}', segment.english_text)
               .replace('{{spiritual_insight}}', insight);

    // Save temporary hydrated HTML
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
        // Use file protocol to load the local file
        await page.goto(`file://${tmpHtmlPath}`, { waitUntil: 'networkidle0' });

        const outputDir = path.resolve('./output');
        await fs.mkdir(outputDir, { recursive: true });
        
        const outputPath = path.join(outputDir, `liturgy_${segment.id}_${Date.now()}.png`);
        
        console.log(`Taking screenshot: ${outputPath}`);
        await page.screenshot({ path: outputPath, type: 'png' });
        
        console.log('✅ Successfully generated high-resolution media.');
        return outputPath;
    } finally {
        await browser.close();
        // Clean up temp file
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
        console.warn('⚠ Telegram credentials not found. Skipping broadcast.');
        return;
    }

    const chatIds = chatIdsRaw.split(',').map(id => id.trim()).filter(id => id);
    if (chatIds.length === 0) return;

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
            const res = await fetch(url, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Telegram API Error: ${res.status} ${text}`);
            }
            console.log(`✅ Successfully sent to chat: ${chatId}`);
        } catch (e) {
            console.error(`❌ Failed to send to chat: ${chatId}`, e);
        }
    }
}

// -----------------------------------------
// Main Execution Branch
// -----------------------------------------
async function main() {
    const args = process.argv.slice(2);
    const contentType = args.includes('--type=liturgy_teaching') ? 'liturgy_teaching' : 'default';

    if (contentType === 'liturgy_teaching') {
        console.log('🚀 Starting Kidase Liturgy Pipeline');
        const segment = await loadKidaseData();
        console.log(`Loaded segment: ${segment.part_name} - ${segment.role}`);
        
        const insight = await generateInsight(segment);
        console.log(`Insight: ${insight}`);
        
        const outputPath = await renderHtmlToImage(segment, insight);
        
        const caption = `<b>❖ 📅 የዕለቱ ቅዳሴ ምስጢር ❖</b>\n\n📖 <b>${segment.part_name} | ${segment.role}</b>\n\n✨ <i>${insight}</i>\n\nለመንፈሳዊ ቤተሰብዎ ያካፍሉ 🕊️`;
        
        await broadcastToTelegram(outputPath, caption);
    } else {
        console.log('Skipping Liturgy generation. Unknown content type or missing flag.');
    }
}

main().catch(console.error);
