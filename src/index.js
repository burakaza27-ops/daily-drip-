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

// --- Strip speaker abbreviation prefixes (ይ.ሕ., ይ.ካ., ይ.ዲ., etc.) ---
function stripSpeakerPrefix(text) {
    if (!text) return '';
    // Matches: ይ.ሕ. / ይ. ሕ. / ይ.ካ. / ይ. ካ. / ይ.ዲ. / ይ. ዲ. and optional trailing space
    return text.replace(/^ይ\.\s*[\u1215\u12ab\u12d2]\.?\s*/u, '').trim();
}

// --- Ethiopian Calendar Date ---
function toEthiopianDate(jsDate) {
    const MONTHS = ['መስከረም','ጥቅምት','ኅዳር','ታኅሳስ','ጥር','የካቲት','መጋቢት','ሚያዝያ','ግንቦት','ሰኔ','ሐምሌ','ነሐሴ','ጳጉሜ'];
    // Reference anchor: Sep 11, 2023 (UTC) = Meskerem 1, 2016 E.C.
    const refDate = new Date(Date.UTC(2023, 8, 11));
    const msPerDay = 86400000;
    const daysDiff = Math.floor((Date.UTC(jsDate.getUTCFullYear(), jsDate.getUTCMonth(), jsDate.getUTCDate()) - refDate.getTime()) / msPerDay);

    let ethYear = 2016;
    let remaining = daysDiff;
    if (remaining >= 0) {
        while (true) {
            const yearLen = (ethYear % 4 === 3) ? 366 : 365;
            if (remaining < yearLen) break;
            remaining -= yearLen;
            ethYear++;
        }
    } else {
        while (remaining < 0) {
            ethYear--;
            remaining += (ethYear % 4 === 3) ? 366 : 365;
        }
    }
    const ethMonth = Math.floor(remaining / 30) + 1;
    const ethDay   = (remaining % 30) + 1;
    return `${ethDay} ${MONTHS[Math.min(ethMonth - 1, 12)]} ${ethYear} ዓ.ም`;
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
// Bypassed because it corrupts our perfectly ordered dialogue arrays
async function refineSegmentWithAI(segment) {
    return segment;
}

// --- Spiritual Insight Generation (AI) ---
async function generateInsight(segment) {
    let rolesContent = '';
    if (segment.dialogue && Array.isArray(segment.dialogue)) {
        rolesContent = segment.dialogue.map(turn => `${turn.speaker}: ${turn.geez}`).join('\n');
    } else {
        rolesContent = `Deacon: ${segment.deacon_geez}\nPriest: ${segment.priest_geez}\nPeople: ${segment.people_geez}`;
    }

    const prompt = `You are a strict Ethiopian Orthodox Tewahedo Church (EOTC) scholar. Provide a profoundly accurate theological explanation of the spiritual mystery of this liturgical exchange.\n\nCRITICAL CONSTRAINTS:\n1. LANGUAGE: YOUR ENTIRE RESPONSE MUST BE WRITTEN IN ETHIOPIAN AMHARIC (አማርኛ) FIDEL SCRIPT ONLY. DO NOT USE ANY ENGLISH WORDS.\n2. LENGTH: MUST BE CONCISE, strictly 1 to 2 sentences max.\n3. FOCUS: Only the deep theological mystery.\n\nText: ${segment.liturgy_part}\n${rolesContent}\n\nመንፈሳዊ ትምህርት (በአማርኛ ብቻ):`;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return "ይህ ቅዱስ ውይይት የሰማያዊ አንድነት መገለጫ ነው።";

    try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'google/gemini-2.0-flash-001',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1
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

    // Split liturgy_part on '|' → subtitle (left) + main title (right)
    const titleParts = (segment.liturgy_part || '').split('|');
    const mainTitle  = (titleParts.length > 1 ? titleParts[1] : titleParts[0]).trim();
    const subtitle   = (titleParts.length > 1 ? titleParts[0] : '').trim();

    // Strip speaker prefixes from each dialogue turn before rendering
    let cleanDialogue = null;
    if (segment.dialogue && Array.isArray(segment.dialogue)) {
        cleanDialogue = segment.dialogue.map(turn => ({
            ...turn,
            geez:    stripSpeakerPrefix(turn.geez),
            amharic: turn.amharic ? stripSpeakerPrefix(turn.amharic) : turn.amharic
        }));
    }

    // Ethiopian calendar date for footer
    const postDate = toEthiopianDate(new Date());

    // Handle string injection safe for application/json block
    const dialogueSource  = cleanDialogue || segment.dialogue;
    const dialogueJsonStr = dialogueSource ? JSON.stringify(dialogueSource).replace(/</g, '\\u003c') : '';

    html = html
        .replace('{{step_current}}',    stepCurrent)
        .replace('{{step_total}}',      stepTotal)
        .replace('{{liturgy_subtitle}}',escapeHtml(subtitle))
        .replace('{{liturgy_part}}',    escapeHtml(mainTitle))
        .replace('{{post_date}}',       postDate)
        .replace('{{dialogue_json}}',   dialogueJsonStr || '{{dialogue_json}}')
        .replace('{{deacon_geez}}',     stripSpeakerPrefix(segment.deacon_geez  || '').trim())
        .replace('{{deacon_amharic}}',  stripSpeakerPrefix(segment.deacon_amharic || '').trim())
        .replace('{{priest_geez}}',     stripSpeakerPrefix(segment.priest_geez  || '').trim())
        .replace('{{priest_amharic}}',  stripSpeakerPrefix(segment.priest_amharic || '').trim())
        .replace('{{people_geez}}',     stripSpeakerPrefix(segment.people_geez  || '').trim())
        .replace('{{people_amharic}}',  stripSpeakerPrefix(segment.people_amharic || '').trim())
        .replace('{{teaching_insight}}',escapeHtml(insight));

    const tmpHtmlPath = path.resolve('./templates/temp_render.html');
    await fs.writeFile(tmpHtmlPath, html);

    const browser = await puppeteer.launch({
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--font-render-hinting=none',           // Sharper Ethiopic glyph edges
            '--disable-font-subpixel-positioning',  // Prevents blurry subpixel shifts
        ]
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 3 });
        await page.goto(`file://${tmpHtmlPath}`, { waitUntil: 'networkidle0' });

        // Guarantee Abyssinica SIL is fully loaded before screenshot
        await page.evaluateHandle('document.fonts.ready');
        await page.evaluate(() => Promise.all([
            document.fonts.load('700 2.65rem "Abyssinica SIL"'),
            document.fonts.load('400 1.75rem "Noto Sans Ethiopic"'),
        ]));

        // Dynamic Height Calculation: Perfectly fit the rendered body
        const bodyHandle = await page.$('body');
        const { height } = await bodyHandle.boundingBox();
        await page.setViewport({ width: 1080, height: Math.max(1350, Math.ceil(height)), deviceScaleFactor: 3 });

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
    let safeCaption = caption || '';
    if (safeCaption.length > 1020) {
        safeCaption = safeCaption.substring(0, 1017) + '...';
    }

    const fileBuffer = await fs.readFile(imagePath);
    const blob = new Blob([fileBuffer], { type: 'image/png' });

    for (const chatId of chatIds) {
        try {
            console.log(`📡 Sending to ${chatId}...`);
            const formData = new FormData();
            formData.append('chat_id', chatId);
            if (safeCaption) {
                formData.append('caption', safeCaption);
                formData.append('parse_mode', 'HTML');
            }
            formData.append('photo', blob, 'liturgy.png');

            const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: formData });
            const result = await res.json();
            if (!res.ok) {
                console.error(`❌ TG ERROR:`, JSON.stringify(result));
                // Fallback: Try without HTML if it failed due to entities
                if (result.description?.includes('entities') && safeCaption) {
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
        // segment = await refineSegmentWithAI(segment); // DISABLED: It destroys dialogue structures
        const insight = await generateInsight(segment);
        const outputPath = await renderHtmlToImage(segment, insight, stepCurrent, stepTotal);

        // Broadcast the image to Telegram without any text caption
        const caption = "";

        await broadcastToTelegram(outputPath, caption);
        console.log(`✅ ALL TASKS COMPLETE`);
    }
}

main().catch(console.error);
