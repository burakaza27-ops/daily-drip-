import os
import time
import requests

def get_spiritual_drip():
    openrouter_key = os.getenv("GEMINI_API_KEY") 
    
    # UPDATED: Perfect, Detailed & Sunday School Focused Prompt
    prompt = (
        "STRICT INSTRUCTION: Your response must be 100% in AMHARIC (Ethiopic Script). "
        "DO NOT include any English words, introductions, or conclusions. "
        "Begin immediately with the first emoji. Avoid inventing words; use standard EOTC Amharic.\n\n"

        "CONTEXT: You are a venerable Spiritual Father and Scholar of the EOTC, "
        "mentoring dedicated youth in the Sunday School (ሰንበት ትምህርት ቤት). "
        "Your voice carries authority and divine illumination.\n\n"

        "TARGET: Sunday School students (ወጣቶች) balancing life with sacred service (አገልግሎት). "
        "Speak as one who forms souls through faith and inner vigilance.\n\n"

        "STRUCTURE (Follow exactly):\n\n"

        "1. 🏛️ የሰማያዊ ጥበብ መክፈቻ:\n"
        "Select a profound Bible verse (መዝሙረ ዳዊት, ወንጌል,ሃዲስ ኪዳን, ብሉይ ኪዳን or ነቢያት) regarding 'Service' (አገልግሎት), moving verses, salvation related, general verses or 'Youthful Purity'. "
        "Format: **[Verse Text in Bold]** — [መጽሐፍ ስም] [ምዕራፍ:ቁጥር].\n\n"

        "✧—————✧\n\n"

        "2. ☦️ የቅዱሳን አባቶች የብርሃን ማዕድ:\n"
        "Present a deep teaching from an EOTC Father (e.g., St. Yared, St. Isaac the Syrian, St. John Chrysostom) "
        "about the beauty of serving God in youth and spiritual education. "
        "Mention the Father's name with honor.\n\n"

        "✧—————✧\n\n"

        "3. 🕊️ ለነገው የአጥቢያ ብርሃን:\n"
        "Write 3–4 powerful sentences addressing the Sunday School student directly. "
        "Use terms like **አገልጋይ**, **የቤተክርስቲያን ተስፋ**, **ጽኑዕ**, **ብርሃን**. "
        "Encourage their commitment to the Church as a sacred path.\n\n"

        "✧—————✧\n\n"

        "4. ✨ የዕለቱ ሐዋርያዊ ቡራኬ:\n"
        "Deliver one powerful blessing for their service, family, and spiritual journey.\n\n"

        "FINAL REQUIREMENTS:\n"
        "- Use rich, Ge’ez-rooted Amharic vocabulary.\n"
        "- NO spelling errors in Ethiopic characters.\n"
        "- Maintain rhythmic, poetic flow throughout."
    )

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {openrouter_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/burakaza27-ops/daily-drip-",
    }
    
    # በOpenRouter ላይ ይበልጥ አስተማማኝ የሆኑ ሞዴሎች
    models_to_try = [
        "google/gemini-2.0-flash-001",
        "google/gemini-flash-1.5",
        "anthropic/claude-3-haiku" 
    ]

    for model_id in models_to_try:
        try:
            print(f"Trying to generate with: {model_id}...")
            data = {
                "model": model_id, 
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.4 # ዝቅተኛ ማድረጉ ስህተትን ይቀንሳል
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
        print("CRITICAL: Failed to generate content.")
        return

    # አማራጭ፡ የBrookers Automation ምልክት መጨመር ከፈለግህ ከታች ያለውን መስመር ከኮሜንት አውጣው
    # message = message + "\n\n✧—————✧\n**Brookers Automation**"

    token = os.getenv('TELEGRAM_TOKEN')
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
                payload.pop("parse_mode")
                requests.post(url, json=payload)
                print(f"Delivered to {chat_id} (without Markdown)")
        except Exception as e:
            print(f"Network Error: {e}")

if __name__ == "__main__":
    broadcast_to_groups()
