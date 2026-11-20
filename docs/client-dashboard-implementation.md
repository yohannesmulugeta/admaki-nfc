# ADMAKI NFC client dashboard — implementation contract

## Objective
Give Maison Debrah one client login to independently edit and publish four permanent cards:
- `maison-debrah`
- `maison-debrah/02`
- `maison-debrah/03`
- `maison-debrah/04`

Preserve the existing public marketing site and all other issued NFC URLs. This is an implementation specification, **not** a deployed dashboard.

## Hosting and data
Existing site is Vite-generated static HTML. Keep static marketing assets. Introduce a Cloudflare Worker API with D1 storage and R2 image uploads. Verify existing Cloudflare hosting configuration before routing API and card requests. Never expose D1/R2 bindings or credentials to the browser.

## Authentication
Use a verified server-side identity solution for external client logins (e.g. Cloudflare Access email OTP with correctly validated Access JWT and audience). Do not trust client-supplied email or organization ID. Admin privileges must be granted explicitly by the platform owner; deny by default. Authenticate all writes, protect against CSRF if cookie sessions are used, and rate-limit login/API requests. No hardcoded passwords or default credentials.

## Roles
- Platform admin: manage tenants, memberships, card assignments, and all cards.
- Tenant owner/editor: list and update only cards belonging to their organization.
- Never permit client edits to `slug`, `organization_id`, `id`, or published canonical URLs.

## Client UI
At `/dashboard/`: login, card list (four Maison cards), editor tabs (Identity, Contact, Social, Business, Media, Appearance), live preview, Save draft, Publish, Revert draft, QR download, and confirmation/error states. Use mobile-first accessible form controls, input validation, and clear unsaved-change warnings. Show current card version and last updated time.

## API contract
- `GET /api/me` -> verified user, role, tenant
- `GET /api/cards` -> tenant-scoped list
- `GET /api/cards/:id` -> tenant-scoped card and draft
- `PUT /api/cards/:id/draft` -> validate editable allowlist, optimistic concurrency with version
- `POST /api/cards/:id/publish` -> atomically publish draft, increment version, audit
- `POST /api/cards/:id/media` -> authorized signed upload or streamed validated R2 upload, size/type limits
- `GET /api/cards/:id/audit` -> tenant-scoped history
- `GET /api/admin/organizations` -> platform admin only

All API errors must use appropriate HTTP status and safe JSON. Verify tenant membership on *every* request and database mutation. Never interpolate untrusted SQL.

## Public card rendering
Read published content only, never draft. Keep all existing stable routes and canonical URLs. Ensure saved vCards, share metadata and QR codes reflect the selected card; QR destination never changes. If runtime data is unavailable, do not leak drafts or expose admin endpoints. Design must remain compatible with existing Maison branding.

## Migration and testing
1. Inspect deployment and backup existing published JSON.
2. Apply `migrations/0001_card_admin.sql` to a staging D1 database.
3. Seed one Maison organization, four cards, and one owner membership only after verifying the actual user identity.
4. Implement verified authentication and tenant-scoped API.
5. Implement editor and media handling, plus preview and publish.
6. Test changing Card 3 does not change Cards 1, 2, 4.
7. Test that a different tenant cannot read/write Maison records and cannot edit slugs.
8. Test contact imports, image links, canonical URLs and QR scans on iPhone/Android.
9. Deploy staging, perform owner acceptance, then production with rollback plan.

Do not deploy a partially authenticated editor to production. Do not mark work complete until build, integration tests, and live checks pass.
