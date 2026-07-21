# Store assets

This directory contains everything needed to submit Api Inspector to the Chrome Web Store and Mozilla Add-ons (AMO).

- `description.md` — short + long description, category, permissions justifications
- `screenshots/` — captured PNG screenshots (1280×800) used in the store listing
- `tile.png` — promotional tile (440×280) for the store listing

## Capturing screenshots

Until the screenshots are captured, this directory only contains the description. To capture them:

1. Load the unpacked extension into Chrome.
2. Browse a site with interesting traffic (e.g. a search-as-you-type UI, a SPA, your own dev environment).
3. Open the popup and arrange these views:
   - **Popup list view** — full filter row + a few captured requests of different types/statuses
   - **Detail view** — request and response both populated (a successful POST is ideal)
   - **Language dropdown** — open the `<select>` to show all 7 generators
   - **Redaction badge** — toggle "🔒 Redact" on and generate a snippet from a request with an `Authorization` header
   - **Options page** — open `chrome://extensions` → extension details → Extension options
4. Screenshot each at 1280×800 (or 640×400). PNG only.
5. Name them `01-list.png`, `02-detail.png`, `03-codegen.png`, `04-redact.png`, `05-options.png`.
6. For the store tile, crop a clean detail view to 440×280.

These are intentionally NOT checked in until first capture — keeps the repo lean.

## Privacy policy URL (for store submission)

Once the GitHub Pages site is live (or just point at the raw file):

    https://github.com/Aniket-bansal/Api-Inspector/blob/main/PRIVACY.md

## Submission checklist

- [ ] Bump `manifest.json` version (semver: MAJOR.MINOR.PATCH)
- [ ] Run `npm run lint && npm test` — both green
- [ ] Run `scripts/package.sh` — produces `dist/api-inspector-vX.Y.Z.zip`
- [ ] (Optional) `web-ext lint dist/` — passes
- [ ] Upload the ZIP at <https://chrome.google.com/webstore/devconsole> and <https://addons.mozilla.org/developers/>
- [ ] Paste description from `store/description.md`
- [ ] Upload screenshots and tile
- [ ] Submit for review
