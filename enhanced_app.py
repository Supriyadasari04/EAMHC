# enhanced_app.py
import streamlit as st

# -------------------- App config MUST BE FIRST --------------------
st.set_page_config(
    page_title="Enhanced Emotion-Aware AI Mental Health Coach", 
    page_icon="🤖",
    layout="wide"
)

# Now import other libraries
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv
import os
import sqlite3
import google.generativeai as genai

# -------------------- Load .env and API Key --------------------
load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    st.error("GOOGLE_API_KEY not found. Add it to your .env or environment variables.")
    st.stop()

# -------------------- GenAI SDK --------------------
genai.configure(api_key=GOOGLE_API_KEY)

# -------------------- Database Class (Inline) --------------------
class EmotionChatDatabase:
    def __init__(self, db_path="emotion_chat.db"):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Initialize database tables"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Users table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Conversations table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                title TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        
        # Messages table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id INTEGER,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                emotion TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (conversation_id) REFERENCES conversations (id)
            )
        ''')
        
        # Mood history table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS mood_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                emotion TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        
        # User stats table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_stats (
                user_id INTEGER PRIMARY KEY,
                streak INTEGER DEFAULT 0,
                last_session_date DATE,
                total_sessions INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def create_user(self, name: str) -> int:
        """Create a new user and return user_id"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            "INSERT INTO users (name) VALUES (?)",
            (name,)
        )
        user_id = cursor.lastrowid
        
        # Initialize user stats
        cursor.execute(
            "INSERT INTO user_stats (user_id) VALUES (?)",
            (user_id,)
        )
        
        conn.commit()
        conn.close()
        return user_id
    
    def get_user(self, name: str):
        """Get user by name"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT u.*, us.streak, us.last_session_date, us.total_sessions "
            "FROM users u LEFT JOIN user_stats us ON u.id = us.user_id "
            "WHERE u.name = ?",
            (name,)
        )
        user = cursor.fetchone()
        conn.close()
        
        return dict(user) if user else None
    
    def create_conversation(self, user_id: int, title: str) -> int:
        """Create a new conversation and return conversation_id"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            "INSERT INTO conversations (user_id, title) VALUES (?, ?)",
            (user_id, title)
        )
        conversation_id = cursor.lastrowid
        
        # Update user stats
        cursor.execute(
            "UPDATE user_stats SET total_sessions = total_sessions + 1 WHERE user_id = ?",
            (user_id,)
        )
        
        conn.commit()
        conn.close()
        return conversation_id
    
    def add_message(self, conversation_id: int, role: str, content: str, emotion: str = None):
        """Add a message to conversation"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            "INSERT INTO messages (conversation_id, role, content, emotion) VALUES (?, ?, ?, ?)",
            (conversation_id, role, content, emotion)
        )
        
        conn.commit()
        conn.close()
    
    def add_mood_entry(self, user_id: int, emotion: str):
        """Add mood entry for user"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            "INSERT INTO mood_history (user_id, emotion) VALUES (?, ?)",
            (user_id, emotion)
        )
        
        conn.commit()
        conn.close()
    
    def get_user_conversations(self, user_id: int):
        """Get all conversations for a user"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT id, title, created_at FROM conversations WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,)
        )
        conversations = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return conversations
    
    def get_conversation_messages(self, conversation_id: int):
        """Get all messages for a conversation"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT role, content, emotion, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at",
            (conversation_id,)
        )
        messages = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return messages
    
    def get_user_mood_history(self, user_id: int, limit: int = 30):
        """Get mood history for a user"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT emotion, created_at FROM mood_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
            (user_id, limit)
        )
        mood_history = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return mood_history
    
    def update_user_streak(self, user_id: int, streak: int, last_session_date: str):
        """Update user streak and last session date"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            "UPDATE user_stats SET streak = ?, last_session_date = ? WHERE user_id = ?",
            (streak, last_session_date, user_id)
        )
        
        conn.commit()
        conn.close()

# -------------------- Database Setup --------------------
@st.cache_resource
def get_database():
    return EmotionChatDatabase()

db = get_database()

# -------------------- Enhanced Emotion Model --------------------
@st.cache_resource
def load_enhanced_emotion_model():
    try:
        # Try to load our enhanced model first
        model_path = "./enhanced_emotion_model"
        tokenizer = AutoTokenizer.from_pretrained(model_path)
        model = AutoModelForSequenceClassification.from_pretrained(model_path)
        st.success("✅ Loaded enhanced emotion model")
    except:
        # Fallback to original model
        model_name = "j-hartmann/emotion-english-distilroberta-base"
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForSequenceClassification.from_pretrained(model_name)
        st.info("🔄 Using standard emotion model (enhanced model not found)")
    
    return tokenizer, model

emotion_tokenizer, emotion_model = load_enhanced_emotion_model()

# -------------------- App Title --------------------
st.title("🧠 Enhanced Emotion-Aware AI Mental Health Coach")

# -------------------- Crisis resources --------------------
CRISIS_RESOURCES = """
**Immediate Help Available:**
- National Suicide Prevention Lifeline: 988 (US)
- Crisis Text Line: Text HOME to 741741 (US)
- International Association for Suicide Prevention: [Find local hotlines](https://findahelpline.com), worldwide.
"""

# -------------------- Session state --------------------
if "user_id" not in st.session_state:
    st.session_state.user_id = None
if "current_conversation_id" not in st.session_state:
    st.session_state.current_conversation_id = None
if "messages" not in st.session_state:
    st.session_state.messages = []
if "awaiting_first_message" not in st.session_state:
    st.session_state.awaiting_first_message = False
if "user_name" not in st.session_state:
    st.session_state.user_name = ""
if "streak" not in st.session_state:
    st.session_state.streak = 0
if "last_session_date" not in st.session_state:
    st.session_state.last_session_date = None

# -------------------- Enhanced Helpers --------------------
def detect_emotion_enhanced(prompt: str) -> str:
    """Enhanced emotion detection with confidence scoring"""
    try:
        inputs = emotion_tokenizer(prompt, return_tensors="pt", truncation=True, padding=True, max_length=128)
        with torch.no_grad():
            outputs = emotion_model(**inputs)
        probs = torch.nn.functional.softmax(outputs.logits, dim=-1)
        confidence, predicted_class = torch.max(probs, dim=1)
        
        confidence_score = confidence.item()
        
        # Get emotion labels based on which model we're using
        if hasattr(emotion_model.config, 'id2label'):
            emotion_labels = emotion_model.config.id2label
            emotion = emotion_labels[predicted_class.item()].capitalize()
        else:
            # Default emotion mapping for our enhanced model
            emotion_mapping = {
                0: "Sadness", 1: "Joy", 2: "Love", 3: "Anger",
                4: "Fear", 5: "Surprise", 6: "Neutral"
            }
            emotion = emotion_mapping.get(predicted_class.item(), "Neutral")
        
        # Log low confidence detections
        if confidence_score < 0.6:
            st.sidebar.warning(f"Low confidence emotion detection: {emotion} ({confidence_score:.2f})")
        
        return emotion
        
    except Exception as e:
        st.warning(f"Emotion detection failed: {e}")
        return "Neutral"

def generate_personalized_exercise(emotion: str, user_name: str = "") -> str:
    """Generate personalized exercises based on emotion"""
    personalized_exercises = {
        "Joy": f"🌞 {user_name}, amplify this joy by sharing it with someone or journaling about this moment.",
        "Sadness": f"💙 {user_name}, try the 'three gratitudes' practice - write down three small things you appreciate.",
        "Anger": f"🌊 {user_name}, practice the 'STOP' technique: Stop, Take a breath, Observe, Proceed mindfully.",
        "Fear": f"🛡️ {user_name}, try 'fear setting': Write down the worst case, best case, and most likely scenario.",
        "Disgust": f"🔄 {user_name}, practice cognitive reframing - what can this reaction teach you?",
        "Surprise": f"🎯 {user_name}, take a mindful pause and observe your bodily sensations without judgment.",
        "Love": f"❤️ {user_name}, practice loving-kindness meditation by sending warm wishes to yourself and others.",
        "Neutral": f"🧘 {user_name}, try a brief body scan meditation to reconnect with the present moment."
    }
    return personalized_exercises.get(emotion, f"🧠 {user_name}, try 5 minutes of mindful breathing.")

def generate_conversation_title(prompt: str) -> str:
    """Generate conversation title with emotion context"""
    emotion = detect_emotion_enhanced(prompt)
    timestamp = datetime.now().strftime("%b %d")
    return f"{emotion} Session ({timestamp}) - {prompt[:25]}..."

def _extract_generated_text(response):
    """Robust extraction for different SDK response shapes"""
    if response is None:
        return None
    if hasattr(response, "text") and response.text:
        return response.text
    try:
        cand = getattr(response, "candidates", None)
        if cand and len(cand) > 0:
            first = cand[0]
            if hasattr(first, "output_text"):
                return first.output_text
            out = getattr(first, "output", None)
            if out and len(out) > 0:
                content = getattr(out[0], "content", None)
                if content and len(content) > 0:
                    text = getattr(content[0], "text", None)
                    if text:
                        return text
            if hasattr(first, "content") and len(first.content) > 0:
                maybe = getattr(first.content[0], "text", None)
                if maybe:
                    return maybe
    except Exception:
        pass
    try:
        return str(response)
    except Exception:
        return None

def generate_empathetic_response(prompt: str, emotion: str, user_name: str = "") -> str:
    """Generate personalized empathetic response using Gemini"""
    
    personality_traits = {
        "Joy": "energetic and celebratory",
        "Sadness": "gentle and comforting", 
        "Anger": "calm and grounding",
        "Fear": "reassuring and practical",
        "Disgust": "curious and non-judgmental",
        "Surprise": "present and observant",
        "Love": "warm and affectionate",
        "Neutral": "attentive and reflective"
    }
    
    tone = personality_traits.get(emotion, "compassionate and supportive")
    
    system_prompt = f"""
You are a mental health coach with a {tone} tone. The user {user_name} is feeling {emotion.lower()}.

User's message: "{prompt}"

Respond with this structure:
1. **Validation** (1 sentence acknowledging their emotion)
2. **Understanding** (brief reflection of what they might be experiencing)
3. **Coping Strategies** (2-3 practical, actionable suggestions)
4. **Cognitive Reframe** (one helpful perspective shift)
5. **Immediate Exercise** (one 30-second grounding practice)

Keep it conversational, personal, and focused on their specific emotion. Use their name naturally.
"""
    
    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(system_prompt)
        text = _extract_generated_text(response)
        if not text:
            return f"⚠️ I'm here for you {user_name}, but I'm having trouble responding right now. Please try again."
        return text
    except Exception as e:
        return f"⚠️ Sorry {user_name}, I couldn't generate a response: {e}"

# -------------------- Sidebar UI --------------------
with st.sidebar:
    st.header("Mental Health Tools")
    
    # User registration/login
    if not st.session_state.user_name:
        name = st.text_input("What's your name?")
        if name:
            # Check if user exists
            user_data = db.get_user(name)
            if user_data:
                st.session_state.user_id = user_data['id']
                st.session_state.user_name = name
                st.session_state.streak = user_data['streak'] or 0
                st.session_state.last_session_date = user_data['last_session_date']
                st.success(f"Welcome back, {name}! 🌟")
            else:
                # Create new user
                user_id = db.create_user(name)
                st.session_state.user_id = user_id
                st.session_state.user_name = name
                st.session_state.streak = 0
                st.success(f"Welcome, {name}! 🌻")
    else:
        st.markdown(f"### 👋 Hi, {st.session_state.user_name}!")
        if st.button("Logout"):
            for key in list(st.session_state.keys()):
                del st.session_state[key]
            st.rerun()

    st.divider()
    st.subheader("Mood Tracker")
    
    if st.session_state.user_id:
        mood_history = db.get_user_mood_history(st.session_state.user_id, limit=30)
        if mood_history:
            # Convert to DataFrame for charting
            mood_data = []
            for mood in mood_history:
                mood_data.append({
                    "Date": mood['created_at'][:10],
                    "Mood": mood['emotion']
                })
            mood_df = pd.DataFrame(mood_data)
            if not mood_df.empty:
                st.line_chart(mood_df.set_index("Date"))

    st.divider()
    st.subheader("Activity Streak")
    st.markdown(f"🔥 {st.session_state.streak} day streak")

    st.divider()
    st.subheader("Emergency Help")
    st.markdown(CRISIS_RESOURCES)

    st.divider()
    st.subheader("Conversation History")
    
    if st.button("+ New Session"):
        st.session_state.current_conversation_id = None
        st.session_state.messages = []
        st.session_state.awaiting_first_message = True
        st.rerun()

    if st.session_state.user_id:
        conversations = db.get_user_conversations(st.session_state.user_id)
        for conv in conversations:
            if st.button(conv['title'], key=f"conv_{conv['id']}"):
                st.session_state.current_conversation_id = conv['id']
                messages_data = db.get_conversation_messages(conv['id'])
                st.session_state.messages = [
                    {"role": msg['role'], "content": msg['content']} 
                    for msg in messages_data
                ]
                st.session_state.awaiting_first_message = False
                st.rerun()

# -------------------- Main chat area --------------------
if st.session_state.awaiting_first_message:
    st.info("Please share how you're feeling to start your session...")

if prompt := st.chat_input("Share your thoughts or feelings..."):
    if not st.session_state.user_id:
        st.error("Please enter your name first!")
        st.stop()

    # Update streak
    today = datetime.now().date()
    if st.session_state.last_session_date != str(today):
        st.session_state.streak += 1
        st.session_state.last_session_date = str(today)
        db.update_user_streak(
            st.session_state.user_id, 
            st.session_state.streak, 
            str(today)
        )

    # Detect emotion
    emotion = detect_emotion_enhanced(prompt)
    
    # Store mood entry
    db.add_mood_entry(st.session_state.user_id, emotion)

    # Create new conversation if needed
    if not st.session_state.current_conversation_id or st.session_state.awaiting_first_message:
        title = generate_conversation_title(prompt)
        conversation_id = db.create_conversation(st.session_state.user_id, title)
        st.session_state.current_conversation_id = conversation_id
        st.session_state.messages = []
        st.session_state.awaiting_first_message = False

    # Store user message
    db.add_message(st.session_state.current_conversation_id, "user", prompt, emotion)
    st.session_state.messages.append({"role": "user", "content": prompt})

    # Display user message
    with st.chat_message("user"):
        col1, col2 = st.columns([4, 1])
        with col1:
            st.markdown(prompt)
        with col2:
            st.markdown(f"`{emotion}`")

    # Generate and display assistant response
    with st.chat_message("assistant"):
        with st.spinner("Thinking compassionately..."):
            crisis_keywords = ["kill myself", "end my life", "suicide", "self-harm", "want to die"]
            if any(k in prompt.lower() for k in crisis_keywords):
                reply = f"""
I hear you're in deep pain right now, {st.session_state.user_name}. Please know you're not alone and there is help available.

**Immediate Help:**
{CRISIS_RESOURCES}

Would you like help finding professional support near you?
"""
            else:
                reply = generate_empathetic_response(prompt, emotion, st.session_state.user_name)
                reply += f"\n\n**Personalized Practice:** {generate_personalized_exercise(emotion, st.session_state.user_name)}"

        st.markdown(reply)

        # Celebrate milestones
        if st.session_state.streak % 5 == 0 and st.session_state.streak > 0:
            st.balloons()
            st.success(f"🌟 Amazing commitment, {st.session_state.user_name}! You're on a {st.session_state.streak}-day self-care streak!")

    # Store assistant response
    db.add_message(st.session_state.current_conversation_id, "assistant", reply)
    st.session_state.messages.append({"role": "assistant", "content": reply})
    st.rerun()

# -------------------- Display conversation --------------------
if st.session_state.current_conversation_id and not st.session_state.awaiting_first_message:
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

# -------------------- Empty state --------------------
if not st.session_state.user_id:
    st.info("👆 Please enter your name to begin your mental health journey")
elif not st.session_state.current_conversation_id and not st.session_state.awaiting_first_message:
    st.info("💬 Share how you're feeling to begin your mental health journey")