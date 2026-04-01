import fs from 'fs/promises';
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

    // Read current state
    let state = {};
    try {
        const stateRaw = await fs.readFile(statePath, 'utf-8');
        state = JSON.parse(stateRaw);
    } catch { state = {}; }

    const currentIndex = state[anaphoraType] || 0;
    const segment = segments[currentIndex];

    // Advance to next, loop back to 0 when finished
    const nextIndex = (currentIndex + 1) % total;
    state[anaphoraType] = nextIndex;
    await fs.writeFile(statePath, JSON.stringify(state, null, 2));

    console.log(`📖 Teaching Part ${currentIndex + 1} of ${total}`);
    return { segment, stepCurrent: currentIndex + 1, stepTotal: total };
}

// -----------------------------------------
// 2. AI Insight Generation (Theological Amharic)
// -----------------------------------------
async function generateInsight(segment) {
    const prompt = `CRITICAL SYSTEM INSTRUCTION: Output MUST BE in Perfect, Elegant, Theological AMHARIC only. DO NOT output English, HTML, Markdown, or any annotations. Output raw Amharic text only.

You are a Liturgical Scholar and Spiritual Father of the Ethiopian Orthodox Tewahedo Church.
This is a sequential teaching of the Anaphora of the Apostles (Qidasie Hawaryat).

Current Liturgy Section: ${segment.liturgy_part}
The Priest (ካህን) says: ${segment.priest_geez} — ${segment.priest_amharic}
The People (ሕዝብ) respond: ${segment.people_geez} — ${segment.people_amharic}

Write 1-2 profound sentences in AMHARIC explaining the deep spiritual mystery (ምስጢር) of this specific exchange. Why does the Church mandate this dialogue? Use only canonical Ethiopian Orthodox Tewahedo teaching. Use the official Church translations of the Anaphora of the Apostles.`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn('⚠ GEMINI_API_KEY not found. Using fallback.');
        return "ይህ ቅዱስ ውይይት በክህነቱና በምእመናን መካከል ያለውን ሰማያዊ አንድነት የሚገልጽ ሲሆን፥ ልባችንን ወደ እግዚአብሔር መንግሥት ከፍ እንድናደርግ ያሳስበናል።";
    }

    try {
        console.log('🤖 Generating AI Insight (Amharic)...');
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
        // Strip any remaining markdown or quotes
        return data.choices[0].message.content
            .trim()
            .replace(/^["'`]+|["'`]+$/g, '')
            .replace(/\*+/g, '')
            .replace(/#+ /g, '');
    } catch (e) {
        console.error('AI Generation Failed:', e);
        return "ይህ ሚስጥራዊ ንግግር የሰውን ልጅ ከፈጣሪው ጋር የሚያገናኝ የጸሎት መሰላል ነው፤ ይህም በቤተክርስቲያን አንድነት ውስጥ የሚገኝ የጸጋ ምንጭ ነው።";
    }
}

// -----------------------------------------
// 3. Template Rendering (Puppeteer + Font Safety)
// -----------------------------------------
async function renderHtmlToImage(segment, insight, stepCurrent, stepTotal) {
    console.log('🎨 Injecting data into template...');
    const tplPath = path.resolve('./templates/liturgy_teaching.html');
    let html = await fs.readFile(tplPath, 'utf-8');

    html = html
        .replace('{{step_current}}', stepCurrent)
        .replace('{{step_total}}', stepTotal)
        .replace('{{liturgy_part}}', segment.liturgy_part)
        .replace('{{priest_geez}}', segment.priest_geez)
        .replace('{{priest_amharic}}', segment.priest_amharic)
        .replace('{{people_geez}}', segment.people_geez)
        .replace('{{people_amharic}}', segment.people_amharic)
        .replace('{{teaching_insight}}', insight);

    const tmpHtmlPath = path.resolve('./templates/temp_render.html');
    await fs.writeFile(tmpHtmlPath, html);

    console.log('🚀 Booting Puppeteer...');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 });
        await page.goto(`file://${tmpHtmlPath}`, { waitUntil: 'networkidle0' });

        // CRITICAL: Wait for Google Fonts to fully load
        console.log('⏳ Waiting for sacred fonts...');
        await page.evaluateHandle('document.fonts.ready');

        const outputDir = path.resolve('./output');
        await fs.mkdir(outputDir, { recursive: true });

        const outputPath = path.join(outputDir, `liturgy_${segment.id}_${Date.now()}.png`);
        await page.screenshot({ path: outputPath, type: 'png' });

        console.log(`✅ Rendered: ${outputPath}`);
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

    const chatIds = chatIdsRaw.split(',').map(id => id.trim()).filter(Boolean);
    console.log(`📡 Broadcasting to ${chatIds.length} chat(s)...`);

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
            console.error(`❌ Failed for chat ${chatId}:`, e.message || e);
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
        console.log(`\n✝ KIDASE LITURGY TEACHING SYSTEM`);
        console.log(`  Anaphora: ${anaphoraType}`);
        console.log(`${'─'.repeat(40)}\n`);

        const { segment, stepCurrent, stepTotal } = await loadSequentialSegment(anaphoraType);
        const insight = await generateInsight(segment);
        const outputPath = await renderHtmlToImage(segment, insight, stepCurrent, stepTotal);

        const caption = `<b>❖ ቅዳሴ ሐዋርያት — ክፍል ${stepCurrent}/${stepTotal} ❖</b>\n\n📖 <b>${segment.liturgy_part}</b>\n\n✦ <b>ካህን:</b> ${segment.priest_geez}\n<i>${segment.priest_amharic}</i>\n\n✦ <b>ሕዝብ:</b> ${segment.people_geez}\n<i>${segment.people_amharic}</i>\n\n✨ <i>${insight}</i>\n\nለመንፈሳዊ ቤተሰብዎ ያካፍሉ 🕊️`;

        await broadcastToTelegram(outputPath, caption);

        console.log(`\n✅ Teaching complete: Part ${stepCurrent} of ${stepTotal}`);
    } else {
        console.log('⚠ Unknown content type. Use --type=liturgy_teaching');
    }
}

main().catch(console.error);
