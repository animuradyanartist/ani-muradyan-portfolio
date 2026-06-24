#!/usr/bin/env bash
# Tiny build: assemble the public files into _site/ for Netlify (or any static host).
# Excludes .claude/, server.cjs, README.md, scripts/, _site/ itself.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/_site"

rm -rf "$OUT"
mkdir -p "$OUT"

cp "$ROOT/index.html" "$ROOT/styles.css" "$ROOT/script.js" "$OUT/"
cp -R "$ROOT/assets" "$OUT/assets"

echo "Built $(du -sh "$OUT" | cut -f1) → $OUT"
