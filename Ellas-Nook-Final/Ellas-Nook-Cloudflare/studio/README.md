# Ella’s Studio (Cloudflare edition)

Ella’s Studio is served from the same project as the public website at `/studio/`. It is a separate admin page protected by the Worker login; visitors do not get editing access just because the files are in the same project.

Use the configured admin email and password to sign in. Do not link the dashboard from the public navigation.

The Blog manager edits `blog_posts`. The current “From the Nook ... Little Stories” stories are seeded by `../schema.sql`; run the schema against the project’s D1 database before expecting them to appear in the editor. Published stories appear on the public site; drafts do not.

The CMS requires the Cloudflare Worker, D1 database, and admin secrets to be configured. Opening the public HTML file directly from disk is only a visual preview and cannot save content to D1. See `../README-CLOUDFLARE.md` for setup and deployment steps.
