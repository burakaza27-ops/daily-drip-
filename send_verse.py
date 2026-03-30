import os
import time
import json
import random
import uuid
import logging
import requests
from pathlib import Path
from typing import Optional

# Lean, Professional Logging Configuration
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | [EOTC-DRIP] | %(levelname)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

class ThemeManager:
    """Manages thematic states to prevent consecutive repetitions."""
    
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

    def _get_last_theme(self) -> Optional[str]:
        if self.state_file.exists():
            try:
                with open(self.state_file, 'r', encoding='utf-8') as f:
                    return json.load(f).get("last_theme")
            except (json.JSONDecodeError, IOError):
                return None
        return None

    def select_next_theme(self) -> str:
        last_theme = self._get_last_theme()
        available_themes = [t for t in self.themes if t != last_theme]
        selected = random.choice(available_themes)
        
        try:
            with open(self.state_file, 'w', encoding='utf-8') as f:
                json.dump({"last_theme": selected, "timestamp": time.time()}, f, ensure_ascii=False)
        except IOError as e:
            logging.error(f"Failed to save state: {e}")
            
        logging.info(f"Selected Theme: {selected}")
        return selected

class AIGenerator:
    """Handles prompt engineering, strict formatting, and failover validation."""
    
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.url = "https://openrouter.ai/api/v1/chat/completions"
        self.models = [
            "google/gemini-2.0-flash-001", 
            "anthropic/claude-3-haiku", 
            "google/gemini-flash-1.5"
        ]
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/burakaza27-ops/daily-drip-",
        })

    def _build_prompt(self, theme: str) -> str:
        unique_id = str(uuid.uuid4())[:8]
        return (
            f"CRITICAL INSTRUCTION: Output MUST BE 100% Amharic. NO English. NO Markdown (**). "
            f"Use ONLY HTML tags. SESSION: {unique_id} | THEME: {theme}\n\n"
            
            "ROLE: You are a distinguished Spiritual Father (ሊቀ ሊቃውንት) of the Ethiopian Orthodox Tewahedo Church. "
            "STYLE: Majestic, Ge'ez-rooted Amharic. Address Sunday School youth as 'የሃይማኖት ማኅቶት አብሪዎች'.\n\n"
            
            "SPACING RULE (ABSOLUTE PRIORITY): You MUST insert exactly TWO empty lines between every single section and before/after the ✧—————✧ separator. The output must be airy and highly readable.\n\n"
            
            "MANDATORY HTML STRUCTURE:\n\n"
            
            "<b>1. 🏛️ የሰማያዊ ጥበብ መክፈቻ:</b>\n"
            "<br>\n"
            f"Select a high-impact EOTC Bible verse about '{theme}'.\n"
            "Format exactly like this: <blockquote><b>[Verse Text]</b> — [Book] [Chapter:Verse]</blockquote>\n\n\n"
            
            "✧—————✧\n\n\n"
            
            "<b>2. ☦️ የቅዱሳን አባቶች የብርሃን ማዕድ:</b>\n"
            "<br>\n"
            f"Deliver a profound, rare teaching from an EOTC Father about '{theme}'. Explain the spiritual mystery (ምሥጢር).\n\n\n"
            
            "✧—————✧\n\n\n"
            
            "<b>3. 🕊️ ለነገው የአጥቢያ ብርሃን:</b>\n"
            "<br>\n"
            "Write 3 powerful sentences challenging the youth to be 'Spiritual Giants'. Use 'ባለራዕይ', 'ጽኑዕ', 'መዝገበ ሃይማኖት'.\n\n\n"
            
            "✧—————✧\n\n\n"
            
            "<b>4. ✨ የዕለቱ ሐዋርያዊ ቡራኬ:</b>\n"
            "<br>\n"
            "A one-line, unique, heavy blessing."
        )

    def _validate_response(self, text: str) -> bool:
        if len(text) < 300: return False
        if not all(emoji in text for emoji in ["🏛️", "☦️", "🕊️", "✨"]): return False
        if "**" in text: return False # Reject Markdown
        return True

    def generate_drip(self, theme: str) -> Optional[str]:
        prompt = self._build_prompt(theme)
        
        for model_id in self.models:
            logging.info(f"Generating with {model_id}...")
            payload = {
                "model": model_id, 
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.85,
                "presence_penalty": 0.8,
                "frequency_penalty": 0.8 
            }
            
            try:
                res = self.session.post(self.url, json=payload, timeout=45)
                res.raise_for_status()
                content = res.json().get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                
                if self._validate_response(content):
                    return content
                logging.warning(f"{model_id} failed validation. Retrying next model.")
            except Exception as e:
                logging.error(f"Error with {model_id}: {e}")
            
            time.sleep(2)
            
        return None

class TelegramBroadcaster:
    """Handles clean, direct HTML broadcasting to Telegram."""
    
    def __init__(self):
        self.token = os.getenv('TELEGRAM_TOKEN')
        self.chat_ids = [cid.strip() for cid in os.getenv('TELEGRAM_CHAT_IDS', '').split(',') if cid.strip()]
        self.api_url = f"https://api.telegram.org/bot{self.token}/sendMessage"

    def broadcast(self, message: str) -> None:
        if not self.chat_ids:
            logging.error("No Telegram Chat IDs configured.")
            return

        for chat_id in self.chat_ids:
            payload = {
                "chat_id": chat_id, 
                "text": message, # Pure message injection, no appended signature
                "parse_mode": "HTML",
                "disable_web_page_preview": True
            }
            
            try:
                res = requests.post(self.api_url, json=payload, timeout=15)
                if res.status_code == 200:
                    logging.info(f"Broadcast successful to: {chat_id}")
                else:
                    logging.error(f"Telegram API Error for {chat_id}: {res.text}")
            except Exception as e:
                logging.error(f"Delivery failed for {chat_id}: {e}")

def main():
    logging.info("Initializing Pure Spiritual Drip...")
    
    theme = ThemeManager().select_next_theme()
    drip_content = AIGenerator().generate_drip(theme)
    
    if drip_content:
        TelegramBroadcaster().broadcast(drip_content)
        logging.info("Execution complete.")
    else:
        logging.critical("Execution aborted: No valid content generated.")

if __name__ == "__main__":
    main()
