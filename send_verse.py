import os
import time
import requests
import google.generativeai as genai

# Setup Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-2.0-flash')

def get_spiritual_drip():
    # THE RISK-FREE PROMPT: Strict guardrails added for theological accuracy and safety
    prompt = (
        "You are a wise, strictly orthodox, and compassionate spiritual mentor for Ethiopian university students. "
        "Your task is to generate a daily 'Spiritual Drip' message ENTIRELY IN AMHARIC. "
        "STRICT GUIDELINES: "
        "- Theology: Must strictly align with Ethiopian Orthodox Tewahedo Church (EOTC) teachings. "
        "- Content Safety: NEVER include political, controversial, or divisive topics. "
        "- Accuracy: Do not hallucinate Bible verses. Use exact and well-known Amharic scripture translations. "
        "STRUCTURE: "
        "1. 📖 የዕለቱ የቅዱስ ቃል (Bible Verse): A verse relevant to student life (stress, focus, hope). "
        "2. 💡 የአባቶች ምክር (Fathers' Wisdom): A genuine, historically accurate teaching from an Orthodox Church Father (e.g., St. Yared, St. John Chrysostom, or St. Cyril) in Amharic. "
        "3. ✨ ለአንተ/ለአንቺ ዛሬ (For You Today): A 3-sentence personalized encouragement addressing the reader directly as a student. "
        "Use flawless Amharic grammar, bold headers, and appropriate emojis."
    )
    
    # Retry mechanism for AI Generation
    for attempt in range(3):
        try:
            response = model.generate_content(prompt)
            return response.text
        except Exception as e:
            print(f"AI Generation Error on attempt {attempt + 1}: {e}")
            time.sleep(5) # Wait 5 seconds before trying again
            
    return None

def broadcast_to_groups():
    message = get_spiritual_drip()
    if not message:
        print("CRITICAL: Failed to generate message after 3 attempts.")
        return

    token = os.getenv('TELEGRAM_TOKEN')
    chat_ids = os.getenv('TELEGRAM_CHAT_IDS', '').split(',')

    for chat_id in chat_ids:
        chat_id = chat_id.strip()
        if not chat_id:
            continue
            
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": message,
            "parse_mode": "Markdown"
        }
        
        # Retry mechanism for Telegram API
        for attempt in range(3):
            try:
                response = requests.post(url, json=payload, timeout=10)
                if response.status_code == 200:
                    print(f"Successfully sent to {chat_id}")
                    break # Success, move to the next chat_id
                else:
                    print(f"Telegram Error on attempt {attempt + 1} for {chat_id}: {response.text}")
                    time.sleep(3)
            except requests.exceptions.RequestException as e:
                print(f"Network Error on attempt {attempt + 1} for {chat_id}: {e}")
                time.sleep(3)

if __name__ == "__main__":
    broadcast_to_groups()
