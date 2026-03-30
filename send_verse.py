import os
import time
import requests

def get_spiritual_drip():
    # OpenRouter API settings
    openrouter_key = os.getenv("GEMINI_API_KEY") # ስሙን በ GitHub ላይ ላለመቀየር Gemini_API_KEY ውስጥ የ OpenRouter Keyህን ክተተው
    
    prompt = (
        "You are a wise spiritual mentor. Generate a daily 'Spiritual Drip' message ENTIRELY IN AMHARIC. "
        "Include: 1. Bible Verse, 2. Church Father Wisdom, 3. Student Encouragement. "
        "Strictly Ethiopian Orthodox Tewahedo Church (EOTC) theology. No English."
    )

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {openrouter_key}",
        "Content-Type": "application/json"
    }
    
    # ነፃ እና ፈጣን የሆነውን የ Gemini ሞዴል በ OpenRouter በኩል እንጠቀማለን
    data = {
        "model": "google/gemini-2.0-flash-lite:free", 
        "messages": [{"role": "user", "content": prompt}]
    }

    for attempt in range(3):
        try:
            response = requests.post(url, headers=headers, json=data, timeout=20)
            result = response.json()
            if "choices" in result:
                return result["choices"][0]["message"]["content"]
            else:
                print(f"OpenRouter Error: {result}")
        except Exception as e:
            print(f"Attempt {attempt + 1} failed: {e}")
            time.sleep(5)
            
    return None

def broadcast_to_groups():
    message = get_spiritual_drip()
    if not message:
        print("Failed to generate content via OpenRouter.")
        return

    token = os.getenv('TELEGRAM_TOKEN')
    chat_ids = os.getenv('TELEGRAM_CHAT_IDS', '').split(',')

    for chat_id in chat_ids:
        chat_id = chat_id.strip()
        if not chat_id: continue
            
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        payload = {"chat_id": chat_id, "text": message, "parse_mode": "Markdown"}
        
        try:
            res = requests.post(url, json=payload, timeout=15)
            if res.status_code == 200:
                print(f"Successfully delivered via OpenRouter to {chat_id}!")
            else:
                print(f"Telegram Error: {res.text}")
        except Exception as e:
            print(f"Network Error: {e}")

if __name__ == "__main__":
    broadcast_to_groups()
