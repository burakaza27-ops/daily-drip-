import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import 'dotenv/config';

// -----------------------------------------
// 1. Sequential Data Loading
// -----------------------------------------
async function loadSequentialSegment(anaphoraType) {
    const dataPath = path.resolve(`./src/data/anaphoras/${anaphoraType}.json`);
    const statePath = path.resolve('./src/data/state.json');

    const raw = await fs.readFile(dataPath, 'utf-8');
    const segments = JSON.parse(raw);
    const total = segments.length;

    let state = {};
    try {
        const stateRaw = await fs.readFile(statePath, 'utf-8');
        state = JSON.parse(stateRaw);
    } catch { state = {}; }

    const currentIndex = state[anaphoraType] || 0;
    const segment = segments[currentIndex];

    // Advance
    const nextIndex = (currentIndex + 1) % total;
    state[anaphoraType] = nextIndex;
    await fs.writeFile(statePath, JSON.stringify(state, null, 2));

    console.log(`📖 Teaching Part ${currentIndex + 1} of ${total}`);
    return { segment, stepCurrent: currentIndex + 1, stepTotal: total };
}

// -----------------------------------------
// 2. Scholar AI Refinement
// -----------------------------------------
async function refineSegmentWithAI(segment) {
    const prompt = `CRITICAL SYSTEM INSTRUCTION: Output MUST BE valid JSON only. NO Markdown tags (like \`\`\`json).
You are a Supreme Liturgical Scholar of the EOTC. Refine the dialogue attribution of this segment for perfect teaching rhythm.
Raw: ${JSON.stringify(segment)}
ONLY RETURN THE JSON OBJECT.`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return segment;

    try {
        console.log('📖 Scholar Review...');
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
                response_format: { type: "json_object" },
                temperature: 0.1
            })
        });

        if (!res.ok) throw new Error(`API: ${res.status}`);
        const data = await res.json();
        const refined = JSON.parse(data.choices[0].message.content);
        return { ...segment, ...refined };
    } catch (e) {
        console.error('Scholar Failed:', e.message);
        return segment;
    }
}

// -----------------------------------------
// 3. AI Insight Generation
// -----------------------------------------
async function generateInsight(segment) {
    const prompt = `Output AMHARIC ONLY. You are an EOTC scholar. Explain the spiritual mystery of this exchange:
Part: ${segment.liturgy_part}
Deacon: ${segment.deacon_geez || 'N/A'}
Priest: ${segment.priest_geez || 'N/A'}
People: ${segment.people_geez || 'N/A'}`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return "ይህ ቅዱስ ውይይት የሰማያዊ አንድነት መገለጫ ነው።";

    try {
        console.log('🤖 Generating Insight...');
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

        const data = await res.json();
        return data.choices[0].message.content.trim().replace(/^["'`]+|["'`]+$/g, '');
    } catch (e) {
        console.error('Insight Failed:', e.message);
        return "ይህ ሚስጥራዊ ንግግር የሰውን ልጅ ከፈጣሪው ጋር የሚያገናኝ የጸሎት መሰላል ነው።";
    }
}

// -----------------------------------------
// 4. Template Rendering
// -----------------------------------------
async function renderHtmlToImage(segment, insight, stepCurrent, stepTotal) {
    console.log('🎨 Rendering Card...');
    const tplPath = path.resolve('./templates/liturgy_teaching.html');
    let html = await fs.readFile(tplPath, 'utf-8');

    html = html
        .replace('{{step_current}}', stepCurrent)
        .replace('{{step_total}}', stepTotal)
        .replace('{{liturgy_part}}', segment.liturgy_part)
        .replace('{{deacon_geez}}', segment.deacon_geez || '')
        .replace('{{deacon_amharic}}', segment.deacon_amharic || '')
        .replace('{{priest_geez}}', segment.priest_geez || '')
        .replace('{{priest_amharic}}', segment.priest_amharic || '')
        .replace('{{people_geez}}', segment.people_geez || '')
        .replace('{{people_amharic}}', segment.people_amharic || '')
        .replace('{{teaching_insight}}', insight);

    const tmpHtmlPath = path.resolve('./templates/temp_render.html');
    await fs.writeFile(tmpHtmlPath, html);

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 });
        await page.goto(`file://${tmpHtmlPath}`, { waitUntil: 'networkidle0' });
        await page.evaluateHandle('document.fonts.ready');

        const outputDir = path.resolve('./output');
        await fs.mkdir(outputDir, { recursive: true });

        const outputPath = path.join(outputDir, `liturgy_${segment.id}_${Date.now()}.png`);
        await page.screenshot({ path: outputPath, type: 'png' });
        return outputPath;
    } finally {
        await browser.close();
        await fs.unlink(tmpHtmlPath).catch(() => {});
    }
}

// -----------------------------------------
// 5. Telegram Broadcasting (ENHANCED DEBUG)
// -----------------------------------------
async function broadcastToTelegram(imagePath, caption) {
    const token = process.env.TELEGRAM_TOKEN;
    const chatIdsRaw = process.env.TELEGRAM_CHAT_IDS;

    console.log('--- TELEGRAM DEBUG ---');
    console.log('Token Length:', token ? token.length : 0);
    console.log('Token Prefix:', token ? token.substring(0, 4) + '...' : 'MISSING');
    console.log('Raw Chat IDs:', chatIdsRaw ? 'PRESENT' : 'MISSING');

    if (!token || !chatIdsRaw) {
        throw new Error('TELEGRAM_TOKEN or TELEGRAM_CHAT_IDS is missing from ENV.');
    }

    const chatIds = chatIdsRaw.split(',').map(id => id.trim()).filter(Boolean);
    console.log('Target Chats:', chatIds);

    const safeCaption = caption.length > 1000 ? caption.substring(0, 997) + '...' : caption;
    const fileBuffer = await fs.readFile(imagePath);
    
    // In Node 20+, Blob + fetch + FormData is natively supported.
    // However, we verify the headers.
    for (const chatId of chatIds) {
        try {
            console.log(`📡 Sending to ${chatId}...`);
            const formData = new FormData();
            formData.append('chat_id', chatId);
            formData.append('caption', safeCaption);
            formData.append('parse_mode', 'HTML');
            
            // Native Node 20 fetch prefers Blob or File
            const blob = new Blob([fileBuffer], { type: 'image/png' });
            formData.append('photo', blob, 'liturgy.png');

            const url = `https://api.telegram.org/bot${token}/sendPhoto`;
            const res = await fetch(url, { 
                method: 'POST', 
                body: formData 
            });
            
            const result = await res.json();
            if (!res.ok) {
                console.error(`❌ TG ERROR [${chatId}]: ${res.status}`, JSON.stringify(result, null, 2));
            } else {
                console.log(`✅ TG SUCCESS [${chatId}]: Message ID ${result.result.message_id}`);
            }
        } catch (e) {
            console.error(`❌ TG REQUEST FAILED [${chatId}]:`, e.message);
        }
    }
}

// -----------------------------------------
// Main Execution
// -----------------------------------------
async function main() {
    const args = process.argv.slice(2);
    const contentType = args.find(a => a.startsWith('--type='))?.split('=')[1] || 'default';
    const anaphoraType = args.find(a => a.startsWith('--anaphora='))?.split('=')[1] || 'hawaryat';

    if (contentType === 'liturgy_teaching') {
        process.stdout.write(`\n✝ KIDASE LITURGY — DEBUG MODE\n`);
        
        let { segment, stepCurrent, stepTotal } = await loadSequentialSegment(anaphoraType);
        segment = await refineSegmentWithAI(segment);
        const insight = await generateInsight(segment);
        const outputPath = await renderHtmlToImage(segment, insight, stepCurrent, stepTotal);

        let rolesText = "";
        if (segment.deacon_geez) rolesText += `✦ <b>ዲያቆን:</b> ${segment.deacon_geez}\n<i>${segment.deacon_amharic}</i>\n\n`;
        if (segment.priest_geez) rolesText += `✦ <b>ካህን:</b> ${segment.priest_geez}\n<i>${segment.priest_amharic}</i>\n\n`;
        if (segment.people_geez) rolesText += `✦ <b>ሕዝብ:</b> ${segment.people_geez}\n<i>${segment.people_amharic}</i>\n\n`;

        const caption = `<b>❖ ቅዳሴ ሐዋርያት — ክፍል ${stepCurrent}/${stepTotal} ❖</b>\n\n📖 <b>${segment.liturgy_part}</b>\n\n${rolesText}✨ <i>${insight}</i>\n\nለመንፈሳዊ ቤተሰብዎ ያካፍሉ 🕊️`;

        await broadcastToTelegram(outputPath, caption);
        console.log(`\n✅ ALL TASKS COMPLETE`);
    }
}

main().catch(console.error);
