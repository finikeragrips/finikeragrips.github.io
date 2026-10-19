# Audit, changes & what's still needed

## Audit (before)
- The old site was one static Spanish page on GitHub Pages, plus a local Netlify link.
- 55 products were hard-coded as HTML. There were no prices, no stock tracking and no cart. Customers ordered by Instagram DM, and payment (Zelle / Apple Pay) was handled manually.
- Bugs:
  - `app.js` used an undefined `heroImg`, so the hero canvas never drew.
  - Several files were unused (`scroll-cinematic.js`, `jszip.min.js`, `index2.html`, `styles2 (1).css`).
  - About 35 MB of HEIC original photos were publicly served.

## Sitemap (after)
Home · Shop (filters, search, sort, product dialog, links of the form `?p=<id>`) · Custom Cases studio · Gallery · About · FAQ/Shipping/Policies · Contact · Checkout → Confirmation · Admin.

## Files
- **Added:** the new pages, `admin/`, `css/`, `js/`, `data/`, `netlify/functions/`, `netlify.toml`, `package.json`, `scripts/dev-server.mjs`, `tests/`, `robots.txt`, `sitemap.xml`, `docs/`.
- **Replaced:** `index.html`.
- **Removed:** `app.js`, `styles.css`, `scroll-cinematic.js`, `jszip.min.js`, `index2.html`, `styles2 (1).css`. The local Netlify CLI state in `.netlify/` is no longer tracked.
- **Kept:** `assets/`, the HEIC originals and `Launch Demo.command`.

## Still required from the owner
- Product prices and stock. All are currently empty, so every product shows "Precio a consultar".
- Studio pricing: a base price for each case model and the option add-ons.
- Confirm the options marked `verify` in `data/case-options.json`. They aren't in the existing photos: silver hardware, black/navy/emerald linings, the alternative foam layouts, the medallion emblem and the Beretta 92 case.
- Shipping rates, deposit terms and the returns policy (marked TODO in `faq.html`).
- A public contact e-mail (`CONTACT_EMAIL` in `js/site.js`).
- Optionally, Resend credentials for e-mail notifications.
- `ADMIN_TOKEN` and the final domain.
- The real lid emblem as an SVG. The preview currently uses a generic horse glyph.

## Compliance flags (manual verification needed)
- **Payments:** Stripe, PayPal, Square and Shopify Payments restrict or review firearm-related merchants, and they may include grips and cases. Using personal Zelle or Apple Cash accounts for business sales may break those services' terms. No card processing was added.
- **Trademarks:** the Colt horse, Browning and Beretta names and logos appear on products. Saying a product fits a model is generally fine, but selling the logos may need a licence.
- **Shipping:** check carrier rules and state and local laws.
- **Privacy:** customer data is now stored. Publish a privacy contact and periodically delete old orders and uploads.
- The studio only customises decorative cases. It can't be used to design functional firearm parts.
