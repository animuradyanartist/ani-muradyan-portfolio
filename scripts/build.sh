#!/usr/bin/env bash
# Build the public site into _site/ for Netlify (or any static host).
# Copies the page, the admin, and the shared content modules; bakes the
# current content.json into the marked regions of index.html.
# Excludes .claude/, server.cjs, README.md, scripts/, _site/ itself.
#
# Cache-busting: every reference to assets/<file> in the built HTML/CSS/JS is
# rewritten to assets/<file>?v=<short md5 of the file's bytes>. Because the
# version is derived from content, swapping an image automatically changes its
# URL and busts the browser cache — while unchanged images keep their long
# immutable cache (see netlify.toml). No manual version bumping ever needed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/_site"

rm -rf "$OUT"
mkdir -p "$OUT"

cp "$ROOT/index.html" "$ROOT/styles.css" "$ROOT/script.js" "$OUT/"
# The admin, and the two modules the browser loads: the content shape and the
# renderer that turns content into the page's own markup.
cp "$ROOT/hydrate.js" "$ROOT/content-schema.mjs" "$ROOT/render-content.mjs" "$OUT/"
cp -R "$ROOT/admin" "$OUT/admin"
# Category pages and the gallery-facing /commercial page.
cp -R "$ROOT/figurative" "$ROOT/landscape" "$ROOT/commercial" "$OUT/"
cp -R "$ROOT/assets" "$OUT/assets"

# Fill the <!-- content:* --> regions with the committed content so the
# deployed HTML is complete without JavaScript.
node "$ROOT/scripts/bake-content.mjs" "$OUT"

python3 - "$OUT" <<'PY'
import hashlib, os, re, sys

out = sys.argv[1]
assets_dir = os.path.join(out, "assets")

# short content hash per asset file
ver = {}
for fn in os.listdir(assets_dir):
    p = os.path.join(assets_dir, fn)
    if os.path.isfile(p):
        with open(p, "rb") as fh:
            ver[fn] = hashlib.md5(fh.read()).hexdigest()[:10]

# longest names first so e.g. "room-silent-bliss.jpg" is handled before any prefix
names = sorted(ver, key=len, reverse=True)

def fingerprint(text):
    for fn in names:
        # match assets/<fn> only when not already followed by a query string,
        # and bounded by a real delimiter (quote, paren, whitespace, #)
        pat = re.compile(r'assets/' + re.escape(fn) + r'(?=["\')\s#])')
        text = pat.sub(f'assets/{fn}?v={ver[fn]}', text)
    return text

# every built page and stylesheet/script, so /figurative, /landscape and
# /commercial get the same cache-busted URLs as the home page
targets = []
for dirpath, dirnames, filenames in os.walk(out):
    if os.path.basename(dirpath) == "assets":
        dirnames[:] = []
        continue
    for fn in filenames:
        if fn.endswith((".html", ".css", ".js", ".mjs")):
            targets.append(os.path.relpath(os.path.join(dirpath, fn), out))

for f in sorted(targets):
    fp = os.path.join(out, f)
    with open(fp, "r", encoding="utf-8") as fh:
        src = fh.read()
    new = fingerprint(src)
    if new != src:
        with open(fp, "w", encoding="utf-8") as fh:
            fh.write(new)
        n = len(re.findall(r'\?v=', new))
        print(f"  fingerprinted {n} asset refs in {f}")
PY

echo "Built $(du -sh "$OUT" | cut -f1) → $OUT"
