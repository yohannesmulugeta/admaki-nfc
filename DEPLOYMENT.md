# Production hosting

- Site: `https://nfc.admakidigital.com/`
- Cloudflare Worker: `admaki-nfc`
- Application build: `npm ci && npm run check`
- Static output: `dist/`
- No database, R2 bucket, login, or application secrets are needed.

The initial release is deployed using the connected Cloudflare API. Assets are served directly from Workers Static Assets. `cloudflare/worker.mjs` provides the asset fallback and `cloudflare/deploy-metadata.json` records the non-secret metadata. The `dist/_headers` file must be supplied as the `_headers` asset configuration when using the direct-upload API; do not upload it as an ordinary file.

To update through an agent with Cloudflare connected:

1. Read the latest GitHub main branch and inspect the current Worker configuration.
2. Make changes and run `npm ci && npm run check`.
3. Follow [Cloudflare's static asset direct-upload flow](https://developers.cloudflare.com/workers/static-assets/direct-upload/): register a manifest, upload the requested asset buckets using the scoped short-lived token, and upload `cloudflare/worker.mjs` with the completion token, ASSETS binding, asset configuration, and `_headers` contents. Keep upload tokens in memory; never commit them.
4. Verify the returned deployment, live homepage, scripts, fonts, and enquiry flow. Preserve the custom domain.

The GitHub Actions workflow checks changes; it does not automatically deploy them. No GitHub secret or Cloudflare account token is stored in this repository. A future Git-linked Cloudflare build can be configured separately if wanted.

Rollback is available from the Worker's deployment history in Cloudflare. Customer menu applications and the AdMaki main website are separate deployments and must not be changed when updating this marketing site.
