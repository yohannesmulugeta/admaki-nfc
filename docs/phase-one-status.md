# ADMAKI Digital Card — Phase 1 staging

Updated 20 November 2026.

## Deployment

- Repository: `yohannesmulugeta/admaki-nfc`
- Development branch: `feature/maison-four-independent-cards`
- Staging Worker: `admaki-nfc-staging`
- Staging origin: `https://admaki-nfc-staging.yohannesmulugeta084.workers.dev`
- Admin: `/admin/`
- Client: `/dashboard/`
- Dedicated staging D1: `d58537b6-6de3-4c98-bd94-3c3f877248c4`
- Worker secret: `AUTH_PEPPER`. Never commit, print, or replace this value casually. Rotating it requires resetting every password derived with it.

The existing production Worker and its custom domains are unchanged. Permanent NFC/QR destinations remain on `nfc.admakidigital.com`. The staging QR codes deliberately retain these permanent destinations; staging test links are not replacement card destinations.

## Implemented

- Separate password accounts for platform administrator and Maison Debrah owner.
- Platform admin can create companies, inspect their existing cards, open the editor, create client accounts and reset their passwords. Account creation/reset events are audited; reset revokes the client's sessions.
- Maison login can list and edit only its four independently stored cards.
- Friendly address, collection, social-profile and gallery fields; general contact and image-link editing; text preview; save draft, publish, discard and published history/restore.
- Tenant membership checked before record access. Platform privileges are explicit and do not require tenant membership.
- Optimistic concurrency with version checks, atomic publish/history/audit batches, and immutable slugs.
- Public API returns only published data. Existing static cards act as a fallback when the API is unavailable.
- Published details hydrate the four existing public cards. Downloading a contact reads that card's latest published data, with UTF-8 line folding and vCard escaping.
- HttpOnly/Secure/SameSite session cookies, same-origin checks, bounded JSON bodies, safe URL validation, account lockout, required edge login rate limiter, expired-session cleanup on login and session revocation after password changes.
- External CSS compatible with CSP, no-store dashboard/API responses, static asset routing, Worker logs and traces.

## Authentication choices

Cloudflare's deployed Web Crypto currently caps each PBKDF2 call at 100,000 iterations. This release uses PBKDF2-SHA256 at that platform ceiling, a separate per-user random salt, and an HMAC prehash with a secret pepper stored outside D1. The provisioning script and runtime use the same implementation. Temporary staging passwords are randomly generated and must be changed privately after sign-in.

100,000 iterations is below current recommended PBKDF2 password work factors. Before production expansion, review a vetted identity provider or a Worker-compatible stronger KDF with an appropriate paid CPU budget. Keep the edge limiter and pepper regardless. Do not claim this staging authentication has had an independent security audit.

## Verification

`npm run check` includes 15 Node/SQLite-backed Worker checks plus the existing build/content checks for all nine permanent cards. Tests cover authentication, pepper isolation, CSRF, malformed JSON, wrong passwords, admin/tenant boundaries, public/draft separation, unsafe URLs, version conflicts, publish isolation, vCards, audit, history/restore, account resets and session revocation.

`npx wrangler deploy --dry-run --config wrangler.staging.toml` validates the bundle and configured D1/assets/rate-limiter bindings. Live staging checks additionally exercise login, draft privacy, publish, contact downloads, four-card independence and restore. Actual phone contact import/NFC scanning remains a manual acceptance check.

## Staging changes and CI

Apply `0001_card_admin.sql` then `0002_card_history.sql` exactly once to a new dedicated database. Existing staging data already has both migrations. Do not rerun ALTER TABLE migrations against an already migrated database. A future migration runner must record applied migrations before adding further migrations.

The checked-in GitHub staging workflow still requires the repository's `CLOUDFLARE_API_TOKEN` secret for automated deployment. The current deployment was completed through the authorized Cloudflare connection, without creating or exposing an API token. Runtime account credentials and pepper are not stored in GitHub. The workflow must not silently deploy over the production Worker.

## Subsequent phases

- R2 direct uploads are implemented in the separate Phase 2 change; see [upload status and activation](phase-two-media.md). Live activation is blocked until the Cloudflare owner enables R2. Phase 1 media editing continues to accept existing image paths or HTTPS image links.
- Admin card creation/assignment for new companies and tenant-specific themes. Phase 1 manages the four existing Maison cards; creating a company does not create cards automatically.
- Full visual draft preview and server-rendered/social-crawler metadata. Current preview summarizes editable text; the public design stays in the existing card template.
- Account onboarding, recovery and member lifecycle, plus stronger password KDF/managed identity review.
- Operational backup/restore exercise, durable migration ledger, monitoring alerts and production cutover/rollback rehearsal.

Only move to the production Worker after owner acceptance and remaining production gates. No production cutover was performed in this phase.
