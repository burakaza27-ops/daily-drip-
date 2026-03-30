import os
import time
import requests
import google.generativeai as genai

# Setup Gemini - Updated to 1.5 Flash
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-1.5-flash')

def get_spiritual_drip():
    # THE RISK-FREE PROMPT: Strict guardrails for EOTC accuracy
    prompt = (
        "You are a wise, strictly orthodox, and compassionate spiritual mentor for Ethiopian university students. "
        "Your task is to generate a daily 'Spiritual Drip' message ENTIRELY IN AMHARIC. "
        "STRICT GUIDELINES: "
        "- Language: Use ONLY Amharic. No English words. "
        "- Theology: Must strictly align with Ethiopian Orthodox Tewahedo Church (EOTC) teachings. "
        "- Content Safety: NEVER include political, controversial, or divisive topics. "
        "- Accuracy: Use exact and well-known Amharic scripture translations. Do not hallucinate. "
        "STRUCTURE: "
        "1. 📖 የዕለቱ የቅዱስ ቃል: A verse relevant to student life (stress, focus, hope). "
        "2. 💡 የአባቶች ምክር: A genuine teaching from an Orthodox Church Father (e.g., St. Yared, St. John Chrysostom) in Amharic. "
        "3. ✨ ለአንተ/ለአንቺ ዛሬ: A 3-sentence personalized encouragement for a student. "
        "Use flawless Amharic grammar, bold headers, and appropriate emojis."
    )
    
    # Retry mechanism for AI Generation
    for attempt in range(3):
        try:
            response = model.generate_content(prompt)
            if response and response.text:
                return response.text
        except Exception as e:
            print(f"AI Generation Error on attempt {attempt + 1}: {e}")
            # If it's a quota error, waiting longer might help
            time.sleep(10) 
            
    return None

def broadcast_to_groups():
    message = get_spiritual_drip()
    if not message:
        print("CRITICAL: Failed to generate message after 3 attempts due to Quota or API issues.")
        return

    token = os.getenv('TELEGRAM_TOKEN')
    # Make sure your Chat ID starts with -100 for private groups
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
                response = requests.post(url, json=payload, timeout=15)
                if response.status_code == 200:
                    print(f"Successfully sent to {chat_id}")
                    break 
                else:
                    print(f"Telegram Error on attempt {attempt + 1}: {response.text}")
                    time.sleep(5)
            except requests.exceptions.RequestException as e:
                print(f"Network Error: {e}")
                time.sleep(5)

if __name__ == "__main__":
    broadcast_to_groups()
