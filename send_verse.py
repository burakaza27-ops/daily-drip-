import os
import time
import requests

def get_spiritual_drip():
    openrouter_key = os.getenv("GEMINI_API_KEY") 
    
    # PERFECT & DETAILED PROMPT
    prompt = (
        "Role: You are a wise, compassionate, and strictly Ethiopian Orthodox Tewahedo Church (EOTC) spiritual mentor. "
        "Task: Generate a daily 'Spiritual Drip' message for Ethiopian university students. "
        "Language: The entire response MUST be in flawless Amharic (Ethiopic script). No English words allowed. "
        "Structure & Content: "
        "1. 📖 የዕለቱ የቅዱስ ቃል: Provide a comfort-giving or focus-oriented Bible verse in Amharic. Include the book and chapter (e.g., መዝሙረ ዳዊት 23:1). "
        "2. 💡 የአባቶች ምክር: Provide a deep, historically accurate teaching from an Orthodox Church Father (like St. Yared, St. Tekle Haymanot, or St. Isaac the Syrian). "
        "3. ✨ ለአንተ/ለአንቺ ዛሬ: Write 3-4 sentences of direct encouragement for a student dealing with exams, stress, or life's journey. "
        "Style: Use bold headers, clean spacing, and respectful emojis. Ensure theological accuracy and zero political content."
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
