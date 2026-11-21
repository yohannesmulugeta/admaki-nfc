ALTER TABLE users ADD COLUMN mfa_secret_cipher TEXT;
ALTER TABLE users ADD COLUMN mfa_pending_cipher TEXT;
ALTER TABLE users ADD COLUMN mfa_pending_expires_at INTEGER;
ALTER TABLE users ADD COLUMN mfa_last_step INTEGER;
ALTER TABLE users ADD COLUMN mfa_recovery_json TEXT NOT NULL DEFAULT '[]';
CREATE TABLE security_events(id TEXT PRIMARY KEY,actor_user_id TEXT NOT NULL REFERENCES users(id),action TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX security_events_by_actor ON security_events(actor_user_id,created_at);
