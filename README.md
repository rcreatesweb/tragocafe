# Trago Cafe

A static Trago Cafe storefront derived from the existing Option A implementation. It uses only HTML, CSS, vanilla JavaScript, JSON-compatible configuration, and local static assets—no build step, framework, backend, or database is required for the public site.

## Run locally

Serve the repository root with any static HTTP server, for example:

```sh
python3 -m http.server 8000 --bind 0.0.0.0
```

Then open `http://localhost:8000/`. The storefront also retains the original `file:` fallback for built-in configuration, although browser features such as clipboard access work best over HTTPS or localhost.

## Main files

- `index.html` — storefront, ordering UI, cart, checkout, order summaries, clipboard handling, and contact handoff.
- `trago-config.js` — menu data, prices, add-ons, theme defaults, content, validation, and configuration persistence.
- `script.js` — original per-product image mappings.
- `admin.html`, `admin.css`, `admin.js` — existing browser-local prototype admin and GitHub publishing tools.
- `assets/` — local Trago photography, font files, font licenses, and product-image destination paths.

## Contact configuration

- Facebook: <https://www.facebook.com/profile.php?id=61594437308252>
- Google Maps: <https://maps.app.goo.gl/CHBrBKNfoLFi73PT9>
- Messenger: intentionally blank until an official Trago Cafe Messenger URL is supplied. The existing Messenger handoff remains supported and reappears when a valid HTTPS Messenger URL is configured in the admin contact settings. The current confirmation flow uses the supplied Facebook page instead.

No store hours have been added. The original manual Closed default remains unchanged.

## Photography and fonts

The decorative café photographs are stored locally and sourced from Unsplash:

- <https://unsplash.com/photos/_tSgUmeYMm8>
- <https://unsplash.com/photos/L-sm1B4L1Ns>
- <https://unsplash.com/photos/7ZkoxdZLrog>

Cormorant Garamond and Manrope are bundled as variable WOFF2 fonts. Their license files are included in `assets/`.
