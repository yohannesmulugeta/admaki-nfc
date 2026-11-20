# Username/password rollout checklist

Status: development branch only. DO NOT deploy the current Worker until public rendering, data seeding, authorization, and security tests are completed.

## Client experience
- Username: `maisondebrah`
- Temporary password: generate privately, at least 12 random characters. Never commit to GitHub or share in chat.
- One client account controls four independent card records.
- Change password through the dashboard. Password change revokes active sessions.
- No client email, OTP or SMS required.

## Infrastructure confirmed 2026-11-20
Cloudflare account has an existing `admaki-nfc` Worker. Do not overwrite it without checking script source, routes, custom domain, bindings, and existing traffic. Other D1 databases are used for events, menu, and Maison inquiries; DO NOT reuse them for NFC.

## Work remaining before release
1. Create dedicated staging D1 database, configure bindings, and run migration.
2. Create an offline password-bootstrap script that hashes a randomly generated password with Web Crypto PBKDF2-SHA256 and creates one organization/user/membership. Avoid logging the password.
3. Seed four profiles from the current JSON files into the cards table with unique IDs, preserving slugs.
4. Implement platform-admin credential reset with a separate securely authenticated admin account; audit every reset.
5. Implement public card rendering from published D1 data, including vCard, QR and metadata; do not break existing paths.
6. Add image uploads to R2 with authorization, file signature checks, size limits, safe object keys, and lifecycle cleanup.
7. Add session expiration cleanup and an edge rate limiter (the DB lockout alone does not stop distributed attempts).
8. Fix current editor so all existing profile fields, including contactAddress, are editable safely without permitting slug changes.
9. Confirm Worker route /assets behavior, CSP and deployment settings.
10. Test XSS, CSRF, tenant isolation, brute force, password reset, publish rollback, and NFC scans before deploying.

## Deployment gates
- Do not expose current staging API as production-ready.
- Do not send a temporary password until the client login is actually live.
- Do not merge or deploy until tests pass and the owner approves production release.
