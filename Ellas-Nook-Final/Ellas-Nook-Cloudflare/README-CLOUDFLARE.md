# Ella's Nook + Ella's Studio — Cloudflare edition

This is a **separate working copy**. The original uploaded ZIP is not modified. Supabase calls were removed from the deployable site and Studio; the backend is a Cloudflare Worker with D1 and R2.

## Features included
- Private single-admin login (no signup route), HttpOnly secure session cookie, 8-hour absolute expiry, server-side password hash check.
- Blog create/edit/draft/publish/unpublish/delete with public website listing.
- Current “From the Nook ... Little Stories” entries are seeded into `blog_posts` by `schema.sql`, so they become editable in Ella’s Studio after database setup. Re-running the SQL does not duplicate them.
- Permanent date-based monthly calendar with previous/next/today navigation, events and optional photos.
- Feedback form on the public site and private Studio inbox with new/reviewed/all filters.
- Image upload validation (JPG/PNG/WebP/GIF, max 5 MB) and R2 storage.
- Feedback rate limit of 5 messages per IP per minute.

## Important status
This project has **not been deployed** and cannot be connected to your Cloudflare account from this workspace. You must create the D1 database and R2 bucket and set the admin secrets. Do not upload this to the client's live domain until the verification checklist passes. Cloudflare free-plan quotas/availability may change; confirm current limits in your account.

## Requirements
Node.js 20+, npm, and Wrangler (`npm install -D wrangler`). Sign in with `npx wrangler login`.

## 1. Create Cloudflare resources
From this project folder run:
```sh
npx wrangler d1 create ellas-nook-db
npx wrangler r2 bucket create ellas-nook-media
```
Copy the returned D1 `database_id` into `wrangler.toml`. Keep the R2 bucket name matching the file.

## 2. Initialize database
```sh
npx wrangler d1 execute ellas-nook-db --remote --file=./schema.sql
```
This creates new tables only; it does not touch Supabase or existing remote databases.

## 3. Set up one admin account
Choose the admin email and a long, unique password (at least 14 characters). Generate a PBKDF2 hash locally; the password itself is not stored in this project:
```sh
node scripts/hash-password.mjs "YOUR-LONG-UNIQUE-PASSWORD"
npx wrangler secret put ADMIN_EMAIL
npx wrangler secret put ADMIN_PASSWORD_HASH
```
Paste the email when prompted for the first secret and the entire `pbkdf2$...` output for the second. Do not commit these secrets or send them in chat.

## 4. Local test
```sh
npm install --save-dev wrangler
npx wrangler dev
```
Wrangler local mode may need a local D1 database binding; follow its prompt and initialize the local DB with `npx wrangler d1 execute ellas-nook-db --local --file=./schema.sql`. Test `/`, `/studio/`, login, draft/publish, calendar navigation and feedback.

## Accessing Ella’s Studio

The CMS is a separate route in the same deployed project, not a public editing panel on the homepage. After deployment, open `https://YOUR-DOMAIN/studio/` (or your deployed Pages/Worker URL followed by `/studio/`) and sign in with the configured admin credentials. Visitors can view the public website but cannot edit content without the admin session. When opening `public/index.html` directly as a local file, the API/database is not running, so saving CMS changes will not work.

## 5. Deploy only when approved
```sh
npx wrangler deploy
```
This deploys the Worker and static assets to the Cloudflare Worker URL. It does **not** automatically change your current custom domain or replace the existing Cloudflare Pages site. Connecting the domain/route is a separate, explicit action.

## Test checklist
1. Public site and Studio load; no Supabase URL/key remains in deployable files.
2. Login with the configured email works; wrong password fails; public signup is unavailable.
3. Signed-out requests to `/api/admin/*` return 401.
4. Draft blog/event is not public; published blog/event is public.
5. Calendar can navigate across months; same day-of-month in different months remains distinct.
6. Public feedback submits and appears in Studio; public visitors cannot read the inbox.
7. Upload image; public image URL works; delete removes object.
8. Mobile layout and browser console are checked.

## Notes / known limitations to resolve before production
- Existing website had only a hardcoded October 2026 calendar. This copy now renders month navigation and loads full-date events from the API. Built-in activity labels remain fallback only when there is no published event for a date.
- Existing static “Past Events” content remains in the website; this first backend version returns an empty list for `/api/public/past-events`, so the hardcoded past-event list is retained. It is not editable in Studio yet.
- Studio is intended to be hosted same-origin with the API, because the login uses secure HttpOnly cookies. Do not host the Studio on a separate unrelated origin without revisiting cookie/security configuration.
- Verify all queries and database statements in a real Cloudflare D1 environment before client handover.
