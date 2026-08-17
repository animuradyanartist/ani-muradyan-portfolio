/**
 * Turns content into the exact markup the page already uses.
 *
 * The design is not changing: these functions reproduce the hand-written HTML
 * of the "My art" and "Exhibition Highlights" sections character for character,
 * just filled from data. Used twice — once by the build (so the deployed HTML
 * is complete for search engines and the first paint) and once in the browser
 * (so a save in the admin shows up without a rebuild).
 */
import {
  artworkMeta,
  artworksInCategory,
  assetUrl,
  AVAILABILITY,
  CATEGORIES,
  categoryLabel,
  exhibitionPlace,
  labelOf,
  sortExhibitions,
} from "./content-schema.mjs";

const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const pad = (n) => String(n).padStart(2, "0");

/**
 * The information area under each work: only the sections that hold something.
 * Location appears when the artist published it, exhibition history whenever
 * records exist — never an empty heading.
 */
export function artworkDetailsHtml(artwork) {
  const blocks = [];

  if (artwork.currentLocation) {
    blocks.push(`
          <div class="series__block">
            <p class="series__block-title">Location</p>
            <p class="series__block-line">${esc(artwork.currentLocation)}</p>
          </div>`);
  }

  if (artwork.exhibitionHistory?.length) {
    const entries = sortExhibitions(artwork.exhibitionHistory)
      .map((entry) => {
        const place = exhibitionPlace(entry);
        return `
              <li>
                <span class="series__exh-head">${entry.year ? `${esc(entry.year)} — ` : ""}${esc(entry.name)}</span>
                ${place ? `<span class="series__exh-place">${esc(place)}</span>` : ""}
              </li>`;
      })
      .join("");

    blocks.push(`
          <div class="series__block">
            <p class="series__block-title">Exhibition history</p>
            <ul class="series__exh">${entries}
            </ul>
          </div>`);
  }

  if (!blocks.length) return "";

  return `
        <div class="series__details reveal">${blocks.join("")}
        </div>`;
}

/** The five series blocks: the painting, and the painting at home. */
export function artworksHtml(content) {
  const artworks = [...(content.artworks || [])].sort(
    (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
  );

  return artworks
    .map((artwork, index) => {
      const alt = index % 2 === 1 ? " series--alt" : "";
      const room = artwork.detailImages?.[0];
      const roomBlock = room
        ? `
        <div class="series__media reveal" data-reveal="right">
          <figure class="series__room" data-cursor>
            <img src="${esc(assetUrl(room))}" alt="${esc(artwork.title)} displayed in an interior" loading="lazy" data-parallax data-speed="1.5" />
          </figure>
        </div>`
        : "";

      return `
      <article class="series${alt}" data-index="${pad(index + 1)}">
        <div class="series__media reveal" data-reveal="left">
          <figure class="series__paint" data-cursor>
            <img src="${esc(assetUrl(artwork.mainImage))}" alt="${esc(artwork.title)} — painting by Ani Muradyan" loading="lazy" />
          </figure>
        </div>${roomBlock}
        <div class="series__label">
          <span class="series__no">${pad(index + 1)}</span>
          <div class="series__naming">
            <h3 class="script-heading script-heading--sm reveal">${esc(artwork.title)}</h3>
            <p class="series__meta reveal">${esc(artworkMeta(artwork))}</p>
            <p class="series__offer reveal">
              <span class="status status--${esc(artwork.availability)}">${esc(labelOf(AVAILABILITY, artwork.availability))}</span>
              ${artwork.price ? `<span class="series__price">€${Number(artwork.price).toLocaleString("en-GB")}</span>` : ""}
            </p>
          </div>
        </div>
        ${artworkDetailsHtml(artwork)}
      </article>`;
    })
    .join("\n");
}

const exhibitionYear = (exhibition) => String(exhibition.startDate || "").slice(0, 4);

/** Two balanced columns of dated exhibition entries, oldest first. */
export function exhibitionsHtml(content) {
  const exhibitions = [...(content.exhibitions || [])].sort((a, b) =>
    exhibitionYear(a).localeCompare(exhibitionYear(b))
  );

  const half = Math.ceil(exhibitions.length / 2);
  const columns = [exhibitions.slice(0, half), exhibitions.slice(half)];

  return columns
    .map(
      (column) => `
        <ul class="exh-list">
${column
  .map(
    (exhibition) => `          <li class="exh reveal">
            <span class="exh__year">${esc(exhibitionYear(exhibition))}</span>
            <h3 class="exh__title">${esc(exhibition.name)}</h3>
            <p class="exh__place">${esc(exhibitionPlace(exhibition))}</p>
          </li>`
  )
  .join("\n")}
        </ul>`
    )
    .join("\n");
}

/** The two doors into the work — one card per category, on the home page. */
export function categoriesHtml(content) {
  return CATEGORIES.map((category) => {
    const works = artworksInCategory(content, category.value);
    const cover = works[0]?.mainImage;
    const count = works.length === 1 ? "1 work" : `${works.length} works`;

    return `
        <a class="cat reveal" href="/${category.value}/" data-cursor>
          <span class="cat__media">
            ${cover ? `<img src="${esc(assetUrl(cover))}" alt="" loading="lazy" />` : ""}
          </span>
          <span class="cat__body">
            <span class="cat__label">${esc(category.label)}</span>
            <span class="cat__count">${works.length ? esc(count) : "New works coming"}</span>
          </span>
        </a>`;
  }).join("\n");
}

/** The "Let's Connect" rows — one source, used by the site and /commercial. */
export function contactHtml(content) {
  const c = content.contact || {};
  const rows = [
    c.email && { key: "Email", label: c.email, href: `mailto:${c.email}`, external: false },
    c.instagramUrl && { key: "Instagram", label: c.instagramHandle || c.instagramUrl, href: c.instagramUrl, external: true },
    c.singulartUrl && { key: "Singulart", label: c.singulartLabel || "Singulart", href: c.singulartUrl, external: true },
    c.websiteUrl && { key: "Website", label: c.websiteLabel || c.websiteUrl, href: c.websiteUrl, external: true },
  ].filter(Boolean);

  return rows
    .map(
      (row) => `          <li class="connect__item reveal">
            <span class="connect__k">${esc(row.key)}</span>
            <a href="${esc(row.href)}"${row.external ? ' target="_blank" rel="noopener"' : ""} class="connect__v" data-cursor>${esc(row.label)}</a>
          </li>`
    )
    .join("\n");
}

/** One category's works, in the same layout the home page uses. */
export function categoryWorksHtml(content, page = {}) {
  const works = artworksInCategory(content, page.category);
  if (!works.length) {
    return `
      <p class="cat-empty">New ${esc(categoryLabel(page.category).toLowerCase())} works are on the way — <a href="/#connect">get in touch</a> to hear first.</p>`;
  }
  return artworksHtml({ artworks: works });
}

/**
 * The regions rendered from content. Each takes (content, pageContext) — the
 * category pages pass their category through the context.
 */
export const REGIONS = {
  artworks: artworksHtml,
  "all-works": artworksHtml,
  exhibitions: exhibitionsHtml,
  categories: categoriesHtml,
  contact: contactHtml,
  "category-works": categoryWorksHtml,
};
