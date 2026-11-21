-- Shared dashboard branding. Every new company inherits the standard workspace.
ALTER TABLE organizations ADD COLUMN logo_url TEXT NOT NULL DEFAULT '';
ALTER TABLE organizations ADD COLUMN accent TEXT NOT NULL DEFAULT '#2563eb';
