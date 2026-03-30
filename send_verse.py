import os
import time
import json
import random
import uuid
import logging
import requests
from pathlib import Path
from typing import Optional, List

# Advanced Logging Configuration
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - [EOTC-DRIP-BOT] - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

class ThemeManager:
    """Manages thematic states to ensure no consecutive repetitions."""
    
    def __init__(self, state_file: str = "theme_state.json"):
        self.state_file = Path(state_file)
        self.themes = [
            "ትዕግስትና ተስፋ", "መለኮታዊ ፍቅር", "ትሕትናና የልብ የዋህነት", "የጸሎት ኃይል", 
            "መንፈሳዊ ትጋት", "የልቦና ንጽሕና", "ቅዱስ አገልግሎት", "ጽኑዕ እምነት", 
            "ምጽዋትና ርኅራኄ", "ዝምታና ማስተዋል", "እውነተኛ ንስሐ", "የምስጋና ሕይወት",
            "ሰማያዊ ጥበብ", "ክርስቲያናዊ ጽናት", "የእግዚአብሔር ረዳትነት", "የቅዱሳን አማላጅነት", 
            "መንፈሳዊ ማዕረግ", "ሰላመ ልቦና", "የዘመን አጠቃቀም", "ትሕትና በምግባር", 
            "የነፍስ ተጋድሎ", "የወጣትነት ቅድስና", "የቤተክርስቲያን ፍቅር"
        ]

    def get_last_theme(self) -> Optional[str]:
        if self.state_file.exists():
            try:
                with open(self.state_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    return data.get("last_theme")
            except Exception as e:
                logging.error(f"Error reading state file: {e}")
        return None

    def save_last_theme(self, theme: str) -> None:
        try:
            with open(self.state_file, 'w', encoding='utf-8') as f:
                json.dump({"last_theme": theme, "timestamp": time.time()}, f, ensure_ascii=False)
        except Exception as e:
            logging.error(f"Error saving state file: {e}")

    def select_next_theme(self) -> str:
        last_theme = self.get_last_theme()
        available_themes = [t for t in self.themes if t != last_theme]
        selected = random.choice(available_themes)
        self.save_last_theme(selected)
        logging.info(f"Selected Theme: {selected} (Previous: {last_theme})")
        return selected


class AIGenerator:
    """Handles prompt engineering, model failover, and output validation."""
    
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.url = "https://openrouter.ai/api/v1/chat/completions"
        self.models = [
            "google/gemini-2.0-flash-001", 
            "anthropic/claude-3-haiku", 
            "google/gemini-flash-1.5"
        ]
        # Use a Session for connection pooling (faster & more efficient)
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/burakaza27-ops/daily-drip-",
        })

    def _build_prompt(self, theme: str) -> str:
        unique_id = str(uuid.uuid4())[:8]
        return (
            f"CRITICAL INSTRUCTION: Your output MUST BE 100% Amharic. NO English words. NO Markdown bolding (**). "
            f"Use ONLY HTML tags for formatting like <b>bold</b> or <blockquote>quotes</blockquote>.\n"
            f"SESSION_ID: {unique_id} | MASTER_THEME: {theme}\n\n"
            
            "ROLE: You are a distinguished, highly learned Spiritual Father (ሊቀ ሊቃውንት) of the Ethiopian Orthodox Tewahedo Church. "
            "STYLE GUIDE: Your vocabulary must be rooted in Ge'ez and high-level Amharic (e.g., use 'መንፈሳዊ ተጋድሎ', 'ማኅቶት', 'ምሥጢር'). "
            "Do not use repetitive, modern casual phrasing. Speak with majestic, fatherly weight.\n\n"
            
            "TARGET: Sunday School (ሰንበት ትምህርት ቤት) servants and youth. Address them as 'The Torchbearers of the Faith' (የሃይማኖት ማኅቶት አብሪዎች).\n\n"
            
            "MANDATORY HTML STRUCTURE (Do not deviate):\n"
            "<b>1. 🏛️ የሰማያዊ ጥበብ መክፈቻ:</b>\n"
            f"Select a high-impact, verified Bible verse (EOTC Canon) focused on '{theme}'. "
            "Format: <blockquote><b>[Verse Text]</b> — [Book] [Chapter:Verse]</blockquote>\n"
            "✧—————✧\n"
            "<b>2. ☦️ የቅዱሳን አባቶች የብርሃን ማዕድ:</b>\n"
            f"Deliver a profound, poetic, and rare teaching from an EOTC Father (e.g., St. Yared, Mar Isaac) about '{theme}'. "
            "Explain the spiritual mystery (ምሥጢር) behind it in a way that creates 'Jaw-Dropping' realization.\n"
            "✧—————✧\n"
            "<b>3. 🕊️ ለነገው የአጥቢያ ብርሃን:</b>\n"
            "Write 3-4 powerful, high-end sentences specifically for Sunday School youth. "
            "Challenge them to be 'Spiritual Giants'. Use words like 'ባለራዕይ', 'ጽኑዕ', 'መዝገበ ሃይማኖት'.\n"
            "✧—————✧\n"
            "<b>4. ✨ የዕለቱ ሐዋርያዊ ቡራኬ:</b>\n"
            "A one-line, unique, and heavy blessing that resonates with their service."
        )

    def _validate_response(self, text: str) -> bool:
        """Ensures the AI output meets our strict quality standards."""
        if len(text) < 300:
            logging.warning("Validation Failed: Output too short.")
            return False
        required_emojis = ["🏛️", "☦️", "🕊️", "✨"]
        if not all(emoji in text for emoji in required_emojis):
            logging.warning("Validation Failed: Missing structural emojis.")
            return False
        if "**" in text:
            logging.warning("Validation Failed: AI used Markdown instead of HTML.")
            return False
        return True

    def generate_drip(self, theme: str) -> Optional[str]:
        prompt = self._build_prompt(theme)
        
        for model_id in self.models:
            logging.info(f"Attempting generation with {model_id}...")
            payload = {
                "model": model_id, 
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.85, # Slightly lowered to keep theological accuracy tight
                "presence_penalty": 0.8,
                "frequency_penalty": 0.8 
            }
            
            try:
                response = self.session.post(self.url, json=payload, timeout=45)
                response.raise_for_status()
                result = response.json()
                
                if "choices" in result:
                    content = result["choices"][0]["message"]["content"].strip()
                    if self._validate_response(content):
                        logging.info(f"Success! {model_id} delivered a validated masterpiece.")
                        return content
                    else:
                        logging.warning(f"Model {model_id} output rejected by validation layer.")
                        
            except requests.exceptions.RequestException as e:
                logging.error(f"Network error with {model_id}: {e}")
            except Exception as e:
                logging.error(f"Unexpected error with {model_id}: {e}")
            
            time.sleep(3) # Brief pause before failover
            
        logging.critical("All models failed to produce a valid response.")
        return None


class TelegramBroadcaster:
    """Handles dispatching HTML formatted messages to Telegram."""
    
    def __init__(self):
        self.token = os.getenv('TELEGRAM_TOKEN')
        chat_ids_str = os.getenv('TELEGRAM_CHAT_IDS', '')
        self.chat_ids = [cid.strip() for cid in chat_ids_str.split(',') if cid.strip()]
        self.api_url = f"https://api.telegram.org/bot{self.token}/sendMessage"

    def broadcast(self, message: str) -> None:
        if not self.chat_ids:
            logging.error("No Telegram Chat IDs configured.")
            return

        # Professional Signature (HTML format)
        final_message = message + "\n\n✧—————✧\n<b>በብሩክ አውቶሜሽን (Brookers) የቀረበ</b>"

        for chat_id in self.chat_ids:
            payload = {
                "chat_id": chat_id, 
                "text": final_message, 
                "parse_mode": "HTML",
                "disable_web_page_preview": True
            }
            
            try:
                res = requests.post(self.api_url, json=payload, timeout=20)
                if res.status_code == 200:
                    logging.info(f"Broadcast successful to Group: {chat_id}")
                else:
                    logging.error(f"Telegram API Error for {chat_id}: {res.text}")
                    # Fallback to plain text if HTML parsing fails entirely
                    payload.pop("parse_mode")
                    requests.post(self.api_url, json=payload)
                    logging.warning(f"Sent as plain text to {chat_id} due to HTML parse error.")
            except Exception as e:
                logging.error(f"Telegram delivery failed for {chat_id}: {e}")


def main():
    """Main Orchestration Flow"""
    logging.info("Starting Daily Spiritual Drip Automation...")
    
    theme_manager = ThemeManager()
    ai_generator = AIGenerator()
    broadcaster = TelegramBroadcaster()
    
    # 1. Get State-Aware Theme
    selected_theme = theme_manager.select_next_theme()
    
    # 2. Generate Content with Failover & Validation
    drip_content = ai_generator.generate_drip(selected_theme)
    
    # 3. Broadcast
    if drip_content:
        broadcaster.broadcast(drip_content)
    else:
        logging.critical("Execution aborted: No valid content was generated.")

if __name__ == "__main__":
    # Ensure environment variables are loaded if testing locally
    # from dotenv import load_dotenv; load_dotenv()
    main()
