# Finikera Grips — Deployment, configuration & rollback

## Architecture
- Static site with no build step, served from the repo root: `index.html`, `shop.html`, `custom-cases.html`, `gallery.html`, `about.html`, `faq.html`, `contact.html`, `checkout.html`, `order.html`, `admin/`.
- Data: `data/products.json` (the 55 products extracted from the old page), `data/case-options.json` (studio options and pricing), `data/gallery.json`.
- API: one Netlify Function, `netlify/functions/api.mjs`, routed at `/api/*`. It stores orders, private customer uploads, product media and the admin-edited catalog/options in Netlify Blobs.
- Shared validation and pricing: `js/lib/case-config.mjs`, used by both the browser and the server.
- On GitHub Pages (no API) the site still works. The catalog loads from the JSON files, and orders fall back to an Instagram DM hand-off with a reference number and summary.

## Local preview
    npm install
    ADMIN_TOKEN=$(openssl rand -hex 24) npm run dev     # http://localhost:8888 , admin at /admin/
    npm test                                             # API tests

## Safe rollout (don't overwrite production first)
1. The work is on branch `redesign-v2`. `main` (the live GitHub Pages site) is untouched.
2. In Netlify, either enable **branch deploys** for `redesign-v2`, or create a new site from this repo with `redesign-v2` as its production branch. Netlify reads `netlify.toml`.
3. Set these environment variables:
   - `ADMIN_TOKEN` (required): at least 24 random characters (`openssl rand -hex 24`).
   - Optional e-mail notifications: `RESEND_API_KEY`, `NOTIFY_EMAIL`, `FROM_EMAIL`.
4. On the preview URL, test the shop, a studio submission, checkout and `/admin/`.
5. Go live: merge into `main` and point the domain at Netlify (GitHub Pages can't run the API). If the domain changes, update `canonical`, `og:url` and `sitemap.xml`.

## Rollback
- Netlify: Deploys → choose the previous deploy → **Publish deploy**.
- Git: run `git revert <merge-commit>` on `main`.
- Rolling back doesn't touch the data in Blobs. Deleting the `config` blobs makes the site use the repo JSON files again.

## Admin (`/admin/`, log in with ADMIN_TOKEN)
- **Orders:** status, quoted price, tracking number, notes, customer images, CSV export.
- **Products:** edit, add, delete, price, stock, variants, images (including upload), visibility.
- **Studio & pricing:** per-option price, quote-only flag, availability, and an advanced JSON editor.

## Security
- Every field is validated on the server, and prices are recalculated there.
- Uploads: at most 3 images of 1.8 MB each. They are re-encoded in the browser, which strips EXIF/GPS data, and the server checks their file signatures.
- Customer uploads are private. The admin token is compared in constant time.
- Spam is filtered with a honeypot field.
- The CSV export neutralises spreadsheet formulas.
- `netlify.toml` sets a CSP and other security headers, and blocks the HEIC originals.
- Gaps: there's no rate limiting, and all admins share a single token.
