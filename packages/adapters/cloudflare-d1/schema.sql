-- Cloudflare D1 Schema for Trokky CMS
-- This schema supports documents, users, and app tokens with full-text search

-- Documents table (for all content collections)
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  collection TEXT NOT NULL,
  data TEXT NOT NULL, -- JSON data
  slug TEXT,
  published INTEGER DEFAULT 0, -- Boolean: 0 = false, 1 = true
  status TEXT DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT,
  updated_by TEXT,
  revision INTEGER DEFAULT 1
);

-- Indexes for documents
CREATE INDEX IF NOT EXISTS idx_documents_collection ON documents(collection);
CREATE INDEX IF NOT EXISTS idx_documents_slug ON documents(collection, slug);
CREATE INDEX IF NOT EXISTS idx_documents_published ON documents(collection, published);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(collection, status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at DESC);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role TEXT DEFAULT 'user',
  permissions TEXT, -- JSON array of permissions
  is_active INTEGER DEFAULT 1, -- Boolean
  preferences TEXT, -- JSON object
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for users
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- App tokens table
CREATE TABLE IF NOT EXISTS app_tokens (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  permissions TEXT NOT NULL, -- JSON array of permissions
  description TEXT,
  is_active INTEGER DEFAULT 1, -- Boolean
  last_used_at TEXT,
  expires_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for app tokens
CREATE INDEX IF NOT EXISTS idx_app_tokens_token_hash ON app_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_app_tokens_is_active ON app_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_app_tokens_expires_at ON app_tokens(expires_at);

-- Audit log table (optional but recommended)
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  user_id TEXT,
  username TEXT,
  action TEXT NOT NULL,
  details TEXT, -- JSON object
  ip_address TEXT,
  user_agent TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  success INTEGER DEFAULT 1 -- Boolean
);

-- Index for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- Full-text search virtual table for documents
CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
  id UNINDEXED,
  collection UNINDEXED,
  title,
  content,
  slug,
  data, -- Full JSON for advanced search
  content=documents,
  content_rowid=rowid
);

-- Triggers to keep FTS index in sync
CREATE TRIGGER IF NOT EXISTS documents_fts_insert 
AFTER INSERT ON documents 
BEGIN
  INSERT INTO documents_fts(rowid, id, collection, data)
  VALUES (new.rowid, new.id, new.collection, new.data);
END;

CREATE TRIGGER IF NOT EXISTS documents_fts_update 
AFTER UPDATE ON documents 
BEGIN
  UPDATE documents_fts 
  SET data = new.data 
  WHERE rowid = new.rowid;
END;

CREATE TRIGGER IF NOT EXISTS documents_fts_delete 
AFTER DELETE ON documents 
BEGIN
  DELETE FROM documents_fts WHERE rowid = old.rowid;
END;

-- Update timestamp trigger for documents
CREATE TRIGGER IF NOT EXISTS documents_update_timestamp 
AFTER UPDATE ON documents 
BEGIN
  UPDATE documents 
  SET updated_at = datetime('now') 
  WHERE id = new.id;
END;

-- Update timestamp trigger for users
CREATE TRIGGER IF NOT EXISTS users_update_timestamp 
AFTER UPDATE ON users 
BEGIN
  UPDATE users 
  SET updated_at = datetime('now') 
  WHERE id = new.id;
END;

-- Update timestamp trigger for app_tokens
CREATE TRIGGER IF NOT EXISTS app_tokens_update_timestamp 
AFTER UPDATE ON app_tokens 
BEGIN
  UPDATE app_tokens 
  SET updated_at = datetime('now') 
  WHERE id = new.id;
END;