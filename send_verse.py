import os
import time
import requests

def get_spiritual_drip():
    openrouter_key = os.getenv("GEMINI_API_KEY") 
    
    # PERFECT & DETAILED PROMPT
    prompt = (
        "Role: You are a highly esteemed, wise, and scholarly spiritual mentor from the Ethiopian Orthodox Tewahedo Church (EOTC), "
        "dedicated to guiding university students through their academic and spiritual journey. "
        
        "Tone: Majestic, poetic, compassionate, and deeply encouraging. Use high-level, formal, and beautiful Amharic (Geez-influenced vocabulary where appropriate). "
        
        "Task: Create a daily 'Spiritual Drip' (መንፈሳዊ ጠብታ) that feels like a premium, curated spiritual experience. "
        
        "Content Structure (Strictly in Amharic): "
        
        "1. 🏛️ የዕለቱ የቅዱስ ቃል (The Divine Word): "
        "Select a powerful Bible verse that resonates with perseverance, wisdom, or divine strength. "
        "Format: **[Verse Text]** followed by the citation (e.g., — የዮሐንስ ወንጌል 14:27). "
        
        "2. ☦️ የአባቶች የጥበብ መዝገብ (The Golden Wisdom of Fathers): "
        "Provide a profound, historically accurate, and soul-stirring teaching from an EOTC Church Father. "
        "Focus on themes like inner peace, the value of time, and conquering fear. "
        "Mention the Father's name with honor (e.g., ቅዱስ ዮሐንስ አፈወርቅ፣ ማር ይስሐቅ...). "
        
        "3. 🕊️ ለዛሬው ጉዞህ/ሽ (Your Journey Today): "
        "Write 3-4 highly inspiring, personalized sentences. Address the student as a 'visionary of tomorrow.' "
        "Connect the academic struggle with spiritual growth. Use words that ignite hope and discipline. "
        
        "Formatting Rules: "
        "- Use clean separators like '---' or '✧' between sections. "
        "- Use bold headers and professional emojis. "
        "- ABSOLUTELY NO ENGLISH. The entire response must be in beautiful Ethiopic script. "
        "- Ensure the text is perfectly formatted for Telegram Markdown."
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
