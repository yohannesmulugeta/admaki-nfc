# Release verification — 22 November 2026 (Addis Ababa)

Source: local branch feature/platform-stabilization, merge commit 9c43878a0b947bb5269909fefa5735158258a56a. Latest production GESAGIS design e078a38451d651479b5514d34c56e163efb2f172 is included. GitHub publication is pending explicit authorization following an automatic approval rejection; do not deploy the older main branch over this release.

Cloudflare staging and production deploy the shared Worker, compiled template catalog and shared dashboards. Production uses its own D1 database and private MEDIA/BACKUPS buckets. AUTH_PEPPER and existing user hashes were preserved. No extra client credentials were generated.

Verified:

- 49 automated tests pass, including real Workers runtime D1/R2 uploads, tenant denial, safe rendering, onboarding idempotency, QR decoding, archived history, weak ETag revalidation and legacy contact photo compatibility.
- Build checks pass for all 11 permanent card routes across 6 companies. Every source card QR decodes to its permanent production address.
- Staging HTTP checks passed for the original 10 cards, JPEG contact embedding, ETags, existing admin/client logins, cross-tenant denial and backup downloads.
- Staging live onboarding passed create company/card, idempotent retry, public page/QR without deployment, draft privacy, publish and updated contact. The disposable test records were removed afterwards.
- Browser checks confirm Shasho preview edits render immediately and can be discarded without changing published content; plant fields and images are present. Company onboarding offers only available templates.
- GESAGIS was integrated after the initial checks; it passes the complete automated/build suite and its dynamic public page was checked in staging and production.
- Production Shasho and GESAGIS pages render correctly; Shasho logo, portrait, plant image and QR image load. Production admin sign-in screen loads. A fresh production login was not performed; the original hashes and pepper are preserved and staging logins passed.
- Production D1 contains 6 companies, 11 cards and 2 existing users; foreign_key_check returns no violations.
- The initial production logical backup was created through the authenticated control plane, downloaded privately and restored into an empty isolated database: 51 records and 1 media object, with integrity and foreign-key checks passing. Staging Worker-driven backup and restoration also passed.
- Production scheduled maintenance is registered every minute, with daily logical backup creation and bounded continuation. Its first automatic invocation was not observed during the release check. Production backup objects have 30-day expiration; staging 7 days.

Limits:

- Logical snapshots span their recorded collection window. Exact database point recovery uses D1 Time Travel and requires media reconciliation.
- Local 1,000-company/2,000-card fixtures check query plans and pagination; they do not certify concurrent edge traffic or provide a bill estimate.
- Real iPhone/Android contact-photo persistence still needs device acceptance testing.
- Administrator MFA, external email/SMS alerts and automatic upgrades of existing cards to a new template version are not part of this release. Existing cards remain pinned until an explicit validated migration.
- Keep the private AUTH_PEPPER recovery record separately from D1/R2 backups. It is never committed to Git.

Admin: https://nfc.admakidigital.com/admin/
Client: https://nfc.admakidigital.com/dashboard/

## Source synchronization follow-up

The pull request also incorporates main commit 0667890 (corrected GESAGIS phone/WhatsApp numbers and verified WeChat QR). This is template/schema version 2; version 1 remains available for existing pinned cards. No new deployment or database content migration is performed by this source synchronization. Updating an existing GESAGIS card to version 2 requires its separate validated content/template migration.

## Administrator security follow-up

PR #9 was merged as 23875b2. The follow-up adds administrator TOTP setup, account-bound encrypted secrets, ten single-use recovery codes, password-plus-factor turn-off, code replay protection, and session revocation. Enrollment remains disabled until the administrator completes pairing with their own authenticator.

Validation: 53 tests pass, including RFC 6238 vectors, enrollment expiry, origin and role denial, login/recovery reuse rejection, session revocation, concurrent enrollment/sign-in protection, and real Workers AES-GCM/HMAC-SHA-1/QR behavior. The pre-MFA production backup also restores correctly with the new additive schema. Existing GESAGIS content is upgraded separately with compare-and-swap guards; the old template and published revision remain available.
