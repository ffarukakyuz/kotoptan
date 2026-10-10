-- Cloudflare D1 Database Schema for Kotoptan (kotoptan-db)

-- 1. Sohbet Oturumları (chat_sessions)
CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_name TEXT,
  user_phone TEXT,
  status TEXT DEFAULT 'bot', -- 'bot', 'transferred', 'active_admin', 'closed'
  last_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Sohbet Mesajları (chat_messages)
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  sender TEXT NOT NULL, -- 'user', 'bot', 'admin'
  sender_name TEXT,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text', -- 'text' or 'voice'
  audio_url TEXT,
  duration INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status);
