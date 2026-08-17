/**
 * The gallery-facing portfolio, rendered from the commercial package.
 *
 * Every section returns its own <section> — or an empty string when there is
 * nothing to say, so the page never shows a hollow heading. Used by the build
 * (baked into commercial/index.html) and by commercial.js in the browser, so a
 * save in the admin is reflected without a rebuild.
 *
 * What it may show is decided upstream in content-schema.mjs: prices only
 * where the artist switched them on, and never any private note.
 */
import { assetUrl, AVAILABILITY, COMMITMENT_TYPES, INTERESTS, MARKETS, labelOf } from "../content-schema.mjs";

const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const has = (value) => typeof value === "string" && value.trim().length > 0;

const price = (amount) => `€${Number(amount).toLocaleString("en-GB")}`;

/** "12 April 2026" from an ISO date; anything else is passed through as written. */
function readableDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return value || "";
  const date = new Date(`${value}T00:00:00Z`);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/* ------------------------------------------------------------------ intro */

export function introHtml(portfolio) {
  const { artist } = portfolio;
  const year = new Date().getFullYear();

  return `
      <p class="c-eyebrow">Selected Available Works · ${year}</p>
      <h1 class="c-title">${esc(artist.name || "Ani Muradyan")}</h1>
      <p class="c-role">Contemporary Artist${artist.location ? ` · ${esc(artist.location)}` : ""}</p>
      ${has(artist.shortBio) ? `<p class="c-lede">${esc(artist.shortBio)}</p>` : ""}`;
}

/* ------------------------------------------------------------------ works */

function workHtml(work, index) {
  const facts = [work.medium, work.dimensions].filter(has).join(" · ");
  const status = work.availability !== "available" ? labelOf(AVAILABILITY, work.availability) : "";

  const notes = [];
  if (work.exhibitionHistory?.length) {
    notes.push({
      key: "Exhibited",
      value: work.exhibitionHistory
        .map((entry) => {
          const place = [entry.venue, entry.city, entry.country].filter(has).join(", ");
          return [entry.name, place].filter(has).join(" · ") + (entry.year ? ` (${esc(entry.year)})` : "");
        })
        .join("<br />"),
    });
  }
  if (work.commitment) {
    const parts = [labelOf(COMMITMENT_TYPES, work.commitment.type), work.commitment.details]
      .filter(has)
      .join(" — ");
    const until = has(work.commitment.until) ? ` · until ${readableDate(work.commitment.until)}` : "";
    notes.push({ key: "Commitment", value: `${parts}${until}` });
  }

  const details = work.detailImages?.length
    ? `
        <div class="work__details">
          ${work.detailImages
            .slice(0, 2)
            .map((src) => `<img src="${esc(assetUrl(src))}" alt="${esc(work.title)}, detail" loading="lazy" />`)
            .join("\n          ")}
        </div>`
    : "";

  return `
      <article class="work">
        <figure class="work__frame">
          <img src="${esc(assetUrl(work.mainImage))}" alt="${esc(work.title)} — painting by Ani Muradyan" loading="${index === 0 ? "eager" : "lazy"}" />
        </figure>${details}
        <div class="work__meta">
          <h3 class="work__title">${esc(work.title)}<span class="work__year">${esc(work.year)}</span></h3>
          <div class="work__facts">
            ${facts ? `<p>${esc(facts)}</p>` : ""}
            ${has(work.currentLocation) ? `<p class="work__where">${esc(work.currentLocation)}</p>` : ""}
          </div>
          <div class="work__price">
            ${work.pricing?.artistPrice ? `<p>${price(work.pricing.artistPrice)}</p>` : ""}
            ${status ? `<p class="work__status">${esc(status)}</p>` : ""}
          </div>
        </div>
        ${
          notes.length
            ? `<dl class="work__notes">
          ${notes
            .map((note) => `<dt>${esc(note.key)}</dt><dd>${note.value}</dd>`)
            .join("\n          ")}
        </dl>`
            : ""
        }
      </article>`;
}

export function worksHtml(portfolio) {
  const works = portfolio.works || [];
  if (!works.length) return "";

  return `
    <section class="c-section c-works" id="works">
      <h2 class="c-heading">Selected Available Works</h2>
      ${works.map(workHtml).join("\n")}
    </section>`;
}

/* --------------------------------------------------------------- practice */

export function practiceHtml(portfolio) {
  const { currentPractice, nextBodyOfWork } = portfolio.artist;
  if (!has(currentPractice) && !has(nextBodyOfWork)) return "";

  const paragraphs = (text) =>
    String(text)
      .split(/\n{2,}/)
      .map((block) => `<p>${esc(block.trim())}</p>`)
      .join("\n          ");

  return `
    <section class="c-section c-practice" id="practice">
      <h2 class="c-heading">Practice in Transition</h2>
      <div class="c-prose">
        ${has(currentPractice) ? paragraphs(currentPractice) : ""}
        ${
          has(nextBodyOfWork)
            ? `<p class="c-prose__lead">The next body of work</p>
          ${paragraphs(nextBodyOfWork)}`
            : ""
        }
      </div>
    </section>`;
}

/* ------------------------------------------------------------ exhibitions */

function exhibitionLine(exhibition) {
  const place = [exhibition.venue, exhibition.city, exhibition.country].filter(has).join(", ");
  const dates = [exhibition.startDate, exhibition.endDate].filter(has).join(" – ");
  const type = exhibition.type === "residency" ? "Residency" : exhibition.type === "solo" ? "Solo" : "";

  return `
          <li>
            <span class="exh-year">${esc(dates)}</span>
            <span class="exh-body">
              <span class="exh-name">${esc(exhibition.name)}${type ? ` <em>${esc(type)}</em>` : ""}</span>
              ${place ? `<span class="exh-place">${esc(place)}</span>` : ""}
            </span>
          </li>`;
}

export function exhibitionsHtml(portfolio) {
  const forthcoming = portfolio.exhibitions?.forthcoming || [];
  const past = portfolio.exhibitions?.past || [];
  if (!forthcoming.length && !past.length) return "";

  return `
    <section class="c-section c-exhibitions" id="exhibitions">
      <h2 class="c-heading">Exhibitions &amp; Residencies</h2>
      ${
        forthcoming.length
          ? `<div class="c-block">
        <p class="c-subheading">Confirmed &amp; upcoming</p>
        <ul class="exh-list">${forthcoming.map(exhibitionLine).join("")}
        </ul>
      </div>`
          : ""
      }
      ${
        past.length
          ? `<div class="c-block">
        <p class="c-subheading">Selected exhibitions</p>
        <ul class="exh-list exh-list--quiet">${past.map(exhibitionLine).join("")}
        </ul>
      </div>`
          : ""
      }
    </section>`;
}

/* ---------------------------------------------------------------- markets */

export function marketsHtml(portfolio) {
  const p = portfolio.preferences || {};
  const markets = (p.markets || []).map((value) => labelOf(MARKETS, value)).filter(Boolean);
  const interests = (p.interestedIn || []).map((value) => labelOf(INTERESTS, value)).filter(Boolean);
  if (!markets.length && !interests.length && !has(p.priorityCountries)) return "";

  const row = (label, value) =>
    value ? `<div class="focus__row"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>` : "";

  return `
    <section class="c-section c-focus" id="focus">
      <h2 class="c-heading">Professional Focus</h2>
      <dl class="focus">
        ${row("Markets", markets.join(" · "))}
        ${row("Priority countries", p.priorityCountries)}
        ${row("Open to", interests.join(" · "))}
      </dl>
    </section>`;
}

/* ---------------------------------------------------------------- contact */

export function contactHtml(portfolio) {
  const c = portfolio.contact || {};
  const rows = [
    c.email && { key: "Email", label: c.email, href: `mailto:${c.email}` },
    c.instagramUrl && { key: "Instagram", label: c.instagramHandle || c.instagramUrl, href: c.instagramUrl, external: true },
    c.singulartUrl && { key: "Singulart", label: c.singulartLabel || "Singulart", href: c.singulartUrl, external: true },
    c.websiteUrl && { key: "Website", label: c.websiteLabel || c.websiteUrl, href: c.websiteUrl, external: true },
  ].filter(Boolean);
  if (!rows.length) return "";

  return `
    <section class="c-section c-contact" id="contact">
      <h2 class="c-heading">Contact</h2>
      <ul class="contact-list">
        ${rows
          .map(
            (row) => `<li>
          <span class="contact-key">${esc(row.key)}</span>
          <a href="${esc(row.href)}"${row.external ? ' target="_blank" rel="noopener"' : ""}>${esc(row.label)}</a>
        </li>`
          )
          .join("\n        ")}
      </ul>
    </section>`;
}

export const COMMERCIAL_REGIONS = {
  intro: introHtml,
  works: worksHtml,
  practice: practiceHtml,
  exhibitions: exhibitionsHtml,
  markets: marketsHtml,
  contact: contactHtml,
};
