-- Dedicated NFC database only. R2 remains private; the Worker controls media access.
CREATE TABLE media_assets (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  card_id TEXT NOT NULL REFERENCES cards(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  object_key TEXT NOT NULL UNIQUE,
  public_path TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL CHECK(content_type IN ('image/jpeg','image/png','image/webp')),
  byte_size INTEGER NOT NULL CHECK(byte_size>0 AND byte_size<=5242880),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','ready','deleting')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX media_by_card ON media_assets(card_id,created_at);
CREATE INDEX media_by_organization ON media_assets(organization_id);
CREATE INDEX media_for_cleanup ON media_assets(status,created_at);
