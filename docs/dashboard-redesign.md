# Professional dashboard redesign

Admin `/admin/` and client `/dashboard/` use a shared Manrope interface, responsive sidebar, focused forms, real card status, search and account settings. Existing public card layouts and permanent NFC/QR destinations remain intact.

## Admin

Overview counts companies, managed cards and saved drafts from D1. Companies support search, card thumbnails and a dedicated client-access tab. Company/account creation and client password resets use dialogs. The card directory searches across company names, labels and URLs, with a published/draft filter. No traffic or engagement numbers are fabricated.

The new authenticated `GET /api/admin/cards` endpoint returns card metadata only and requires platform-admin access. Tenant card lists include a cover thumbnail and retain membership-based scoping, including when another organization query is supplied.

## Client

My Cards shows assigned cards and their state. Profile, Contact, Links, Images and History tabs organise editing. The sticky footer distinguishes unsaved changes, a saved private draft and published content. Publish requires a saved draft. Leaving the editor, discarding, restoring and removing images use explicit dialogs. Mutations retain optimistic version checks, and pending operations prevent navigation and duplicate submissions.

Image uploads retain the existing private R2 pipeline, resizing and quotas; the UI adds preparation/upload indicators, thumbnails and removal controls. Retained-history images remain protected from deletion.

The phone preview uses a generated copy of the actual Maison public template plus the same safe content renderer as the public card. Only same-origin parent messages update the preview. It never fetches drafts through public APIs, stores them in the browser, or publishes implicitly. Preview links are inert. A narrowly scoped `/dashboard/preview/*` header permits same-origin framing; other pages retain frame denial.

## Verification

`npm run check` runs 37 tests, the production build, asset checks and all nine permanent QR/card checks. New DOM workflow tests exercise actual client/admin modules: search, navigation, private preview, validation, draft/publish/restore, confirmation dialogs and session clearing. Worker tests cover metadata authorization and tenant isolation. Existing workerd/D1/R2 runtime and media tests remain enabled.

Deployment targets only the isolated `admaki-nfc-staging` Worker and existing staging D1/R2 bindings, inheriting the authentication pepper. Production rollout remains separate from this review deployment.
