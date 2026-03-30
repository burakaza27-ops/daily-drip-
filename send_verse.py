import os
import time
import requests
from google import genai

# Setup Gemini Client
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def get_spiritual_drip():
    prompt = (
        "You are a wise spiritual mentor. Generate a daily 'Spiritual Drip' message ENTIRELY IN AMHARIC. "
        "Include: 1. Bible Verse, 2. Church Father Wisdom, 3. Student Encouragement. "
        "Strictly Ethiopian Orthodox Tewahedo Church (EOTC) theology. No English."
    )
    
    # የምንሞክራቸው ሞዴሎች ዝርዝር (አንዱ ኮታ ቢጨርስ በሌላው እንዲሞክር)
    models_to_try = ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"]
    
    for model_name in models_to_try:
        try:
            print(f"Trying with model: {model_name}...")
            response = client.models.generate_content(
                model=model_name, 
                contents=prompt
            )
            if response and response.text:
                return response.text
        except Exception as e:
            print(f"Model {model_name} failed or quota reached: {e}")
            time.sleep(2) # ለአፍታ ቆይቶ ቀጣዩን ሞዴል ይሞክራል
            
    return None

def broadcast_to_groups():
    message = get_spiritual_drip()
    if not message:
        print("CRITICAL: All models failed. Check your API Key or Quota at https://aistudio.google.com/")
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
                print(f"Message delivered to {chat_id}!")
            else:
                print(f"Telegram Error for {chat_id}: {res.text}")
        except Exception as e:
            print(f"Network Error: {e}")

if __name__ == "__main__":
    broadcast_to_groups()
