# ADMAKI Digital Card platform

## What changed

All companies share the admin and client workspaces. Published cards render directly from D1 using a trusted, compiled template. Preview uses the same renderer with scripts and navigation disabled. The static profile files are onboarding seeds; deployments never import those seeds over existing D1 content. An unavailable database/template returns an error rather than displaying stale seed content.

Existing public addresses, contact-file aliases and QR destinations stay permanent. The Shasho portrait remains a display WebP; saved contacts embed its small JPEG early in the vCard. A declared static-photo alias keeps the original saved revision restorable. Physical iOS/Android contact import behavior still needs device acceptance testing.

## Add a standard company

1. Admin → Companies → Add company. Repeated submissions use a request ID; an existing company name is rejected with guidance to open its workspace.
2. Open company → Add digital card → Professional business card. Choose the permanent slug and verified display name/contact details. No deployment is required. SVG and PNG QR files and the contact download work immediately.
3. Open the shared editor, add verified content and images, preview, save draft and publish. Empty contact links are omitted in the standard design.
4. Company → Client access → Add account. Supply a private unique password; accounts are never created or exposed automatically. Only create access for the intended recipient.

Runtime-created companies live in D1, not in the seed registry. The registry remains the supported insert-only path for imported/source-managed companies. Do not add a second registry company with a different ID for a runtime company; look it up first.

## Add a custom design

Create `templates/<id>/manifest.json`, trusted source HTML and an example profile. Declare the editable field schema and selector bindings. Arrays declare item fields; sections can be optional. All editable text/attributes are escaped and links validated. Templates are developer-supplied trusted code, not client HTML uploads. Company-specific approved templates restrict card creation to that organization; the standard business template is reusable.

Build once to create `templates/releases/<id>/<version>/template.json` and hashed CSS. Commit these release artifacts. A later build rejects changes to a released version. Increment the version for HTML, CSS or schema changes and retain every prior release. Existing cards and history retain their template and schema version. A template release does not silently migrate client content. Moving an existing card to another version requires an explicit validated migration, preserving old revisions and drafts; there is no automatic upgrade button.

Legacy generators/normalizers remain as import adapters for existing approved layouts. New runtime content does not use their company-specific branches. Some decorative headings and approved promotional sections remain template copy; only schema-declared content appears in the editor.

## Storage, history and operations

- Admin company/card directories search and paginate on the server (24 rows by default, maximum 100).
- Card slug, membership and directory indexes support tenant lookups. A 1,000-company/2,000-card local fixture checks query plans and bounded results; it is not a live concurrency certification.
- Upload reservations enforce 100 MiB per company and 100 image objects per card by default, including pending objects. Limits are organization configuration in D1. Storage usage appears in the editor history tab.
- The latest 20 published revisions remain in hot D1 storage. Older versions archive to private MEDIA R2 and stay restorable; referenced historical images are retained. Daily scheduling starts logical backups; the one-minute maintenance schedule advances bounded batches, archives history and cleans stale unused media. Archive work pauses while a backup is running.
- BACKUPS is a separate private bucket. Staging backup objects expire after 7 days; production after 30 days. Media/history objects do not use that expiration rule. R2 Standard storage only.
- Large media libraries can take multiple maintenance batches to back up. A running snapshot older than 24 hours is flagged as overdue; increase throughput or use a dedicated workflow before promising daily full-media recovery for a high-volume tenant.
- Admin → Account settings shows backup health and offers Start backup/Continue maintenance. Failures produce structured Worker logs; this release does not send external email/SMS alerts or send external security notifications.
- HTML uses ETag revalidation. Private draft/media/API responses remain uncached. Public media rechecks its publication reference on every request so rollback does not leave a shared cached private image.

## Recovery

Keep repository release assets and Worker deployment versions. Keep AUTH_PEPPER separately in a private recovery record: password hashes cannot authenticate without the original pepper. Backups contain account hashes and company content and must remain private. Sessions are deliberately omitted and cleared on restore.

Backups are resumable logical snapshots collected over a recorded time window, not one atomic database/media instant. Each part and media object has a SHA-256 integrity check. Use D1 Time Travel for an exact database point and reconcile media against that point. A live backup was downloaded and restored into an empty isolated local SQLite database; this does not replace a full regional outage drill.

Download a completed backup through authenticated `/api/admin/backups/<id>/manifest`, `table-<n>`, `object-<n>` and `object-<n>-meta`. Store as manifest.json, table-N.json, object-N and object-N.json. Run:

```
node scripts/recover-backup.mjs PRIVATE_BACKUP_DIRECTORY NEW_OUTPUT_DIRECTORY
```

The command refuses an existing output directory, verifies hashes/table names/foreign keys, creates recovered.sqlite and restores media keys under media/. Before live recovery, restore into a new isolated D1 and R2 bucket, bind a recovery Worker with the correct pepper and retained template releases, check every permanent slug and tenant login, then switch production bindings. Never restore directly over an active production database.

For application rollback, use a prior compatible Worker deployment while retaining current D1/R2. Schema migrations are additive. For content rollback, use the card History tab; rollback creates another published revision and preserves the permanent slug. Restore of archived revisions requires the archive object to exist.

## Deployment safeguards

Use `npm run check`, then Wrangler dry-run. Deploy staging and test authentication, tenant denial, public HTML, preview, all contact files, uploads and backup recovery. Production has separate D1, MEDIA and BACKUPS resources; never bind staging data to production. Record all applied SQL migration names in d1_migrations so subsequent Wrangler migration runs do not reapply ALTER TABLE statements.

The 30-day backup window, retained media/history and traffic determine ongoing costs. No infrastructure plan upgrade is required by this code change. Cost estimates require measured traffic/storage and the actual account plan; no fixed bill is promised.

## Administrator two-step verification

Admin → Account settings → Two-step verification. Enter the current password, scan the private QR using an authenticator app, and enter its current six-digit code. Setup expires after ten minutes. Enabling it signs out existing administrator sessions. Save the ten recovery codes shown once before signing in again. Each recovery code works once; the sign-in code field accepts either an authenticator code or a recovery code.

Secrets are encrypted with AES-GCM using an account-bound key derived from AUTH_PEPPER. Recovery codes are stored only as keyed hashes. Accepted TOTP steps cannot be replayed. Password and factor attempts share account lockout and edge limits; enrollment changes require the current password. Client accounts are not enrolled automatically. No production account is enrolled by a deployment.

Turn-off requires the current password plus an authenticator or recovery code and revokes existing sessions. If every device and recovery code is lost, the platform owner must verify ownership and perform an audited administrative recovery through Cloudflare; there is no password-only self-service bypass. Re-enroll if new recovery codes are needed. Keep AUTH_PEPPER in private recovery storage because it is required for both password authentication and authenticator decryption. Older eight-table backups remain restorable; newer snapshots also contain security_events and encrypted MFA fields.
