# Ella's Studio

A private dashboard for running Ella's Nook: a **calendar** with photos, a **blog manager** that publishes to your live site, and an inbox for **visitor feedback**.

It lives in its own `studio/` folder. **None of your existing website files were changed.** It uses your existing look (cream/teal colours, Fraunces + Nunito fonts, your logo from `../assets/logo.jpg`) and the same Supabase project your site already talks to, so there is no new server and no new service to pay for.

```
ellas-nook/
  ellas-nook-supabase.html   <- your site (untouched)
  assets/ docs/ ...          <- untouched
  studio/
    index.html  studio.css  studio.js  config.js    <- the dashboard
    setup.sql                                       <- one-time database setup
    README.md                                       <- this file
```

## One-time setup (about 10 minutes)

Nothing here costs money or redeploys anything by itself.

1. **Database.** In Supabase open **SQL Editor**, paste all of `studio/setup.sql`, click **Run**. It only *adds* things (safe to run twice) and does not touch existing rows. It also copies your current "Pista clan" blog post into the database, so it stays on the site after you publish your first new post.
2. **Your admin login.** Supabase -> **Authentication -> Users -> Add user**. Enter your email and a long, unique password, and tick *Auto Confirm User*. Then switch off public sign-ups: **Authentication -> Sign In / Providers -> turn off "Allow new users to sign up"**.
   - If Supabase answers *"Only @ellanook.org accounts allowed"*, your project still has the old sign-up rule from `docs/supabase_schema_unused.sql`. Use an `@ellanook.org` email for the admin.
3. **Let that login into the Studio.** Back in SQL Editor run this one line (your own email in the quotes):
   ```sql
   insert into public.studio_admins (user_id, email)
   select id, email from auth.users where email = 'YOU@EXAMPLE.COM';
   ```
   Adding another person later is the same line with their email. Removing access: `delete from public.studio_admins where email = '...';`
4. **Publish the Studio when you are ready.** Upload the whole `ellas-nook` folder, including `studio/`, the same way you publish the site (for GitHub Pages it will be at `https://<you>.github.io/<repo>/studio/`). `config.js` already holds your project's URL and public key (copied from your site). *I have not deployed anything.*

## Using it

**Calendar.** Any month, past or future; events are stored permanently. Click a day's number or **+ New event**. Fill in name, times, description, booking note, WhatsApp button on/off and an optional photo (large photos are shrunk automatically; JPG, PNG, WebP, GIF up to 5 MB). Click an event to edit or delete it. *Published* events appear on your site; *Draft* events stay hidden. Replacing or removing a photo deletes the old file.

**Blog.** **+ New post**: title, author, date, featured image, text (blank line = new paragraph; plain text only). The preview mirrors how the site shows it. **Publish** puts it on the live site straight away, **Unpublish** returns it to draft, **Save draft** keeps it private.

**Feedback.** Messages from the form on your site land here (the form on your site already sends them). The tab shows a count of new ones. Mark as reviewed, reply by email, or delete.

## How it is secured

- Sign-in is Supabase email + password. The session lives only in that browser tab, refreshes quietly, ends on **Sign out**, and ends after 30 idle minutes (change `idleMinutes` in `config.js`).
- The real protection is in the database, not the page: row-level security lets visitors read only *published* events/posts and *submit* feedback (never read it); only accounts on the `studio_admins` list can change anything or upload photos. A signed-in account that is not on that list gets nothing.
- Everything shown (including whatever visitors type into feedback) is displayed as plain text, never as code, and the page has a strict content-security policy. The page asks search engines not to index it.
- The key in `config.js` is the same public key your site already exposes; never put a `service_role` key anywhere in these files.
- For extra safety use a unique password. (Two-step login is a Supabase setting; this build does not add it.)

## Things worth knowing about your existing site

I did not change the site, so these come from how it is written today:

1. **The site's calendar only draws October 2026 and matches events by day number only.** A published event in, say, November would overwrite the same day number in October. So the Studio warns, and asks for confirmation, before you publish anything outside October 2026; keep other months as *Draft* for now. Optional fix when you want one (not applied): in `ellas-nook-supabase.html`, change `ev.forEach(r=>{E[+r.event_date.slice(8)]=` to `ev.filter(r=>r.event_date.startsWith('2026-10')).forEach(r=>{E[+r.event_date.slice(8)]=`, then set `siteMonth: null` in `studio/config.js`. Showing other months on the site needs a larger change; ask if you want that.
2. **One event per day** shows on the site (the Studio warns on a clash).
3. **Dates on blog posts** display exactly as saved (`2026-10-11`). Leave the date empty to hide it.
4. The site shows its built-in blog post only while the database has no published posts (handled by step 1 above).
5. `README.md` says the site is `index.html`, but the file is `ellas-nook-supabase.html`. GitHub Pages serves `index.html` at the root address, so check that matches how you publish.

## Cost

Nothing in the Studio adds a paid service. It uses your existing Supabase project and static hosting. Photos are resized to at most 1600 px to keep storage small. Free Supabase projects can be paused after a stretch of inactivity; check your plan if the Studio or site ever stops loading.

## What was tested

Against a real PostgreSQL 16 database running `setup.sql` (fresh, run twice, and on top of your older `supabase_schema_unused.sql`), with a stand-in for Supabase's login and storage services, driven by a real browser:

- **44 database and security checks**: visitors see only published rows, can send but not read feedback, cannot write anything; a signed-in non-admin is blocked everywhere; photo upload rules (admin only, images only, 5 MB limit).
- **79 browser checks**: login errors, non-admin turned away; calendar add/edit/delete/month navigation, validation, photo upload/resize/replace/remove with storage cleanup, warnings; blog draft/publish/edit/unpublish/delete; feedback inbox, filters, paging, script-injection attempt shown harmlessly; phone layout; no console errors.
- **Your real, unmodified site** loaded against that backend showed the calendar event and the blog post published from the Studio, hid them when unpublished, and its feedback form delivered into the inbox.
- **7 session checks**: token refresh, retry after expiry, forced sign-out, idle sign-out, new tab starts signed out.

**Not tested: your actual Supabase project** (I had no access and did not touch it). After setup, do this 5-minute check: sign in; add a *Draft* event with a photo; publish it; confirm it shows on the live site; send a test message from the site's feedback form and see it in the Feedback tab; delete your test items.
