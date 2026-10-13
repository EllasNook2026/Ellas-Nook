# Ella’s Nook — Cloudflare project

This repository is the source code for Ella’s Nook and Ella’s Studio. **Cloudflare is the runtime host** for the public site, private Studio, Worker API, D1 database and R2 media.

## One source of truth
- `public/index.html` — public website entry point.
- `public/studio/` — admin interface, served at `/studio/dashboard`.
- `src/index.js` — Cloudflare Worker API.
- `schema.sql` — D1 database schema and initial story/past-event content.
- `wrangler.toml` — Worker, D1 and R2 bindings.

Do not enable GitHub Pages as a second live host for this project. GitHub Pages serves static files only and cannot execute the Worker API; it will not make the CMS functional. Keep GitHub as the code repository and use the Cloudflare Worker URL for the live website. Cloudflare setup and deployment instructions are in `README-CLOUDFLARE.md`.

Nothing has been deployed or pushed by this preparation step.
