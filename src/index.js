import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import 'dotenv/config';

// --- Liturgical Segment Loader ---
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

    // Increment state for next time
    const nextIndex = (currentIndex + 1) % total;
    state[anaphoraType] = nextIndex;
    await fs.writeFile(statePath, JSON.stringify(state, null, 2));

    console.log(`📖 Teaching Part ${currentIndex + 1} of ${total}`);
    return { segment, stepCurrent: currentIndex + 1, stepTotal: total };
}

// --- EOTC Scholar Refinement (AI) ---
async function refineSegmentWithAI(segment) {
    const prompt = `CRITICAL: Output valid JSON only. You are a Supreme EOTC Liturgical Scholar. Refine dialogue attribution for teaching Part: ${segment.liturgy_part}`;
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
        console.error('Scholar Refinement Failed:', e.message);
        return segment;
    }
}

// --- Spiritual Insight Generation (AI) ---
async function generateInsight(segment) {
    const prompt = `Output AMHARIC ONLY. Explaining spiritual mystery of this exchange: ${segment.liturgy_part}`;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return "ይህ ቅዱስ ውይይት የሰማያዊ አንድነት መገለጫ ነው።";

    try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'google/gemini-2.0-flash-001',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7
            })
        });

        const data = await res.json();
        return data.choices[0].message.content.trim().replace(/^["'`]+|["'`]+$/g, '');
    } catch { return "ይህ ሚስጥራዊ ንግግር የጸጋ ምንጭ ነው።"; }
}

// --- Image Generation (Robust Puppeteer) ---
async function renderHtmlToImage(segment, insight, stepCurrent, stepTotal) {
    console.log('🎨 Rendering Card...');
    const tplPath = path.resolve('./templates/liturgy_teaching.html');
    let html = await fs.readFile(tplPath, 'utf-8');

    html = html
        .replace('{{step_current}}', stepCurrent).replace('{{step_total}}', stepTotal)
        .replace('{{liturgy_part}}', segment.liturgy_part)
        .replace('{{deacon_geez}}', segment.deacon_geez || '').replace('{{deacon_amharic}}', segment.deacon_amharic || '')
        .replace('{{priest_geez}}', segment.priest_geez || '').replace('{{priest_amharic}}', segment.priest_amharic || '')
        .replace('{{people_geez}}', segment.people_geez || '').replace('{{people_amharic}}', segment.people_amharic || '')
        .replace('{{teaching_insight}}', insight);

    const tmpHtmlPath = path.resolve('./templates/temp_render.html');
    await fs.writeFile(tmpHtmlPath, html);

    // CRITICAL: Robust Launch for CI (Linux)
    const browser = await puppeteer.launch({
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
        ]
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

// --- Telegram Broadcasting (Broadcast Engine) ---
async function broadcastToTelegram(imagePath, caption) {
    const token = process.env.TELEGRAM_TOKEN;
    const chatIdsRaw = process.env.TELEGRAM_CHAT_IDS;

    if (!token || !chatIdsRaw) return;

    const chatIds = chatIdsRaw.split(',').map(id => id.trim()).filter(Boolean);
    const safeCaption = caption.length > 1000 ? caption.substring(0, 997) + '...' : caption;
    const fileBuffer = await fs.readFile(imagePath);
    const blob = new Blob([fileBuffer], { type: 'image/png' });

    for (const chatId of chatIds) {
        try {
            console.log(`📡 Sending to ${chatId}...`);
            const formData = new FormData();
            formData.append('chat_id', chatId);
            formData.append('caption', safeCaption);
            formData.append('parse_mode', 'HTML');
            formData.append('photo', blob, 'liturgy.png');

            const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: formData });
            const result = await res.json();
            if (!res.ok) console.error(`❌ TG ERROR:`, JSON.stringify(result));
            else console.log(`✅ TG SUCCESS [${chatId}]`);
        } catch (e) { console.error(`❌ TG FAILED:`, e.message); }
    }
}

// --- Main Process ---
async function main() {
    const args = process.argv.slice(2);
    const contentType = args.find(a => a.startsWith('--type='))?.split('=')[1] || 'default';
    const anaphoraType = args.find(a => a.startsWith('--anaphora='))?.split('=')[1] || 'hawaryat';

    if (contentType === 'liturgy_teaching') {
        console.log(`✝ KIDASE LITURGY — SCHOLAR MODE ENGINE`);
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
        console.log(`✅ ALL TASKS COMPLETE`);
    }
}

main().catch(console.error);
