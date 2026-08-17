/**
 * Keeps /commercial in step with the admin.
 *
 * The deployed page already contains the current selection (baked in at build
 * time), so it reads correctly with JavaScript disabled and when shared as a
 * link. This then asks the API for the live package and re-renders the
 * sections that changed — so a save in the admin reaches a gallery who opens
 * the link a minute later, with no rebuild.
 */
import { COMMERCIAL_REGIONS } from "/commercial/commercial-render.mjs";

function findRegion(name) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);
  let start = null;
  while (walker.nextNode()) {
    const value = walker.currentNode.nodeValue.trim();
    if (value === `content:${name}`) start = walker.currentNode;
    else if (value === `/content:${name}` && start) return { start, end: walker.currentNode };
  }
  return null;
}

function replaceRegion(region, html) {
  const range = document.createRange();
  range.setStartAfter(region.start);
  range.setEndBefore(region.end);

  const current = Array.from(range.cloneContents().childNodes)
    .map((node) => (node.nodeType === Node.ELEMENT_NODE ? node.outerHTML : ""))
    .join("");
  const template = document.createElement("div");
  template.innerHTML = html;
  const next = Array.from(template.children)
    .map((node) => node.outerHTML)
    .join("");
  if (current.replace(/\s+/g, " ").trim() === next.replace(/\s+/g, " ").trim()) return;

  range.deleteContents();
  range.insertNode(range.createContextualFragment(html));
}

async function refresh() {
  let portfolio;
  try {
    const response = await fetch("/api/commercial", { headers: { accept: "application/json" } });
    if (!response.ok) return;
    portfolio = await response.json();
  } catch {
    return; // what was baked in is already correct
  }

  for (const [name, render] of Object.entries(COMMERCIAL_REGIONS)) {
    const region = findRegion(name);
    if (region) replaceRegion(region, render(portfolio));
  }
}

refresh();
