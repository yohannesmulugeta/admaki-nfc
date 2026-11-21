# ADMAKI digital card workspace

All current and future companies use the same professional admin and client dashboard implemented in `public/manager`, `public/admin`, and `public/dashboard`. Do not make a separate dashboard for a new company. Company branding is data: name, logo and accessible accent colour. Keep company data, memberships, cards and uploads isolated.

When the owner asks to add a company:

1. Add the verified company and its permanent card slugs to `companies/registry.json`. Do not invent company details or client credentials.
2. Add a profile under `profiles/`. New companies use the `business` theme unless a custom public card design is requested. The shared dashboard is the default in either case. Existing custom public layouts must be preserved.
3. Use `npm run check` and `node scripts/generate-workspaces.mjs` to verify the template, preview and onboarding manifest. Use `node scripts/provision-companies.mjs` to prepare insert-only D1 statements. Never overwrite existing published content, drafts, versions, accounts or memberships during onboarding.
4. Apply missing migrations to staging, then register the company and cards through the prepared parameterized statements. Do not create or expose passwords automatically. The admin can create the client account in Client access using a private, unique password.
5. Deploy and test the existing shared dashboard, including tenant isolation, preview, draft/publish, images and saved contact. Public card links and issued QR/NFC destinations must remain permanent.

Staging review and production rollout are separate. Do not overwrite production during a staging task. Read `docs/shared-company-workspaces.md` for the supported onboarding flow.

Runtime onboarding is supported through Admin → Companies → Add company → Add digital card → Client access. Read docs/platform-stabilization.md before changing templates or deployment bindings. Every company uses the same dashboards. Add custom layouts as versioned template modules; preserve templates/releases and pinned card/history versions. Do not seed over existing D1 content.
