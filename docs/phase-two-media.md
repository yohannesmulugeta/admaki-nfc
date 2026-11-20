# Phase 2 — direct card image uploads

Implementation date: 20 November 2026.

## Current release status

The upload implementation is complete for review and local testing. Live R2 upload activation is blocked because the connected Cloudflare account has not enabled R2. Its API returns error 10042, “Please enable R2 through the Cloudflare Dashboard.” The existing admin/client dashboard and image-link editing continue to work. Do not describe direct device uploads as live until an R2 bucket is bound and the live acceptance checks pass.

## Client behavior

When media storage is available, each logo, cover, interior, saved-contact photo and gallery image gets a device file picker and preview. JPEG, PNG and WebP files up to 5 MiB are accepted. The browser decodes and resizes the longest side to at most 1600 pixels, exports a new image, and uploads it. Re-encoding removes the original file metadata. The server independently validates size, file signature, type and declared dimensions; client validation is not trusted.

Uploading fills that image's form field. It does not save or publish the profile automatically. The owner saves a private draft, then publishes it. Media stays inaccessible to anonymous visitors until the current published profile references it. The owner and platform admin can preview private images.

The uploaded-image panel lists this card's uploads and allows removal of unused images. It protects images referenced by drafts, current published content and every retained published revision, so rollback keeps working. Images saved in old revisions continue to consume the company quota even if no longer on the current public card.

## Server behavior

- `POST /api/cards/:id/media`: authenticated tenant-scoped raw image upload; returns server-generated ID/path, media type, byte count and dimensions.
- `GET /api/cards/:id/media`: authenticated list plus availability. Returns `enabled:false` when R2 is unbound, allowing the existing editor to operate normally.
- `DELETE /api/cards/:id/media/:mediaId`: authenticated removal only when no draft, published profile or retained revision references the image.
- `GET|HEAD /media/:uuid.:extension`: Worker-controlled delivery. Current published references are public; otherwise the requester must be a member of the image's organization or a platform admin. Unauthorized requests receive 404. Responses use no-store, nosniff, a restrictive CSP and same-origin resource policy.
- Quota reservations count pending uploads. Maximum 100 objects per card and 100 MiB per company. Uploads have a separate limit of 10 per user per minute.
- Object keys use organization/card IDs plus a random UUID, never browser-supplied filenames.
- Draft saves validate uploaded paths against their card, then recheck availability inside the database UPDATE to prevent races with deletion.
- Failed uploads compensate storage/database writes. Failed deletion leaves a retryable tombstone, which cannot be saved as a new image reference.
- Daily bounded cleanup checks at most 25 old unreferenced uploads. Ready uploads expire after seven days; abandoned pending uploads after one day; failed deletions retry after an hour. References are rechecked atomically before deletion. Nothing referenced by a saved revision is deleted.

## R2 activation steps

The Cloudflare owner must complete the R2 subscription setup:

1. Open https://dash.cloudflare.com/ and choose the account used for ADMAKI NFC.
2. Go to **Storage & databases → R2 → Overview**.
3. Complete Cloudflare's activation/checkout flow. Review its billing terms and submit payment details yourself if requested. No payment information belongs in chat or GitHub.
4. Once enabled, create a private bucket named `admaki-nfc-media-staging`, or let the authorized connection create it. Do not enable a public bucket URL or public custom domain.
5. Uncomment the `MEDIA` R2 binding in `wrangler.staging.toml`, retaining the staging Worker name and dedicated NFC D1 binding.
6. Apply `migrations/0003_card_media.sql` once to the dedicated staging database. Do not rerun an already applied migration.
7. Build/check, deploy the staging bundle/assets with the R2 binding and `MEDIA_LIMITER`, and install the configured cleanup cron. Retain the existing `AUTH_PEPPER` secret; do not replace it.
8. Sign in as Maison Debrah, choose a device image, save a draft, verify it stays private, publish, and verify the public card and contact download. Confirm other cards did not change. Restore the prior version after the test and remove the now-unused upload if no retained revision references it.

Activation guide: https://developers.cloudflare.com/r2/get-started/
R2 Workers binding API: https://developers.cloudflare.com/r2/api/workers/workers-api-reference/

## Validation

- Existing authentication/card checks remain required.
- Media API/lifecycle tests cover authorization, CSRF, MIME/signature mismatch, size/dimension limits, supported image types, private/public access, HEAD responses, tenant/card isolation, profile references, publishing, rollback retention, failed writes, retriable deletes, cleanup races, quotas and disabled-storage behavior.
- A separate test runs the actual Worker modules in workerd/Miniflare against local D1 and R2, exercising storage writes, private preview, publish, public delivery and deletion protection.
- `npm run check` runs all tests and the existing nine-card build/QR checks. Tests use local isolated storage and no customer credentials.
- Actual device uploads through the deployed dashboard remain a required live acceptance check after R2 activation. Production launch is a separate release decision.
