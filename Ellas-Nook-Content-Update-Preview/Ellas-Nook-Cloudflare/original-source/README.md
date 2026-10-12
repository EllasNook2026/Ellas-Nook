# Ella's Nook website

Static website (plain HTML/CSS/JS, no build step). Everything lives in `index.html`; photos, logo and hero video are in `assets/`.

## Run locally
Open `index.html` in a browser.

## Publish with GitHub Pages
1. Create a new GitHub repository and upload all files in this folder (keep the `assets` folder).
2. Repository **Settings -> Pages -> Build and deployment**: Source = *Deploy from a branch*, Branch = `main`, folder = `/ (root)`.
3. After a minute the site is live at `https://<username>.github.io/<repo>/`.

Vercel and Netlify also work: import the repo, no build command, output directory `.`.

## Editing content (all inside `index.html`)
- **October calendar activities:** the `N` array in the script.
- **Past events:** the `PAST` array.
- **Blog posts:** the `BL` array (add `by`, `d` for author/date, `i` for an image path).
- **Founder text:** the `FQ` constant.
- **Gallery photos:** put files in `assets/gallery/` and list them in the `IM` array. Matching-game pairs are the `PR` array (photo numbers, 1-based).
- **WhatsApp number:** search for `919345033174`.

## Backend
Not used. `docs/supabase_schema_unused.sql` is an optional database design kept for later; the page works fully without it (`CFG` at the top of the script stays empty).
