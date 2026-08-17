/**
 * Writes the current content into every built page.
 *
 * Each page marks the parts that come from data with
 * `<!-- content:name --> … <!-- /content:name -->`; this fills them in, so the
 * deployed HTML is complete and search engines and the first paint never
 * depend on JavaScript. hydrate.js then refreshes the same regions from the
 * API if the artist has saved something newer in the admin.
 *
 * Usage: node scripts/bake-content.mjs <output-dir>
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REGIONS } from "../render-content.mjs";
import { normaliseContent } from "../content-schema.mjs";
import { commercialPortfolio } from "../content-schema.mjs";
import { COMMERCIAL_REGIONS } from "../commercial/commercial-render.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = process.argv[2] || path.join(ROOT, "_site");

const content = normaliseContent(JSON.parse(await fs.readFile(path.join(ROOT, "content.json"), "utf8")));
const portfolio = commercialPortfolio(content);

/** Every .html file in the build except the admin (which has no content regions). */
async function pages(dir) {
  const found = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name === "admin" || entry.name === "assets") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await pages(full)));
    else if (entry.name.endsWith(".html")) found.push(full);
  }
  return found;
}

for (const file of await pages(out)) {
  let html = await fs.readFile(file, "utf8");
  // A page states its category on <body>, which category regions render from.
  const context = { category: html.match(/<body[^>]*data-category="([^"]+)"/)?.[1] };
  const isCommercial = file.includes(`${path.sep}commercial${path.sep}`);
  const renderers = isCommercial ? COMMERCIAL_REGIONS : REGIONS;
  const data = isCommercial ? portfolio : content;
  const baked = [];

  for (const [name, render] of Object.entries(renderers)) {
    const pattern = new RegExp(`(<!-- content:${name} -->)[\\s\\S]*?(<!-- /content:${name} -->)`);
    if (!pattern.test(html)) continue;
    html = html.replace(pattern, `$1\n${render(data, context)}\n$2`);
    baked.push(name);
  }

  if (baked.length) {
    await fs.writeFile(file, html);
    console.log(`  baked ${path.relative(out, file)}: ${baked.join(", ")}`);
  }
}
