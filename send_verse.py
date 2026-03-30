import os
import time
import json
import random
import uuid
import logging
import requests
import re
from pathlib import Path
from typing import Optional

# Professional Logging Configuration
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | [EOTC-ARCHITECT] | %(levelname)s | %(message)s",
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
    """Handles prompt engineering, strict formatting, and Church Father quotes."""
    
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
        return f"""CRITICAL SYSTEM INSTRUCTION: Your output MUST BE 100% Amharic. NO English.
STRICT TELEGRAM HTML RULES:
1. DO NOT use <html>, <body>, or <head> tags.
2. DO NOT output the text string '\\n'. 
3. DO NOT use Markdown (**). Use ONLY <b> and <blockquote>.
4. SPACING: You MUST leave TWO COMPLETELY EMPTY LINES between every section.

ROLE: Distinguished Spiritual Father (ሊቀ ሊቃውንት) of the EOTC.
TARGET: Sunday School youth (የሃይማኖት ማኅቶት አብሪዎች).
SESSION: {unique_id} | THEME: {theme}

MANDATORY STRUCTURE (Ensure large vertical gaps):

<b>1. 🏛️ የሰማያዊ ጥበብ መክፈቻ:</b>
<blockquote><b>[Verse Text]</b> — [Book] [Chapter:Verse]</blockquote>


✧—————✧


<b>2. ☦️ የቅዱሳን አባቶች የብርሃን ማዕድ:</b>
You MUST name a specific EOTC Father (e.g. ቅዱስ ዮሐንስ አፈወርቅ, ቅዱስ ይስሐቅ ሶርያዊ, etc.) and provide their direct quote.
Format: [Name] እንዲህ ይላል፦ <blockquote>[Father's Deep Quote]</blockquote>


✧—————✧


<b>3. 🕊️ ለነገው የአጥቢያ ብርሃን:</b>
[3 powerful sentences using 'ባለራዕይ', 'ጽኑዕ', 'መዝገበ ሃይማኖት']


✧—————✧


<b>4. ✨ የዕለቱ ሐዋርያዊ ቡራኬ:</b>
[Unique one-line blessing]"""

    def _validate_response(self, text: str) -> bool:
        if len(text) < 300: return False
        required_emojis = ["🏛️", "☦️", "🕊️", "✨"]
        return all(emoji in text for emoji in required_emojis)

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
                res = self.session.post(self.url, json=payload, timeout=50)
                res.raise_for_status()
                content = res.json().get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                
                # --- FORMATTING PROTECTION ---
                content = content.replace('\\n', '\n').replace('\\\\n', '\n')
                content = re.sub(r'\n{4,}', '\n\n\n', content) # Normalize whitespace
                content = content.replace('**', '') # Double check for markdown
                
                if self._validate_response(content):
                    return content
                logging.warning(f"{model_id} failed validation.")
            except Exception as e:
                logging.error(f"Error with {model_id}: {e}")
            
            time.sleep(2)
            
        return None

class TelegramBroadcaster:
    """Handles safe, sanitized, direct HTML broadcasting to Telegram."""
    
    def __init__(self):
        self.token = os.getenv('TELEGRAM_TOKEN')
        self.chat_ids = [cid.strip() for cid in os.getenv('TELEGRAM_CHAT_IDS', '').split(',') if cid.strip()]
        self.api_url = f"https://api.telegram.org/bot{self.token}/sendMessage"

    def _sanitize_output(self, text: str) -> str:
        bad_tags = ["<html>", "</html>", "<body>", "</body>", "<head>", "</head>", "```html", "```"]
        for tag in bad_tags:
            text = re.sub(re.escape(tag), "", text, flags=re.IGNORECASE)
        return text.strip()

    def broadcast(self, message: str) -> None:
        if not self.chat_ids:
            logging.error("No Telegram Chat IDs configured.")
            return

        clean_message = self._sanitize_output(message)

        for chat_id in self.chat_ids:
            payload = {
                "chat_id": chat_id, 
                "text": clean_message,
                "parse_mode": "HTML",
                "disable_web_page_preview": True
            }
            
            try:
                res = requests.post(self.api_url, json=payload, timeout=20)
                if res.status_code == 200:
                    logging.info(f"Broadcast successful to: {chat_id}")
                else:
                    logging.warning(f"HTML error for {chat_id}. Sending plain text fallback.")
                    payload.pop("parse_mode")
                    requests.post(self.api_url, json=payload, timeout=20)
            except Exception as e:
                logging.error(f"Delivery failed for {chat_id}: {e}")

def main():
    logging.info("Starting Spiritual Drip Orchestrator (Complete Version)...")
    theme_mgr = ThemeManager()
    ai_gen = AIGenerator()
    broadcaster = TelegramBroadcaster()
    
    selected_theme = theme_mgr.select_next_theme()
    final_content = ai_gen.generate_drip(selected_theme)
    
    if final_content:
        broadcaster.broadcast(final_content)
        logging.info("Drip session completed successfully.")
    else:
        logging.critical("No content generated.")

if __name__ == "__main__":
    main()
