ALTER TABLE organizations ADD COLUMN media_limit_bytes INTEGER NOT NULL DEFAULT 104857600;
ALTER TABLE organizations ADD COLUMN media_object_limit INTEGER NOT NULL DEFAULT 100;
CREATE INDEX operations_kind_status ON operational_runs(kind,status,created_at);
CREATE INDEX revision_archive_card ON revision_archives(card_id,version DESC);
