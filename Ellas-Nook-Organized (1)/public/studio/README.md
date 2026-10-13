# Ella’s Studio

This is the private admin interface for the Cloudflare-hosted Ella’s Nook website. It is served at `/studio/dashboard` by the same Cloudflare Worker as the public site.

- Sign-in is handled by the Worker using the `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` secrets. There is no public registration.
- Studio requests use the same-origin `/api` endpoints. Do not host this folder separately on GitHub Pages; GitHub Pages does not run the Worker API.
- Uploads are stored in the configured Cloudflare R2 bucket. Website content is stored in Cloudflare D1.
- Database setup is in the project-root `schema.sql`; run it against the configured D1 database, not Supabase.
- Deployment and verification instructions are in `README-CLOUDFLARE.md`.
