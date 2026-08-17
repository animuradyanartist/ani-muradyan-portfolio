# Ani Muradyan — Artist Portfolio

A standalone, single-page portfolio for contemporary artist **Ani Muradyan**, built from
the Figma design. No build step, no framework, no dependencies — just `index.html`,
`styles.css`, `script.js` and the artwork in `assets/`.

## Sections
- **Hero** — two-tone display name, painterly self-portrait, animated dashed ring + drifting colour fields.
- **Marquee** — scrolling "Portraits · Figures · Landscapes · Abstraction" strip.
- **About me** — studio photo with an offset frame + the artist statement.
- **My art** — five series (Blue Detachment, Observer, Inner Direction, Silent Bliss, Rebirth),
  each shown as the painting beside the painting hung at home, with alternating sand bands.
- **Exhibition Highlights** — two-column dated list (2022–2025).
- **Let's Connect** — email, Instagram, Singulart, website, over a faded artwork backdrop.

## Animations
- Scroll-reveal (IntersectionObserver) with directional slide-ins and staggering.
- Scroll progress bar, sticky condensing nav, gradient-blob + image parallax (single rAF loop).
- Hero portrait pointer-tilt, animated dashed ring, custom blended cursor (`view` on artworks).
- Everything degrades gracefully under `prefers-reduced-motion` and on touch devices.

## Pages

| Path | What it is |
|---|---|
| `/` | The portfolio, unchanged — hero, My art, About, Exhibition Highlights, Let's Connect. Two category cards under the *My art* heading lead into the category pages |
| `/figurative`, `/landscape` | One page per category, listing that category's works in the site's own layout |
| `/commercial` | The gallery-facing portfolio — selected works in the artist's order, practice, exhibitions, markets, contact. Unlisted, `noindex`, shared by direct link |
| `/admin` | The editor (below) |

## Studio admin
`/admin` is a password-protected editor for everything a gallery asks about — it is the one
place artwork information is entered.

| Section | What it holds |
|---|---|
| **Artworks** | Category (Figurative / Landscape), title, year, medium, width/height in cm, main + detail images, availability (available / reserved / sold / not for sale), current location, artist price and optional retail price with a *show price in the commercial portfolio* toggle, exhibition history (one or many records), existing commitments (gallery / collector / platform / reserved / other, with details and an until date), inclusion in the commercial portfolio, featured, order, and private notes |
| **Artist & practice** | Name, location, short bio, artist statement, current practice / recent transition, direction of the next body of work, profile and studio photos |
| **Exhibitions & residencies** | Solo / group / residency, venue, city, country, start and end dates, status (past / confirmed / upcoming) and an external link. Confirmed and upcoming shows are listed separately |
| **Markets & commercial** | Which works go in the gallery-facing portfolio and in what order, markets of interest, priority countries, what you are open to, representation and exclusivity, and private notes |

**Public vs commercial.** `/` and the category pages show only what the site shows today: title,
medium, dimensions, year and the images. Prices, commitments, current location, per-artwork exhibition
history and every note are stripped from the public API by `publicContent()` in
`content-schema.mjs` — they are only reachable through the logged-in admin. `GET /api/commercial`
returns the gallery-facing package (selected works in `commercialOrder`, prices only where the
toggle is on, practice fields, forthcoming shows, markets) — it is what `/commercial` reads, and
it carries no private note of any kind.

**Two orders, deliberately separate.** *Order on the website* (`displayOrder`) sets the running
order in *My art* and on the category pages. The order in the Markets & commercial tab
(`commercialOrder`) sets the sequence a gallery sees. Rearranging one never moves the other.

**How the site stays in step.** `scripts/build.sh` bakes `content.json` into the marked regions
of `index.html`, so the deployed page is complete without JavaScript. `hydrate.js` then refreshes
those regions from `/api/content`, so a save in the admin shows on the site immediately — no
rebuild, no deploy.

## Run locally
```bash
node server.cjs            # → site on http://localhost:4321, admin on /admin
```

The local server runs the *same* API module as the deployed functions, storing content and
uploads in `.data/` (git-ignored) instead of Netlify Blobs. The local admin password is
`local-dev`.

## Deploy
The site builds to `_site` and the admin API runs as a Netlify function.

**Set these environment variables in Netlify** (Site configuration → Environment variables) —
without `ADMIN_PASSWORD` the admin refuses every login:

| Variable | Purpose |
|---|---|
| `ADMIN_PASSWORD` | The password for `/admin` |
| `ADMIN_SECRET` | Any long random string; signs the session cookie |

Then deploy:

```bash
npx netlify-cli deploy --prod
```

Content and uploaded images live in Netlify Blobs, so saving in the admin does not require a
rebuild and never touches the repo. `content.json` in the repo stays the starting point (and the
copy the build bakes in).

## Notes
- **Fonts:** Poppins + Kaushan Script (Google Fonts). The Figma used *Hanson* for the hero
  name (a commercial font); Poppins 800 is used as the substitute. Drop in a licensed Hanson
  webfont and set `--font-display` if you want an exact match.
- **Images** in `assets/` are web-optimized JPEGs (≈1.8 MB total) exported from the Figma file.
  Replace any file in place to swap an artwork — no code change needed.
- `server.cjs` is only a dev convenience and is not needed in production.
- **Content model:** `content-schema.mjs` is the single source of truth for the shape of an
  artwork, an exhibition and the commercial preferences — the admin, the API and the build all
  import it. Adding a private field? Add it to `PRIVATE_ARTWORK_FIELDS` in the same file so it
  stays out of the public site.
