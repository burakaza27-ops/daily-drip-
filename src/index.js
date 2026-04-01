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

    let state = {};
    try {
        const stateRaw = await fs.readFile(statePath, 'utf-8');
        state = JSON.parse(stateRaw);
    } catch { state = {}; }

    const currentIndex = state[anaphoraType] || 0;
    const segment = segments[currentIndex];

    // Read to next
    const nextIndex = (currentIndex + 1) % total;
    state[anaphoraType] = nextIndex;
    await fs.writeFile(statePath, JSON.stringify(state, null, 2));

    console.log(`📖 Teaching Part ${currentIndex + 1} of ${total}`);
    return { segment, stepCurrent: currentIndex + 1, stepTotal: total };
}

// -----------------------------------------
// 2. Scholar AI Refinement (Liturgical Scholar)
// -----------------------------------------
async function refineSegmentWithAI(segment) {
    const prompt = `CRITICAL SYSTEM INSTRUCTION: Output MUST BE valid JSON only. NO Markdown tags (like \`\`\`json).

You are a Supreme Liturgical Scholar of the Ethiopian Orthodox Tewahedo Church (EOTC), specialized in the Anaphora of the Apostles (Qidase Hawaryat).

Your task is to refine this segment's dialogue attribution to ensure perfect "back-and-forth" teaching rhythm.

Raw Segment:
- Section: ${segment.liturgy_part}
- Deacon Geez: ${segment.deacon_geez || ''}
- Deacon Amharic: ${segment.deacon_amharic || ''}
- Priest Geez: ${segment.priest_geez || ''}
- Priest Amharic: ${segment.priest_amharic || ''}
- People Geez: ${segment.people_geez || ''}
- People Amharic: ${segment.people_amharic || ''}

RULES:
1. Ensure the text is correctly attributed to the Deacon, Priest, or People.
2. If text is merged incorrectly, split it so it makes sense for a single teaching slide.
3. Keep the liturgical language (Ge'ez and Amharic) elegant and canonical.
4. Output a JSON object with keys: deacon_geez, deacon_amharic, priest_geez, priest_amharic, people_geez, people_amharic.

ONLY RETURN THE JSON OBJECT.`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return segment;

    try {
        console.log('📖 Scholarly Review: Analyzing liturgical rhythm...');
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

        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        const refined = JSON.parse(data.choices[0].message.content);
        return { ...segment, ...refined };
    } catch (e) {
        console.error('Scholar Refinement Failed:', e);
        return segment; 
    }
}

// -----------------------------------------
// 3. AI Insight Generation (Theological Amharic)
// -----------------------------------------
async function generateInsight(segment) {
    const prompt = `CRITICAL SYSTEM INSTRUCTION: Output MUST BE in Perfect, Elegant, Theological AMHARIC only. NO English, HTML, or Markdown.

You are a Liturgical Scholar of the EOTC. This is a teaching of the Anaphora of the Apostles.

Section: ${segment.liturgy_part}
Deacon says: ${segment.deacon_geez || '(none)'}
Priest says: ${segment.priest_geez || '(none)'}
People say: ${segment.people_geez || '(none)'}

Write 1-2 profound sentences in AMHARIC explaining the spiritual mystery (ምስጢር) of this exchange. Why is this dialogue essential? Use canonical EOTC terminology.`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return "ይህ ቅዱስ ውይይት በክህነቱና በምእመናን መካከል ያለውን ሰማያዊ አንድነት የሚገልጽ ሲሆን፥ ልባችንን ወደ እግዚአብሔር መንግሥት ከፍ እንድናደርግ ያሳስበናል።";

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
        return data.choices[0].message.content.trim().replace(/^["'`]+|["'`]+$/g, '').replace(/\*+/g, '');
    } catch (e) {
        console.error('AI Generation Failed:', e);
        return "ይህ ሚስጥራዊ ንግግር የሰውን ልጅ ከፈጣሪው ጋር የሚያገናኝ የጸሎት መሰላል ነው፤ ይህም በቤተክርስቲያን አንድነት ውስጥ የሚገኝ የጸጋ ምንጭ ነው።";
    }
}

// -----------------------------------------
// 4. Template Rendering
// -----------------------------------------
async function renderHtmlToImage(segment, insight, stepCurrent, stepTotal) {
    console.log('🎨 Injecting data into template...');
    const tplPath = path.resolve('./templates/liturgy_teaching.html');
    let html = await fs.readFile(tplPath, 'utf-8');

    html = html
        .replace('{{step_current}}', stepCurrent)
        .replace('{{step_total}}', stepTotal)
        .replace('{{liturgy_part}}', segment.liturgy_part)
        .replace('{{deacon_geez}}', (segment.deacon_geez || '').trim())
        .replace('{{deacon_amharic}}', (segment.deacon_amharic || '').trim())
        .replace('{{priest_geez}}', (segment.priest_geez || '').trim())
        .replace('{{priest_amharic}}', (segment.priest_amharic || '').trim())
        .replace('{{people_geez}}', (segment.people_geez || '').trim())
        .replace('{{people_amharic}}', (segment.people_amharic || '').trim())
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
// 5. Telegram Broadcasting
// -----------------------------------------
async function broadcastToTelegram(imagePath, caption) {
    const token = process.env.TELEGRAM_TOKEN;
    const chatIdsRaw = process.env.TELEGRAM_CHAT_IDS;

    if (!token || !chatIdsRaw) {
        console.error('❌ CRITICAL: TELEGRAM_TOKEN or TELEGRAM_CHAT_IDS missing from environment!');
        return;
    }

    const chatIds = chatIdsRaw.split(',').map(id => id.trim()).filter(Boolean);
    console.log(`📡 Attempting broadcast to ${chatIds.length} chat(s)...`);

    // Safety: Telegram captions have a 1024 char limit. 
    let safeCaption = caption;
    if (caption.length > 1000) {
        console.warn('⚠ Caption too long. Truncating for Telegram safety.');
        safeCaption = caption.substring(0, 997) + '...';
    }

    const fileBuffer = await fs.readFile(imagePath);
    const fileBlob = new Blob([fileBuffer], { type: 'image/png' });

    for (const chatId of chatIds) {
        try {
            const formData = new FormData();
            formData.append('chat_id', chatId);
            formData.append('caption', safeCaption);
            formData.append('parse_mode', 'HTML');
            formData.append('photo', fileBlob, path.basename(imagePath));

            const url = `https://api.telegram.org/bot${token}/sendPhoto`;
            const res = await fetch(url, { method: 'POST', body: formData });
            
            const result = await res.json();
            if (!res.ok) {
                console.error(`❌ Telegram API Error (${chatId}):`, JSON.stringify(result, null, 2));
            } else {
                console.log(`✅ Successfully sent to chat: ${chatId}`);
            }
        } catch (e) {
            console.error(`❌ Network/Request Failed for chat ${chatId}:`, e.message);
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
        process.stdout.write(`\n✝ KIDASE LITURGY TEACHING — SCHOLAR MODE\n`);
        
        let { segment, stepCurrent, stepTotal } = await loadSequentialSegment(anaphoraType);
        
        // --- LITURGICAL SCHOLAR REFINEMENT ---
        segment = await refineSegmentWithAI(segment);
        
        const insight = await generateInsight(segment);
        const outputPath = await renderHtmlToImage(segment, insight, stepCurrent, stepTotal);

        let rolesText = "";
        if (segment.deacon_geez) rolesText += `✦ <b>ዲያቆን:</b> ${segment.deacon_geez}\n<i>${segment.deacon_amharic}</i>\n\n`;
        if (segment.priest_geez) rolesText += `✦ <b>ካህን:</b> ${segment.priest_geez}\n<i>${segment.priest_amharic}</i>\n\n`;
        if (segment.people_geez) rolesText += `✦ <b>ሕዝብ:</b> ${segment.people_geez}\n<i>${segment.people_amharic}</i>\n\n`;

        const caption = `<b>❖ ቅዳሴ ሐዋርያት — ክፍል ${stepCurrent}/${stepTotal} ❖</b>\n\n📖 <b>${segment.liturgy_part}</b>\n\n${rolesText}✨ <i>${insight}</i>\n\nለመንፈሳዊ ቤተሰብዎ ያካፍሉ 🕊️`;

        await broadcastToTelegram(outputPath, caption);
        console.log(`\n✅ Teaching process finished: Part ${stepCurrent}`);
    }
}

main().catch(console.error);
