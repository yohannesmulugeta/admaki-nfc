-- Apply only to the dedicated NFC staging database.
ALTER TABLE cards ADD COLUMN last_mutation_id TEXT;
CREATE TABLE card_revisions (
  card_id TEXT NOT NULL REFERENCES cards(id),
  version INTEGER NOT NULL,
  profile_json TEXT NOT NULL CHECK(json_valid(profile_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(card_id,version)
);
INSERT OR IGNORE INTO card_revisions(card_id,version,profile_json)
 SELECT id,version,published_json FROM cards;
CREATE INDEX audit_by_card ON audit_events(card_id,created_at);
CREATE INDEX sessions_by_expiry ON sessions(expires_at);
