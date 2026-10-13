# Ella's Nook upload checklist

## Keep the hosting roles separate
- GitHub repository: store this project as source code and version history.
- Cloudflare Worker: serve the website, `/studio/dashboard`, `/api/*`, and `/media/*` together.
- Do not enable GitHub Pages as a second live host for this Worker project. GitHub Pages cannot run `src/index.js` or the D1/R2 bindings.

## Repository layout
- `public/`: only public website assets and the Studio frontend.
- `src/index.js`: Cloudflare Worker API and static asset routing.
- `schema.sql`: D1 tables and seed content.
- `wrangler.toml`: Worker, static asset, D1, and R2 bindings.
- `scripts/`: local checks and password utility.

## Before deployment
1. Confirm the Cloudflare R2 bucket `ellas-nook-media` exists.
2. Review `schema.sql`, then initialize the existing D1 database as described in `README-CLOUDFLARE.md`.
3. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` as Worker secrets. Never put admin credentials in Git.
4. Run `npm install`, `npm test`, and `npm run check`.
5. Run `npx wrangler dev` and test homepage, `/studio/dashboard`, login, blog, calendar, feedback and media upload.
6. Deploy only after manual tests pass.

## Current limitation
The static project checks do not establish that every CMS tab is implemented or that remote Cloudflare resources are configured. In particular, verify Gallery, Creative Combos and Past Events CRUD before treating the CMS as production-ready.
