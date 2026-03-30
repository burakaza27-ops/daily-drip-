import os
import time
import requests

def get_spiritual_drip():
    openrouter_key = os.getenv("GEMINI_API_KEY") 
    
    # PERFECT & DETAILED PROMPT
   prompt = (

        "STRICT INSTRUCTION: Your response must be 100% in AMHARIC (Ethiopic Script). "
        "DO NOT include ANY foreign words, explanations, introductions, or conclusions. "
        "Begin immediately with the first emoji. Maintain a majestic, liturgical, and soul-awakening tone rooted in the Ethiopian Orthodox Tewahedo tradition.\n\n"

        "CONTEXT: You are a venerable Spiritual Father, Theologian, and Scholar of the Ethiopian Orthodox Tewahedo Church (EOTC), "
        "deeply grounded in Holy Scripture, the writings of the Saints, and the sacred tradition (ትውፊት). "
        "Your voice carries authority, serenity, and divine illumination.\n\n"

        "TARGET: Address disciplined, striving individuals who seek መንፈሳዊ ጽናት, ልቦናዊ ጥራት, እና ትኩረት. "
        "Speak as one who forms souls toward greatness through faith, patience, and inner vigilance.\n\n"

        "STRUCTURE (Follow exactly and do not skip):\n\n"

        "1. 🏛️ የሰማያዊ ጥበብ መክፈቻ:\n"
        "Select a profound and authoritative verse from the canonical Scriptures (መዝሙረ ዳዊት, ወንጌል, ነቢያት). "
        "Theme must reflect ትዕግስት (holy endurance), ተስፋ (hope), or መለኮታዊ ረዳትነት (divine assistance). "
        "Format strictly as: **[Verse Text in Bold]** — [መጽሐፍ ስም] [ምዕራፍ:ቁጥር].\n\n"

        "✧—————✧\n\n"

        "2. ☦️ የቅዱሳን አባቶች የብርሃን ማዕድ:\n"
        "Present a rare, poetic, and deeply contemplative teaching drawn from one of the great Fathers of the Church. "
        "You may draw from: ቅዱስ ያሬድ, ቅዱስ ይስሐቅ ሶርያዊ, ቅዱስ ዮሐንስ አፈወርቅ, ቅዱስ አትናቴዎስ, "
        "ቅዱስ ቂርሎስ, ቅዱስ ግርጌርዮስ, ቅዱስ ባስልዮስ, ቅዱስ ኤፍሬም ሶርያዊ, "
        "ቅዱስ ዲዮስቆሮስ, ቅዱስ ሴቬርዮስ አንጾኪያዊ, ቅዱስ ማቃርዮስ, ቅዱስ አቡነ አረጋዊ, "
        "ቅዱስ ተክለ ሃይማኖት, ቅዱስ ገብረ መንፈስ ቅዱስ, እና ሌሎች የተቀደሱ አባቶች። "
        "The teaching must connect inner struggle, disciplined effort, and spiritual illumination. "
        "Present it as a hidden treasure (መዝገበ ብርሃን) for the soul.\n\n"

        "✧—————✧\n\n"

        "3. 🕊️ ለነገው ባለራዕይ:\n"
        "Write 3–4 elevated and powerful sentences addressing the reader directly. "
        "Interpret their present ተጋድሎ as a sacred refinement (መንፈሳዊ ማጥራት). "
        "Use exalted terms such as **ባለራዕይ**, **ጽኑዕ**, **ብርሃን**, **ጥበብ**, **ክብር**. "
        "Call them to mastery of time, purity of mind, and unwavering faith. "
        "Let the tone be both fatherly and kingly—firm yet filled with grace.\n\n"

        "✧—————✧\n\n"

        "4. ✨ የዕለቱ ቡራኬ:\n"
        "Deliver one concise yet powerful blessing invoking divine favor upon their path, mind, and works.\n\n"

        "FINAL REQUIREMENTS:\n"
        "- Use rich, Ge’ez-rooted Amharic vocabulary.\n"
        "- Apply bold emphasis only to key spiritual words.\n"
        "- Maintain rhythmic, poetic flow throughout.\n"
        "- Avoid repetition; each line must feel elevated and sacred.\n"
        "- Ensure theological and linguistic integrity in accordance with EOTC tradition."
)

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {openrouter_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/burakaza27-ops/daily-drip-",
    }
    
    # በOpenRouter ላይ በአሁኑ ሰዓት በትክክል የሚሰሩ ሞዴሎች
    models_to_try = [
        "google/gemini-2.0-flash-001",
        "google/gemini-flash-1.5",
        "anthropic/claude-3-haiku" # ጌሚናይ ባይሰራ ክላውድ እንዲሞክር
    ]

    for model_id in models_to_try:
        try:
            print(f"Trying to generate with: {model_id}...")
            data = {
                "model": model_id, 
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.7
            }
            response = requests.post(url, headers=headers, json=data, timeout=30)
            result = response.json()
            
            if "choices" in result:
                content = result["choices"][0]["message"]["content"]
                print(f"Successfully generated using {model_id}!")
                return content
            else:
                error_msg = result.get('error', {}).get('message', 'Unknown error')
                print(f"Model {model_id} failed: {error_msg}")
        except Exception as e:
            print(f"Connection error with {model_id}: {e}")
            time.sleep(2)
            
    return None

def broadcast_to_groups():
    message = get_spiritual_drip()
    if not message:
        print("CRITICAL: Failed to generate content. Please check your OpenRouter Key or balance.")
        return

    token = os.getenv('TELEGRAM_TOKEN')
    # በGitHub Secrets ውስጥ ያለው Chat ID -100 መጀመሩን አረጋግጥ
    chat_ids = os.getenv('TELEGRAM_CHAT_IDS', '').split(',')

    for chat_id in chat_ids:
        chat_id = chat_id.strip()
        if not chat_id: continue
            
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        payload = {
            "chat_id": chat_id, 
            "text": message, 
            "parse_mode": "Markdown"
        }
        
        try:
            res = requests.post(url, json=payload, timeout=15)
            if res.status_code == 200:
                print(f"Success! Delivered to {chat_id}")
            else:
                # ማሳሰቢያ፡ ማርክዳውን (Markdown) ስህተት ካመጣ ያለ እሱ ይሞክራል
                payload.pop("parse_mode")
                requests.post(url, json=payload)
                print(f"Delivered to {chat_id} (without Markdown)")
        except Exception as e:
            print(f"Network Error: {e}")

if __name__ == "__main__":
    broadcast_to_groups()
