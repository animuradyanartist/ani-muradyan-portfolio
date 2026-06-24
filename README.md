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

## Run locally
Any static server works. The simplest:

```bash
# option A — the bundled zero-dependency Node server
node server.cjs            # → http://localhost:4321

# option B — Python
python3 -m http.server 4321
```

Or just open `index.html` directly in a browser (fonts load from Google Fonts over the network).

## Deploy
It's fully static — drop the folder on Netlify, Vercel, GitHub Pages, Cloudflare Pages,
or any host. `animuradyan.com` can point straight at it.

## Notes
- **Fonts:** Poppins + Kaushan Script (Google Fonts). The Figma used *Hanson* for the hero
  name (a commercial font); Poppins 800 is used as the substitute. Drop in a licensed Hanson
  webfont and set `--font-display` if you want an exact match.
- **Images** in `assets/` are web-optimized JPEGs (≈1.8 MB total) exported from the Figma file.
  Replace any file in place to swap an artwork — no code change needed.
- `server.cjs` is only a dev convenience and is not needed in production.
