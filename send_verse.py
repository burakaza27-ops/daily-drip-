import os
import time
import requests
from google import genai # አዲሱ የ 2026 አሰራር

# Setup Gemini Client
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def get_spiritual_drip():
    prompt = (
        "You are a wise, strictly orthodox spiritual mentor. "
        "Generate a daily 'Spiritual Drip' message ENTIRELY IN AMHARIC. "
        "1. 📖 የዕለቱ የቅዱስ ቃል (Bible Verse) "
        "2. 💡 የአባቶች ምክር (Church Fathers Wisdom) "
        "3. ✨ ለአንተ/ለአንቺ ዛሬ (Encouragement for a student) "
        "Strictly Ethiopian Orthodox Tewahedo Church (EOTC) theology. No English."
    )
    
    for attempt in range(3):
        try:
            # Using the most stable 1.5 Flash model
            response = client.models.generate_content(
                model="gemini-1.5-flash", 
                contents=prompt
            )
            if response and response.text:
                return response.text
        except Exception as e:
            print(f"Attempt {attempt + 1} failed: {e}")
            time.sleep(10)
            
    return None

def broadcast_to_groups():
    message = get_spiritual_drip()
    if not message:
        print("Failed to generate content.")
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
                print(f"Sent to {chat_id}")
            else:
                print(f"Telegram Error: {res.text}")
        except Exception as e:
            print(f"Network Error: {e}")

if __name__ == "__main__":
    broadcast_to_groups()
