import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import 'dotenv/config';

// --- Utility: Escape HTML ---
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

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

    const nextIndex = (currentIndex + 1) % total;
    state[anaphoraType] = nextIndex;
    await fs.writeFile(statePath, JSON.stringify(state, null, 2));

    console.log(`📖 Teaching Part ${currentIndex + 1} of ${total}`);
    return { segment, stepCurrent: currentIndex + 1, stepTotal: total };
}

// --- EOTC Scholar Refinement (AI) ---
async function refineSegmentWithAI(segment) {
    const prompt = `CRITICAL: Output valid JSON only. Refine dialogue attribution for teaching Part: ${segment.liturgy_part}`;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return segment;

    try {
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
        const data = await res.json();
        return { ...segment, ...JSON.parse(data.choices[0].message.content) };
    } catch { return segment; }
}

// --- Spiritual Insight Generation (AI) ---
async function generateInsight(segment) {
    let rolesContent = '';
    if (segment.dialogue && Array.isArray(segment.dialogue)) {
        rolesContent = segment.dialogue.map(turn => `${turn.speaker}: ${turn.geez}`).join('\n');
    } else {
        rolesContent = `Deacon: ${segment.deacon_geez}\nPriest: ${segment.priest_geez}\nPeople: ${segment.people_geez}`;
    }

    const prompt = `Output AMHARIC ONLY. Explaining spiritual mystery of this exchange: ${segment.liturgy_part}\n${rolesContent}`;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return "ይህ ቅዱስ ውይይት የሰማያዊ አንድነት መገለጫ ነው።";

    try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
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

// --- Image Generation ---
async function renderHtmlToImage(segment, insight, stepCurrent, stepTotal) {
    console.log('🎨 Rendering Card...');
    const tplPath = path.resolve('./templates/liturgy_teaching.html');
    let html = await fs.readFile(tplPath, 'utf-8');

    // Handle string injection safe for application/json block
    const dialogueJsonStr = segment.dialogue ? JSON.stringify(segment.dialogue).replace(/</g, '\\u003c') : '';

    html = html
        .replace('{{step_current}}', stepCurrent).replace('{{step_total}}', stepTotal)
        .replace('{{liturgy_part}}', escapeHtml(segment.liturgy_part))
        .replace('{{dialogue_json}}', dialogueJsonStr || '{{dialogue_json}}') // Keep placeholder if no dialogue
        .replace('{{deacon_geez}}', (segment.deacon_geez || '').trim())
        .replace('{{deacon_amharic}}', (segment.deacon_amharic || '').trim())
        .replace('{{priest_geez}}', (segment.priest_geez || '').trim())
        .replace('{{priest_amharic}}', (segment.priest_amharic || '').trim())
        .replace('{{people_geez}}', (segment.people_geez || '').trim())
        .replace('{{people_amharic}}', (segment.people_amharic || '').trim())
        .replace('{{teaching_insight}}', escapeHtml(insight));

    const tmpHtmlPath = path.resolve('./templates/temp_render.html');
    await fs.writeFile(tmpHtmlPath, html);

    const browser = await puppeteer.launch({
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 });
        await page.goto(`file://${tmpHtmlPath}`, { waitUntil: 'networkidle0' });
        await page.evaluateHandle('document.fonts.ready');

        const outputDir = path.resolve('./output');
        await fs.mkdir(outputDir, { recursive: true });

        const outputPath = path.join(outputDir, `liturgy_${segment.id || Date.now()}_${Date.now()}.png`);
        await page.screenshot({ path: outputPath, type: 'png' });
        return outputPath;
    } finally {
        await browser.close();
        await fs.unlink(tmpHtmlPath).catch(() => {});
    }
}

// --- Telegram Broadcasting (HTML-Safe) ---
async function broadcastToTelegram(imagePath, caption) {
    const token = process.env.TELEGRAM_TOKEN;
    const chatIdsRaw = process.env.TELEGRAM_CHAT_IDS;
    if (!token || !chatIdsRaw) return;

    const chatIds = chatIdsRaw.split(',').map(id => id.trim()).filter(Boolean);
    
    // Safety: Telegram captions have a 1024 char limit.
    // If the HTML version is too long, we'll lose the closing tags.
    // We truncate early and don't wrap dynamic content in tags that can break.
    let safeCaption = caption;
    if (caption.length > 1020) {
        safeCaption = caption.substring(0, 1017) + '...';
    }

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
            if (!res.ok) {
                console.error(`❌ TG ERROR:`, JSON.stringify(result));
                // Fallback: Try without HTML if it failed due to entities
                if (result.description?.includes('entities')) {
                    console.log('🔄 Attempting fallback (No HTML)...');
                    const fbData = new FormData();
                    fbData.append('chat_id', chatId);
                    fbData.append('caption', safeCaption.replace(/<[^>]*>/g, ''));
                    fbData.append('photo', blob, 'liturgy.png');
                    await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: fbData });
                }
            } else {
                console.log(`✅ TG SUCCESS [${chatId}]`);
            }
        } catch (e) { console.error(`❌ TG FAILED:`, e.message); }
    }
}

// --- Main ---
async function main() {
    const args = process.argv.slice(2);
    const contentType = args.find(a => a.startsWith('--type='))?.split('=')[1] || 'default';
    const anaphoraType = args.find(a => a.startsWith('--anaphora='))?.split('=')[1] || 'hawaryats';

    if (contentType === 'liturgy_teaching') {
        let { segment, stepCurrent, stepTotal } = await loadSequentialSegment(anaphoraType);
        segment = await refineSegmentWithAI(segment);
        const insight = await generateInsight(segment);
        const outputPath = await renderHtmlToImage(segment, insight, stepCurrent, stepTotal);

        // Build HTML-Safe Caption
        const labels = {
            'priest': 'ካህን',
            'deacon': 'ዲያቆን',
            'people': 'ሕዝብ',
            'asst_priest': 'ንፍቅ ካህን'
        };

        let rolesText = "";
        
        if (segment.dialogue && Array.isArray(segment.dialogue)) {
            for (const turn of segment.dialogue) {
                const label = labels[turn.speaker] || labels['priest'];
                rolesText += `✦ <b>${label}:</b> ${escapeHtml(turn.geez)}\n`;
                if (turn.amharic) rolesText += `${escapeHtml(turn.amharic)}\n`;
                rolesText += `\n`;
            }
        } else {
            // Legacy flat extraction
            if (segment.deacon_geez) {
                rolesText += `✦ <b>ዲያቆን:</b> ${escapeHtml(segment.deacon_geez)}\n${escapeHtml(segment.deacon_amharic)}\n\n`;
            }
            if (segment.priest_geez) {
                rolesText += `✦ <b>ካህን:</b> ${escapeHtml(segment.priest_geez)}\n${escapeHtml(segment.priest_amharic)}\n\n`;
            }
            if (segment.people_geez) {
                rolesText += `✦ <b>ሕዝብ:</b> ${escapeHtml(segment.people_geez)}\n${escapeHtml(segment.people_amharic)}\n\n`;
            }
        }

        const anaphoraName = segment.liturgy_part.split('|')[0] || "ቅዳሴ ሐዋርያ";
        const caption = `<b>❖ ${anaphoraName.trim()} — ክፍል ${stepCurrent}/${stepTotal} ❖</b>\n\n📖 <b>${escapeHtml(segment.liturgy_part)}</b>\n\n${rolesText}✨ ${escapeHtml(insight)}\n\nለመንፈሳዊ ቤተሰብዎ ያካፍሉ 🕊️`;

        await broadcastToTelegram(outputPath, caption);
        console.log(`✅ ALL TASKS COMPLETE`);
    }
}

main().catch(console.error);
