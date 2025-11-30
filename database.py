# database.py
import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Optional

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
    
    def get_user(self, name: str) -> Optional[Dict]:
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
    
    def get_user_conversations(self, user_id: int) -> List[Dict]:
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
    
    def get_conversation_messages(self, conversation_id: int) -> List[Dict]:
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
    
    def get_user_mood_history(self, user_id: int, limit: int = 30) -> List[Dict]:
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