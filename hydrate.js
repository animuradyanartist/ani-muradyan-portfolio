/**
 * Keeps the page in step with the admin.
 *
 * The deployed HTML already contains the current artworks and exhibitions
 * (baked in at build time), so the page is complete before any JavaScript
 * runs. This module then asks the API for the live content and re-renders the
 * two data-driven regions only if something actually changed — so a save in
 * the admin is visible immediately, with no rebuild and no flash when nothing
 * has moved.
 *
 * The API response is the PUBLIC view: no prices, no commitments, no notes.
 */
import { REGIONS } from "/render-content.mjs";

/** Find the nodes between <!-- content:name --> and <!-- /content:name -->. */
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

  // Nothing to do when the markup is identical to what was baked in.
  const current = Array.from(range.cloneContents().childNodes)
    .map((node) => (node.nodeType === Node.ELEMENT_NODE ? node.outerHTML : ""))
    .join("");
  const template = document.createElement("div");
  template.innerHTML = html;
  const next = Array.from(template.children)
    .map((node) => node.outerHTML)
    .join("");
  if (current.replace(/\s+/g, " ").trim() === next.replace(/\s+/g, " ").trim()) return null;

  range.deleteContents();
  range.insertNode(range.createContextualFragment(html));
  return true;
}

/** New nodes need their own reveal observer — script.js already ran. */
function revealNewNodes() {
  const targets = document.querySelectorAll(".reveal:not(.in-view), .exh:not(.in-view)");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!("IntersectionObserver" in window) || reduced) {
    targets.forEach((el) => el.classList.add("in-view"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.14, rootMargin: "0px 0px -8% 0px" }
  );
  targets.forEach((el) => observer.observe(el));
}

async function hydrate() {
  let content;
  try {
    const response = await fetch("/api/content", { headers: { accept: "application/json" } });
    if (!response.ok) return;
    content = await response.json();
  } catch {
    return; // the baked-in HTML is already correct; a failed fetch changes nothing
  }

  // A category page states which category it shows on <body data-category>.
  const context = { category: document.body.dataset.category };

  let changed = false;
  for (const [name, render] of Object.entries(REGIONS)) {
    const region = findRegion(name);
    if (!region) continue;
    if (replaceRegion(region, render(content, context))) changed = true;
  }

  if (changed) revealNewNodes();
}

hydrate();
