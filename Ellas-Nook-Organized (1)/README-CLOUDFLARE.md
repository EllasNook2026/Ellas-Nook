# Ella’s Nook + Ella’s Studio — Cloudflare deployment

The deployable website and Studio have one source of truth under `public/`; the API is `src/index.js`. Do not deploy this project through GitHub Pages. GitHub is the source-code repository; Cloudflare Worker serves the website, Studio and API together on one origin.

## Cloudflare resources
- Existing D1 database: `ellas-nook-db` (`9fb6c77c-93c1-4380-b663-6a5c1f91dd11`).
- R2 bucket expected by config: `ellas-nook-media`. Create it in Cloudflare if it does not exist.
- Worker config: `wrangler.toml`.

## Before deployment
1. Install Node.js 20+ and run `npm install`.
2. Authenticate with `npx wrangler login`.
3. Check that the configured R2 bucket exists.
4. Initialize D1 with `npx wrangler d1 execute ellas-nook-db --remote --file=./schema.sql` (review the SQL first; it creates tables and seeds initial content).
5. Create a strong admin password, then run `node scripts/hash-password.mjs "YOUR-LONG-UNIQUE-PASSWORD"`. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` with `npx wrangler secret put`. Never commit these values.
6. Run `npm test` and `npm run check` before deploying.
7. Run `npx wrangler dev` and manually verify homepage, `/studio/dashboard`, sign-in, public events/blog, feedback submission and media upload.

## Deploy only when approved
Run `npx wrangler deploy` from this project folder only after the local and Cloudflare-resource checks pass. This does not change GitHub or a custom domain by itself. Do not connect a production domain until the manual checklist passes.

## Important verification status
This package preparation is not a live deployment. Static checks do not prove that the remote D1 schema, R2 bucket, secrets, login, publishing, and all CMS flows work in your Cloudflare account. Complete the manual checks above before relying on the CMS in production.
