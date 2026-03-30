import os
import time
import requests

def get_spiritual_drip():
    openrouter_key = os.getenv("GEMINI_API_KEY") 
    
    # PERFECT & DETAILED PROMPT
    prompt = (
        "STRICT INSTRUCTION: Your response must be 100% in AMHARIC (Ethiopic Script). "
        "DO NOT include any English words, introductions, or conclusions. "
        "Start immediately with the first emoji. Use a professional, majestic, and soul-stirring tone.\n\n"
        
        "CONTEXT: You are a highly esteemed Spiritual Father and Mentor of the Ethiopian Orthodox Tewahedo Church (EOTC), "
        "specifically guiding the youth in the Sunday School (Senbet Timhirt Bet). "
        "Target Audience: Dedicated, spiritually hungry Sunday School students (ወጣቶች) who are balancing their secular life with their sacred service (አገልግሎት).\n\n"
        
        "STRUCTURE (Follow this exactly):\n\n"
        
        "1. 🏛️ የሰማያዊ ጥበብ መክፈቻ (Divine Wisdom Opening):\n"
        "Select a powerful Bible verse from the EOTC canon that speaks to 'Service' (አገልግሎት), 'Youthful Purity' (የወጣትነት ንጽሕና), or 'Spiritual Strength'. "
        "Format: **[Verse Text in Bold]** followed by the citation: — [Book Name] [Chapter:Verse].\n\n"
        
        "2. ☦️ የቅዱሳን አባቶች የብርሃን ማዕድ (The Table of Saints' Enlightenment):\n"
        "Provide a profound teaching from an EOTC Church Father about the beauty of serving God in youth. "
        "Focus on how spiritual education (ሰንበት ትምህርት) transforms the soul. "
        "Mention the Father's name with high honor (e.g., ቅዱስ ያሬድ፣ ቅዱስ ቄርሎስ...).\n\n"
        
        "3. 🕊️ ለነገው የአጥቢያ ብርሃን (For Tomorrow's Parish Light):\n"
        "Write 3-4 inspiring, high-end sentences addressing the Sunday School student directly. "
        "Acknowledge their commitment to the Church as a 'Sacred Responsibility' (ቅዱስ ኃላፊነት). "
        "Use words like 'አገልጋይ' (Servant), 'ትውልድ' (Generation), 'ጽኑዕ' (Resilient), and 'የቤተክርስቲያን ተስፋ' (Hope of the Church). "
        "Encourage them to shine in their community through their conduct and faith.\n\n"
        
        "4. ✨ የዕለቱ ሐዋርያዊ ቡራኬ (Daily Apostolic Benediction):\n"
        "A one-line powerful blessing specifically for their service, family, and spiritual journey.\n\n"
        
        "FORMATTING RULES:\n"
        "- Use elegant visual separators like '✧—————✧' between sections.\n"
        "- Use bolding for emphasis on key spiritual concepts.\n"
        "- Use high-level, poetic Amharic with deep EOTC terminology (e.g., ቃለ እግዚአብሔር፣ ምግባር፣ ሃይማኖት)."
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
