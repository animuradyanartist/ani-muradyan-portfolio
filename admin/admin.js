/**
 * Studio admin — one page, four sections, no framework.
 *
 * It edits a single content object (the same shape the site and the commercial
 * portfolio read) and saves the whole thing with one PUT. Field vocabulary and
 * blank records come from /content-schema.mjs so the admin, the API and the
 * site can never disagree about what an artwork is.
 */
import {
  AVAILABILITY,
  CATEGORIES,
  COMMITMENT_TYPES,
  EXHIBITION_TYPES,
  EXHIBITION_STATUS,
  MARKETS,
  INTERESTS,
  EXCLUSIVITY,
  COMMERCIAL_TARGET_MIN,
  COMMERCIAL_TARGET_MAX,
  emptyArtwork,
  emptyExhibition,
  emptyExhibitionRecord,
  makeId,
  labelOf,
  isForthcoming,
} from "/content-schema.mjs";

/* ------------------------------------------------------------------ state */

const state = {
  content: null,
  tab: "artworks",
  artworkIndex: 0,
  dirty: false,
};

const $ = (selector) => document.querySelector(selector);
const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function toast(message, isError = false) {
  const el = $("#toast");
  el.textContent = message;
  el.className = isError ? "toast toast--error" : "toast";
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.hidden = true), 2600);
}

function markDirty(dirty = true) {
  state.dirty = dirty;
  const el = $("#save-state");
  el.textContent = dirty ? "Unsaved changes" : "Saved";
  el.classList.toggle("is-dirty", dirty);
}

/* -------------------------------------------------------------- path bind */

const getPath = (object, path) =>
  path.split(".").reduce((node, key) => (node == null ? undefined : node[key]), object);

function setPath(object, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((node, key) => (node[key] ??= {}), object);
  target[last] = value;
}

/* -------------------------------------------------------------------- api */

async function api(method, url, body, options = {}) {
  const init = { method, headers: {} };
  if (body !== undefined) {
    if (options.raw) {
      init.body = body;
      init.headers["content-type"] = options.contentType || "application/octet-stream";
    } else {
      init.body = JSON.stringify(body);
      init.headers["content-type"] = "application/json";
    }
  }
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `Request failed (${response.status})`);
  return payload;
}

/* ------------------------------------------------------------ option html */

const options = (list, selected) =>
  list.map((o) => `<option value="${o.value}"${o.value === selected ? " selected" : ""}>${esc(o.label)}</option>`).join("");

const field = (label, path, value, { type = "text", hint = "", placeholder = "" } = {}) => `
  <label class="field">
    <span class="field__label">${esc(label)}</span>
    <input type="${type}" data-path="${path}" value="${esc(value ?? "")}" placeholder="${esc(placeholder)}" />
    ${hint ? `<span class="field__hint">${esc(hint)}</span>` : ""}
  </label>`;

const textarea = (label, path, value, { rows = 4, hint = "", placeholder = "" } = {}) => `
  <label class="field">
    <span class="field__label">${esc(label)}</span>
    <textarea data-path="${path}" rows="${rows}" placeholder="${esc(placeholder)}">${esc(value ?? "")}</textarea>
    ${hint ? `<span class="field__hint">${esc(hint)}</span>` : ""}
  </label>`;

const select = (label, path, value, list, hint = "") => `
  <label class="field">
    <span class="field__label">${esc(label)}</span>
    <select data-path="${path}">${options(list, value)}</select>
    ${hint ? `<span class="field__hint">${esc(hint)}</span>` : ""}
  </label>`;

const toggle = (label, path, value) => `
  <label class="check">
    <input type="checkbox" data-path="${path}" data-rerender="1"${value ? " checked" : ""} />
    <span>${esc(label)}</span>
  </label>`;

const imagePicker = (label, path, value, hint = "") => `
  <div class="field">
    <span class="field__label">${esc(label)}</span>
    <div class="thumb-row">
      ${value ? `<div class="thumb"><img src="${esc(value)}" alt="" /></div>` : ""}
      <span class="btn btn--small file-btn">
        ${value ? "Replace" : "Upload"}
        <input type="file" accept="image/*" data-upload="${path}" />
      </span>
      ${value ? `<button class="btn btn--small btn--danger" type="button" data-action="clear-image" data-path="${path}">Remove</button>` : ""}
    </div>
    ${hint ? `<span class="field__hint">${esc(hint)}</span>` : ""}
  </div>`;

/* -------------------------------------------------------------- artworks */

function missingForGallery(artwork) {
  const missing = [];
  if (!artwork.widthCm || !artwork.heightCm) missing.push("dimensions");
  if (!artwork.artistPrice) missing.push("artist price");
  if (!artwork.currentLocation) missing.push("location");
  if (!artwork.mainImage) missing.push("main image");
  return missing;
}

/* --- the overview row: everything saved about a work, at a glance --- */

const money = (amount) => `€${Number(amount).toLocaleString("en-GB")}`;

/** "Exhibited · 2 exhibitions" / "Not exhibited" */
function exhibitionSummary(artwork) {
  const count = artwork.previouslyExhibited ? artwork.exhibitionHistory.length : 0;
  if (!count) return { text: "Not exhibited", tone: "muted" };
  return { text: `Exhibited · ${count} exhibition${count === 1 ? "" : "s"}`, tone: "plain" };
}

/** "No commitment" / "Reserved" / "Gallery commitment" */
function commitmentSummary(artwork) {
  if (!artwork.hasCommitment || !artwork.commitment.type) {
    return { text: "No commitment", tone: "muted" };
  }
  const label = labelOf(COMMITMENT_TYPES, artwork.commitment.type);
  if (artwork.commitment.type === "reserved") return { text: "Reserved", tone: "warn" };
  return { text: `${label} commitment`, tone: "warn" };
}

function artworkRow(artwork, index, active) {
  const exhibition = exhibitionSummary(artwork);
  const commitment = commitmentSummary(artwork);
  const dimensions = artwork.widthCm && artwork.heightCm ? `${artwork.widthCm} × ${artwork.heightCm} cm` : "";

  return `
      <div class="aw-row ${active ? "is-active" : ""}" data-action="select-artwork" data-index="${index}">
        <div class="aw-cell aw-work">
          ${artwork.mainImage ? `<img class="aw-thumb" src="${esc(artwork.mainImage)}" alt="" loading="lazy" />` : '<span class="aw-thumb"></span>'}
          <span class="aw-work__text">
            <span class="aw-title">${esc(artwork.title || "Untitled")}</span>
            <span class="aw-sub">${esc(artwork.year || "—")}</span>
          </span>
        </div>

        <div class="aw-cell" data-label="Details">
          <span class="aw-line">${esc(artwork.medium || "—")}</span>
          <span class="aw-sub">${esc(dimensions || "No dimensions")}</span>
          <span class="badge badge--soft">${esc(labelOf(CATEGORIES, artwork.category))}</span>
        </div>

        <div class="aw-cell" data-label="Availability">
          <span class="badge badge--${esc(artwork.availability)}">${esc(labelOf(AVAILABILITY, artwork.availability))}</span>
          <span class="aw-sub">${esc(artwork.currentLocation || "No location")}</span>
          ${
            artwork.currentLocation
              ? `<span class="aw-sub ${artwork.showLocationPublicly ? "aw-sub--ok" : "aw-sub--off"}">Location: ${artwork.showLocationPublicly ? "public" : "private"}</span>`
              : ""
          }
        </div>

        <div class="aw-cell" data-label="Price">
          ${
            artwork.artistPrice
              ? `<span class="aw-line">Artist price ${money(artwork.artistPrice)}</span>`
              : '<span class="aw-sub">No artist price</span>'
          }
          ${artwork.retailPrice ? `<span class="aw-sub">Retail ${money(artwork.retailPrice)}</span>` : ""}
          <span class="aw-sub ${artwork.showPricePublicly && artwork.retailPrice ? "aw-sub--ok" : "aw-sub--off"}">
            Public price: ${
              !artwork.showPricePublicly
                ? "hidden"
                : artwork.retailPrice
                  ? "shown"
                  : "needs a retail price"
            }
          </span>
          <span class="aw-sub ${artwork.showPriceInCommercial && artwork.artistPrice ? "aw-sub--ok" : "aw-sub--off"}">
            Commercial price: ${
              !artwork.showPriceInCommercial
                ? "hidden"
                : artwork.artistPrice
                  ? "shown"
                  : "needs an artist price"
            }
          </span>
        </div>

        <div class="aw-cell" data-label="History">
          <span class="aw-line aw-line--${exhibition.tone}">${esc(exhibition.text)}</span>
          <span class="aw-line aw-line--${commitment.tone}">${esc(commitment.text)}</span>
        </div>

        <div class="aw-cell" data-label="Portfolio">
          ${
            artwork.includeInCommercial
              ? '<span class="badge badge--included">Commercial Portfolio ✓</span>'
              : '<span class="badge badge--muted">Not selected</span>'
          }
          ${artwork.featured ? '<span class="aw-sub aw-sub--ok">★ Featured</span>' : ""}
        </div>

        <div class="aw-cell aw-actions">
          <button class="btn btn--small" type="button" data-action="select-artwork" data-index="${index}">Edit</button>
        </div>
      </div>`;
}

function renderArtworks() {
  const { artworks } = state.content;
  const index = Math.min(state.artworkIndex, Math.max(artworks.length - 1, 0));
  state.artworkIndex = index;
  const artwork = artworks[index];

  const rows = artworks.map((a, i) => artworkRow(a, i, i === index)).join("");

  $("#panel-artworks").innerHTML = `
      <div class="section">
        <div class="section__head">
          <div>
            <h2 class="section__title">Artworks</h2>
            <p class="section__hint">${artworks.length} work${artworks.length === 1 ? "" : "s"} · everything saved, at a glance</p>
          </div>
          <button class="btn btn--small" type="button" data-action="add-artwork">+ Add</button>
        </div>

        ${
          artworks.length
            ? `<div class="aw-table">
          <div class="aw-head">
            <span>Work</span><span>Details</span><span>Availability</span><span>Price</span><span>History</span><span>Portfolio</span><span></span>
          </div>
          ${rows}
        </div>`
            : '<p class="empty">No artworks yet.</p>'
        }
      </div>

      <div class="section" id="artwork-editor">${artwork ? artworkForm(artwork, index) : '<p class="empty">Add an artwork to get started.</p>'}</div>`;
}

function artworkForm(artwork, index) {
  const base = `artworks.${index}`;
  const missing = missingForGallery(artwork);

  const history = artwork.exhibitionHistory
    .map(
      (entry, i) => `
      <div class="row" style="margin-bottom:10px">
        ${field("Exhibition name", `${base}.exhibitionHistory.${i}.name`, entry.name)}
        ${field("Venue / gallery", `${base}.exhibitionHistory.${i}.venue`, entry.venue)}
        ${field("City", `${base}.exhibitionHistory.${i}.city`, entry.city)}
        ${field("Country", `${base}.exhibitionHistory.${i}.country`, entry.country)}
        ${field("Year", `${base}.exhibitionHistory.${i}.year`, entry.year)}
        <div class="field">
          <span class="field__label">&nbsp;</span>
          <button class="btn btn--small btn--danger" type="button" data-action="remove-history" data-index="${i}">Remove</button>
        </div>
      </div>`
    )
    .join("");

  const details = artwork.detailImages
    .map(
      (src, i) => `
      <div class="thumb">
        <img src="${esc(src)}" alt="" />
        <button class="thumb__remove" type="button" data-action="remove-detail" data-index="${i}" aria-label="Remove image">×</button>
      </div>`
    )
    .join("");

  return `
    <div class="section__head">
      <div>
        <h2 class="section__title">${esc(artwork.title || "Untitled")}</h2>
        ${missing.length ? `<p class="missing">Galleries usually ask for: ${esc(missing.join(", "))}</p>` : '<p class="section__hint">Ready to send to a gallery.</p>'}
      </div>
      <button class="btn btn--small btn--danger" type="button" data-action="delete-artwork">Delete</button>
    </div>

    <div class="row">
      ${field("Title", `${base}.title`, artwork.title)}
      ${field("Year", `${base}.year`, artwork.year, { type: "number" })}
    </div>
    <div class="row">
      ${select("Category", `${base}.category`, artwork.category, CATEGORIES, "Decides which page the work appears on: /figurative or /landscape.")}
      ${field("Medium", `${base}.medium`, artwork.medium, { placeholder: "Oil on canvas" })}
    </div>
    <div class="row">
      ${field("Width (cm)", `${base}.widthCm`, artwork.widthCm, { type: "number" })}
      ${field("Height (cm)", `${base}.heightCm`, artwork.heightCm, { type: "number" })}
    </div>

    ${imagePicker("Main image", `${base}.mainImage`, artwork.mainImage)}

    <div class="field">
      <span class="field__label">Additional / detail images</span>
      <div class="thumb-row">
        ${details}
        <span class="btn btn--small file-btn">
          Add image
          <input type="file" accept="image/*" data-upload="${base}.detailImages[]" />
        </span>
      </div>
    </div>

    <div class="subsection">
      <div class="subsection__head">
        <span class="subsection__title">Availability</span>
      </div>
      <div class="row">
        ${select("Status", `${base}.availability`, artwork.availability, AVAILABILITY, "Shown on the public site.")}
        ${field("Current location", `${base}.currentLocation`, artwork.currentLocation, { placeholder: "Yerevan, Armenia" })}
      </div>
      ${toggle("Show location publicly", `${base}.showLocationPublicly`, artwork.showLocationPublicly)}
    </div>

    <div class="subsection">
      <div class="subsection__head">
        <span class="subsection__title">Pricing</span>
        <span class="private-note">Never shown on the public site</span>
      </div>
      <div class="row">
        ${field("Artist price (€)", `${base}.artistPrice`, artwork.artistPrice, { type: "number" })}
        ${field("Retail price (€) — optional", `${base}.retailPrice`, artwork.retailPrice, { type: "number" })}
      </div>
      <p class="field__hint" style="margin:-4px 0 10px">
        The public website only ever shows the <strong>retail price</strong> — leave it empty and
        no price appears there, whatever the switch says. The commercial portfolio shows the
        artist price. The two switches are independent.
      </p>
      ${toggle("Show price on public website", `${base}.showPricePublicly`, artwork.showPricePublicly)}
      ${toggle("Show price in commercial portfolio", `${base}.showPriceInCommercial`, artwork.showPriceInCommercial)}
    </div>

    <div class="subsection">
      <div class="subsection__head">
        <span class="subsection__title">Exhibition history</span>
        ${toggle("Previously exhibited", `${base}.previouslyExhibited`, artwork.previouslyExhibited)}
      </div>
      ${
        artwork.previouslyExhibited
          ? `${history}<button class="btn btn--small" type="button" data-action="add-history">+ Add exhibition</button>`
          : '<p class="field__hint">Switch on to record where this work has been shown.</p>'
      }
    </div>

    <div class="subsection">
      <div class="subsection__head">
        <span class="subsection__title">Existing commitment</span>
        ${toggle("Committed", `${base}.hasCommitment`, artwork.hasCommitment)}
      </div>
      ${
        artwork.hasCommitment
          ? `<div class="row">
              ${select("Type", `${base}.commitment.type`, artwork.commitment.type || "gallery", COMMITMENT_TYPES)}
              ${field("Until (optional)", `${base}.commitment.until`, artwork.commitment.until, { type: "date" })}
            </div>
            ${textarea("Details", `${base}.commitment.details`, artwork.commitment.details, { rows: 2, placeholder: "Held by Gaudi Gallery for a spring group show" })}`
          : '<p class="field__hint">Switch on if this work is promised to a gallery, collector or platform.</p>'
      }
    </div>

    <div class="subsection">
      <div class="subsection__head">
        <span class="subsection__title">Commercial portfolio</span>
      </div>
      <div class="checks" style="margin-bottom:14px">
        ${toggle("Include in commercial portfolio", `${base}.includeInCommercial`, artwork.includeInCommercial)}
        ${toggle("Featured", `${base}.featured`, artwork.featured)}
      </div>
      ${field("Order on the website", `${base}.displayOrder`, artwork.displayOrder, { type: "number", hint: "Lower numbers come first in the My art section. The gallery portfolio has its own order, set in the Markets & commercial tab." })}
    </div>

    <div class="subsection">
      <div class="subsection__head">
        <span class="subsection__title">Private notes</span>
        <span class="private-note">Only you can see this</span>
      </div>
      ${textarea("", `${base}.privateNotes`, artwork.privateNotes, { rows: 2 })}
    </div>`;
}

/* ---------------------------------------------------------------- artist */

function renderArtist() {
  const a = state.content.artist;
  $("#panel-artist").innerHTML = `
    <div class="section">
      <div class="section__head">
        <div>
          <h2 class="section__title">Artist &amp; practice</h2>
          <p class="section__hint">Who you are and what the work is doing right now.</p>
        </div>
      </div>
      <div class="row">
        ${field("Artist name", "artist.name", a.name)}
        ${field("Location", "artist.location", a.location, { placeholder: "Yerevan, Armenia" })}
      </div>
      ${textarea("Short bio", "artist.shortBio", a.shortBio, { rows: 3 })}
      ${textarea("Artist statement", "artist.statement", a.statement, { rows: 5 })}
    </div>

    <div class="section">
      <div class="section__head">
        <div>
          <h2 class="section__title">Practice</h2>
          <p class="section__hint">The two questions galleries always ask.</p>
        </div>
      </div>
      ${textarea("Current practice / recent transition", "artist.currentPractice", a.currentPractice, {
        rows: 5,
        placeholder: "What changed recently in the work, and what you are making now.",
      })}
      ${textarea("Direction of the next body of work", "artist.nextBodyOfWork", a.nextBodyOfWork, {
        rows: 5,
        placeholder: "Where the next series is heading — subject, scale, materials, intention.",
      })}
    </div>

    <div class="section">
      <div class="section__head">
        <div>
          <h2 class="section__title">Contact</h2>
          <p class="section__hint">Shown in Let's Connect on the site and on the gallery portfolio.</p>
        </div>
      </div>
      <div class="row">
        ${field("Email", "contact.email", state.content.contact.email)}
        ${field("Instagram handle", "contact.instagramHandle", state.content.contact.instagramHandle, { placeholder: "@animoria.art" })}
      </div>
      <div class="row">
        ${field("Instagram link", "contact.instagramUrl", state.content.contact.instagramUrl, { type: "url" })}
        ${field("Singulart link", "contact.singulartUrl", state.content.contact.singulartUrl, { type: "url" })}
      </div>
      <div class="row">
        ${field("Singulart label", "contact.singulartLabel", state.content.contact.singulartLabel, { placeholder: "Ani Muradyan" })}
        ${field("Website label", "contact.websiteLabel", state.content.contact.websiteLabel, { placeholder: "animuradyan.com" })}
        ${field("Website link", "contact.websiteUrl", state.content.contact.websiteUrl, { type: "url" })}
      </div>
    </div>

    <div class="section">
      <div class="section__head">
        <div><h2 class="section__title">Photos</h2></div>
      </div>
      <div class="row">
        ${imagePicker("Profile photo", "artist.profileImage", a.profileImage)}
        ${imagePicker("Studio photo (optional)", "artist.studioImage", a.studioImage)}
      </div>
    </div>`;
}

/* ----------------------------------------------------------- exhibitions */

function exhibitionCard(exhibition, index) {
  const base = `exhibitions.${index}`;
  return `
    <div class="subsection">
      <div class="subsection__head">
        <span class="subsection__title">
          ${esc(exhibition.name || "Untitled")}
          <span class="pill ${isForthcoming(exhibition.status) ? "pill--forthcoming" : ""}">${esc(labelOf(EXHIBITION_STATUS, exhibition.status))}</span>
        </span>
        <button class="btn btn--small btn--danger" type="button" data-action="remove-exhibition" data-index="${index}">Remove</button>
      </div>
      <div class="row">
        ${select("Type", `${base}.type`, exhibition.type, EXHIBITION_TYPES)}
        ${select("Status", `${base}.status`, exhibition.status, EXHIBITION_STATUS)}
      </div>
      <div class="row">
        ${field("Name", `${base}.name`, exhibition.name)}
        ${field("Venue / institution", `${base}.venue`, exhibition.venue)}
      </div>
      <div class="row">
        ${field("City", `${base}.city`, exhibition.city)}
        ${field("Country", `${base}.country`, exhibition.country)}
        ${field("Start date", `${base}.startDate`, exhibition.startDate, { placeholder: "2026 or 2026-04" })}
        ${field("End date", `${base}.endDate`, exhibition.endDate, { placeholder: "optional" })}
      </div>
      ${field("External link (optional)", `${base}.link`, exhibition.link, { type: "url", placeholder: "https://…" })}
    </div>`;
}

function renderExhibitions() {
  const items = state.content.exhibitions.map((e, i) => ({ e, i }));
  const forthcoming = items.filter(({ e }) => isForthcoming(e.status));
  const past = items.filter(({ e }) => !isForthcoming(e.status));

  $("#panel-exhibitions").innerHTML = `
    <div class="section">
      <div class="section__head">
        <div>
          <h2 class="section__title">Confirmed &amp; upcoming</h2>
          <p class="section__hint">Shown separately to galleries — this is what they look for first.</p>
        </div>
        <button class="btn btn--small" type="button" data-action="add-exhibition">+ Add</button>
      </div>
      ${forthcoming.map(({ e, i }) => exhibitionCard(e, i)).join("") || '<p class="empty">Nothing confirmed yet.</p>'}
    </div>

    <div class="section">
      <div class="section__head">
        <div><h2 class="section__title">Past</h2></div>
      </div>
      ${past.map(({ e, i }) => exhibitionCard(e, i)).join("") || '<p class="empty">No past exhibitions recorded.</p>'}
    </div>`;
}

/* ------------------------------------------------------------ commercial */

function renderCommercial() {
  const c = state.content.commercial;
  const selected = state.content.artworks
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.includeInCommercial)
    .sort((x, y) => x.a.commercialOrder - y.a.commercialOrder);

  const inRange = selected.length >= COMMERCIAL_TARGET_MIN && selected.length <= COMMERCIAL_TARGET_MAX;

  const rows = selected
    .map(
      ({ a, i }, position) => `
      <div class="order-row">
        <div class="order-btns">
          <button class="btn btn--small" type="button" data-action="move-up" data-index="${i}" ${position === 0 ? "disabled" : ""}>↑</button>
          <button class="btn btn--small" type="button" data-action="move-down" data-index="${i}" ${position === selected.length - 1 ? "disabled" : ""}>↓</button>
        </div>
        <span class="order-row__index">${position + 1}</span>
        ${a.mainImage ? `<img class="list-item__thumb" src="${esc(a.mainImage)}" alt="" />` : `<span class="list-item__thumb"></span>`}
        <span class="list-item__body">
          <span class="list-item__title">${esc(a.title || "Untitled")}${a.featured ? " ★" : ""}</span>
          <span class="list-item__meta">
            ${esc(labelOf(AVAILABILITY, a.availability))}
            ${a.widthCm && a.heightCm ? ` · ${a.widthCm} × ${a.heightCm} cm` : ""}
            ${a.artistPrice ? ` · €${Number(a.artistPrice).toLocaleString()}` : ""}
            ${a.hasCommitment ? ` · ${esc(labelOf(COMMITMENT_TYPES, a.commitment.type))}` : ""}
          </span>
        </span>
        <button class="btn btn--small" type="button" data-action="edit-artwork" data-index="${i}">Edit</button>
        <button class="btn btn--small" type="button" data-action="drop-artwork" data-index="${i}">Remove</button>
      </div>`
    )
    .join("");

  const available = state.content.artworks
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => !a.includeInCommercial)
    .map(
      ({ a, i }) => `
      <div class="order-row">
        ${a.mainImage ? `<img class="list-item__thumb" src="${esc(a.mainImage)}" alt="" />` : `<span class="list-item__thumb"></span>`}
        <span class="list-item__body">
          <span class="list-item__title">${esc(a.title || "Untitled")}</span>
          <span class="list-item__meta">${esc(a.year || "")} · ${esc(labelOf(AVAILABILITY, a.availability))}</span>
        </span>
        <button class="btn btn--small" type="button" data-action="add-to-portfolio" data-index="${i}">Add</button>
      </div>`
    )
    .join("");

  const checkboxes = (list, values, path) =>
    list
      .map(
        (o) => `
        <label class="check">
          <input type="checkbox" data-multi="${path}" value="${o.value}" data-rerender="1"${values.includes(o.value) ? " checked" : ""} />
          <span>${esc(o.label)}</span>
        </label>`
      )
      .join("");

  $("#panel-commercial").innerHTML = `
    <div class="section">
      <div class="section__head">
        <div>
          <h2 class="section__title">Commercial portfolio</h2>
          <p class="section__hint">The works you send to galleries, in the order they should be seen.</p>
        </div>
        <div class="counter">
          <p class="counter__n ${inRange ? "is-good" : "is-off"}">${selected.length}</p>
          <p class="counter__label">aim for ${COMMERCIAL_TARGET_MIN}–${COMMERCIAL_TARGET_MAX}</p>
        </div>
      </div>
      ${rows || '<p class="empty">No works selected yet — add some from the list below.</p>'}
    </div>

    <div class="section">
      <div class="section__head">
        <div><h2 class="section__title">Other works</h2></div>
      </div>
      ${available || '<p class="empty">Every work is already in the portfolio.</p>'}
    </div>

    <div class="section">
      <div class="section__head">
        <div>
          <h2 class="section__title">Markets &amp; preferences</h2>
          <p class="section__hint">What you are looking for, and where.</p>
        </div>
      </div>

      <div class="field">
        <span class="field__label">Markets of interest</span>
        <div class="checks">${checkboxes(MARKETS, c.markets, "commercial.markets")}</div>
      </div>

      ${field("Priority countries (optional)", "commercial.priorityCountries", c.priorityCountries, {
        placeholder: "France, Germany, United Arab Emirates",
      })}

      <div class="field">
        <span class="field__label">Interested in</span>
        <div class="checks">${checkboxes(INTERESTS, c.interestedIn, "commercial.interestedIn")}</div>
      </div>

      <div class="row">
        <div class="field">
          <span class="field__label">Representation</span>
          ${toggle("Open to representation", "commercial.openToRepresentation", c.openToRepresentation)}
        </div>
        ${select("Exclusivity preference", "commercial.exclusivity", c.exclusivity, EXCLUSIVITY)}
      </div>
    </div>

    <div class="section">
      <div class="section__head">
        <div><h2 class="section__title">Private notes</h2></div>
        <span class="private-note">Never sent to galleries</span>
      </div>
      ${textarea("", "commercial.privateNotes", c.privateNotes, {
        rows: 5,
        placeholder: "Reminders, contacts, terms discussed…",
      })}
    </div>`;
}

/* ----------------------------------------------------------------- render */

const RENDERERS = {
  artworks: renderArtworks,
  artist: renderArtist,
  exhibitions: renderExhibitions,
  commercial: renderCommercial,
};

function render() {
  for (const [tab, renderTab] of Object.entries(RENDERERS)) {
    const panel = document.querySelector(`#panel-${tab}`);
    panel.hidden = tab !== state.tab;
    if (tab === state.tab) renderTab();
  }
  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === state.tab);
  });
}

/* ----------------------------------------------------------------- events */

document.addEventListener("input", (event) => {
  const el = event.target;
  if (!el.dataset?.path || el.type === "checkbox") return;
  const value = el.type === "number" ? (el.value === "" ? null : Number(el.value)) : el.value;
  setPath(state.content, el.dataset.path, value);
  markDirty();
});

document.addEventListener("change", (event) => {
  const el = event.target;

  if (el.dataset?.multi) {
    const current = getPath(state.content, el.dataset.multi) || [];
    const next = el.checked ? [...new Set([...current, el.value])] : current.filter((v) => v !== el.value);
    setPath(state.content, el.dataset.multi, next);
    markDirty();
    return;
  }

  if (el.dataset?.path && (el.type === "checkbox" || el.tagName === "SELECT")) {
    setPath(state.content, el.dataset.path, el.type === "checkbox" ? el.checked : el.value);
    markDirty();
    if (el.dataset.rerender || el.tagName === "SELECT") render();
  }
});

document.addEventListener("change", async (event) => {
  const input = event.target;
  if (!input.dataset?.upload) return;
  const file = input.files?.[0];
  if (!file) return;

  try {
    input.disabled = true;
    const { url } = await api("POST", `/api/admin/upload?name=${encodeURIComponent(file.name)}`, file, {
      raw: true,
      contentType: file.type,
    });
    const path = input.dataset.upload;
    if (path.endsWith("[]")) {
      const listPath = path.slice(0, -2);
      setPath(state.content, listPath, [...(getPath(state.content, listPath) || []), url]);
    } else {
      setPath(state.content, path, url);
    }
    markDirty();
    render();
    toast("Image uploaded");
  } catch (error) {
    toast(error.message, true);
  } finally {
    input.disabled = false;
  }
});

const ACTIONS = {
  "select-artwork": (index) => {
    state.artworkIndex = index;
    scrollToEditor = true;
  },
  "add-artwork": () => {
    const artwork = emptyArtwork();
    artwork.id = makeId("untitled", state.content.artworks.map((a) => a.id));
    artwork.title = "Untitled";
    artwork.category = state.content.artworks.at(-1)?.category || "figurative";
    artwork.displayOrder = state.content.artworks.length + 1;
    state.content.artworks.push(artwork);
    state.artworkIndex = state.content.artworks.length - 1;
    markDirty();
  },
  "delete-artwork": () => {
    const artwork = state.content.artworks[state.artworkIndex];
    if (!confirm(`Delete “${artwork.title || "Untitled"}”? This cannot be undone.`)) return false;
    state.content.artworks.splice(state.artworkIndex, 1);
    state.artworkIndex = Math.max(0, state.artworkIndex - 1);
    markDirty();
  },
  "add-history": () => {
    state.content.artworks[state.artworkIndex].exhibitionHistory.push(emptyExhibitionRecord());
    markDirty();
  },
  "remove-history": (index) => {
    state.content.artworks[state.artworkIndex].exhibitionHistory.splice(index, 1);
    markDirty();
  },
  "remove-detail": (index) => {
    state.content.artworks[state.artworkIndex].detailImages.splice(index, 1);
    markDirty();
  },
  "clear-image": (_index, el) => {
    setPath(state.content, el.dataset.path, "");
    markDirty();
  },
  "add-exhibition": () => {
    state.content.exhibitions.unshift({ ...emptyExhibition(), status: "confirmed" });
    markDirty();
  },
  "remove-exhibition": (index) => {
    if (!confirm("Remove this exhibition?")) return false;
    state.content.exhibitions.splice(index, 1);
    markDirty();
  },
  "add-to-portfolio": (index) => {
    const artwork = state.content.artworks[index];
    artwork.includeInCommercial = true;
    artwork.commercialOrder = state.content.artworks.filter((a) => a.includeInCommercial).length;
    markDirty();
  },
  "drop-artwork": (index) => {
    state.content.artworks[index].includeInCommercial = false;
    markDirty();
  },
  "edit-artwork": (index) => {
    state.artworkIndex = index;
    state.tab = "artworks";
  },
  "move-up": (index) => moveSelected(index, -1),
  "move-down": (index) => moveSelected(index, 1),
};

/** Reorder the commercial selection by rewriting commercialOrder 1..n. */
function moveSelected(index, direction) {
  const selected = state.content.artworks
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.includeInCommercial)
    .sort((x, y) => x.a.commercialOrder - y.a.commercialOrder);

  const position = selected.findIndex((entry) => entry.i === index);
  const target = position + direction;
  if (position < 0 || target < 0 || target >= selected.length) return false;

  [selected[position], selected[target]] = [selected[target], selected[position]];
  selected.forEach(({ a }, i) => (a.commercialOrder = i + 1));
  markDirty();
}

/** Set by actions that should bring the artwork editor into view after render. */
let scrollToEditor = false;

document.addEventListener("click", (event) => {
  const el = event.target.closest("[data-action]");
  if (!el) return;
  const action = ACTIONS[el.dataset.action];
  if (!action) return;
  const result = action(Number(el.dataset.index), el);
  if (result !== false) render();
  if (scrollToEditor) {
    scrollToEditor = false;
    document.getElementById("artwork-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

$("#tabs").addEventListener("click", (event) => {
  const button = event.target.closest(".tab");
  if (!button) return;
  state.tab = button.dataset.tab;
  render();
});

$("#save").addEventListener("click", async () => {
  const button = $("#save");
  try {
    button.disabled = true;
    const { content } = await api("PUT", "/api/admin/content", state.content);
    state.content = content;
    markDirty(false);
    render();
    toast("Saved — the site is updated");
  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = false;
  }
});

$("#logout").addEventListener("click", async () => {
  await api("POST", "/api/logout").catch(() => {});
  location.reload();
});

$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = $("#login-error");
  error.hidden = true;
  try {
    await api("POST", "/api/login", { password: $("#password").value });
    await start();
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
  }
});

window.addEventListener("beforeunload", (event) => {
  if (!state.dirty) return;
  event.preventDefault();
  event.returnValue = "";
});

/* ------------------------------------------------------------------ boot */

async function start() {
  const { authenticated } = await api("GET", "/api/session");
  $("#login").hidden = authenticated;
  $("#app").hidden = !authenticated;
  if (!authenticated) return;
  state.content = await api("GET", "/api/admin/content");
  markDirty(false);
  render();
}

start().catch((error) => {
  $("#login").hidden = false;
  $("#login-error").textContent = error.message;
  $("#login-error").hidden = false;
});
