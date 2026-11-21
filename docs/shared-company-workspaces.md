# Shared workspaces for every ADMAKI company

The professional dashboard is the standard for every current and future company. Company identity is configuration, never a fork of the dashboard. The admin sees all companies; client sessions remain scoped to their membership.

## Current registry

| Company | Cards | Public layout |
| --- | ---: | --- |
| Maison Debrah Ethiopia | 4 | Maison |
| Universal Electronics | 2 | Universal |
| KKGT Coffee | 2 | KKGT |
| ADMAKI Digital | 1 | ADMAKI |
| Shasho Kelbesa Import Export | 1 | Shasho |

`companies/registry.json` maps companies to permanent card slugs. Existing public designs are kept. All five layouts use the same client editor, private image uploads, draft/publish state, history, permissions and account settings. The preview selects the actual public template for the card being edited. No Maison branding is used as another company's fallback.

Company branding (name, logo and dark accent colour) is stored in D1 and managed under **Companies → Company branding**. New companies default to the standard ADMAKI blue workspace. The API validates colour contrast for readable white button text. Client access remains managed explicitly under **Client access**; onboarding content never creates credentials or changes memberships.

## Add a company when requested

1. Obtain verified name, logo, card identity/contact details and requested number of cards. Reuse supplied business links. Do not invent facts or passwords.
2. Add one registry entry with a unique company ID, logo path, dark `#rrggbb` accent and permanent slugs. Add profile JSON for each card. New companies use `theme: "business"` by default; custom public card design does not change the dashboard.
3. Run `npm run check`. The build generates public business cards, contact downloads, permanent QR codes and matching previews through the same pipeline.
4. Run `node scripts/provision-companies.mjs > .local/company-provision.json`. This produces parameterized, insert-only D1 statements. Check for existing ownership of every slug before importing. Existing cards, drafts, versions and credentials must not be replaced.
5. Apply missing migrations, import the statements into staging, deploy the shared application and verify tenant isolation and the company's public URLs.
6. Create the client account through admin Client access when the owner specifies the intended access. Share a unique temporary password privately. Never reuse another company's account.

The admin's Add company action also creates a workspace using this design automatically. It can exist with zero cards while content is being prepared. Company branding and client-account forms are part of the shared application.

## Security and migration

Migration `0004_company_branding.sql` adds two organization columns with safe defaults. Public card APIs and contact downloads resolve exact registered database slugs, rather than a Maison-only hardcoded list. They return published data only. Clients cannot select another tenant by supplying its organization query. Existing permanent NFC URLs and QR destinations stay unchanged.

The registry importer uses `ON CONFLICT DO NOTHING` for card content. Existing Maison cards and their version/draft state are preserved. Seed revisions are inserted only when a card has no history. Company logos are initially populated only when branding is empty. No user accounts, sessions or password records are touched.

Tests cover all current normalized layouts, a completely new business-company build/preview pipeline, repeatable onboarding with existing drafts, branding reset between tenants, admin-only settings, public draft isolation and tenant-safe publishing/vCards. Existing upload and version-conflict tests remain enabled.
