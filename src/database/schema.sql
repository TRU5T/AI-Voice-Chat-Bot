-- Clients table
CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'inactive',
  status_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SIP configuration
CREATE TABLE sip_configs (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  sip_server VARCHAR(255) NOT NULL,
  sip_domain VARCHAR(255) NOT NULL,
  sip_username VARCHAR(255) NOT NULL,
  sip_password VARCHAR(255) NOT NULL,
  reg_interval INTEGER DEFAULT 3600,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI configuration
CREATE TABLE ai_configs (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  llm_provider VARCHAR(50) DEFAULT 'openai',
  llm_model VARCHAR(50) DEFAULT 'gpt-4',
  voice_provider VARCHAR(50) DEFAULT 'elevenlabs',
  voice_id VARCHAR(50),
  transcription_model VARCHAR(50) DEFAULT 'whisper',
  system_prompt TEXT,
  greeting_file VARCHAR(255),
  goodbye_file VARCHAR(255),
  max_turns INTEGER DEFAULT 10,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Call records
CREATE TABLE calls (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  call_id VARCHAR(255) NOT NULL,
  caller_number VARCHAR(50),
  called_number VARCHAR(50),
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  duration INTEGER,
  status VARCHAR(50) DEFAULT 'in_progress',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Call interactions
CREATE TABLE call_interactions (
  id SERIAL PRIMARY KEY,
  call_id INTEGER REFERENCES calls(id) ON DELETE CASCADE,
  speaker VARCHAR(50) NOT NULL,
  content TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Error logs
CREATE TABLE error_logs (
  id SERIAL PRIMARY KEY,
  error_type VARCHAR(50) NOT NULL,
  details JSONB,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table for admin portal
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
); 