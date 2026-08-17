/**
 * The single source of truth for the portfolio's content shape.
 *
 * Imported by three places, so there is one model and no drift:
 *   • the Netlify functions (server-side read/write + the public/private split)
 *   • the admin UI in the browser (field vocabulary + blank records)
 *   • the build script (bakes the current content into index.html)
 *
 * The public site and the commercial portfolio are two views of the SAME
 * artworks. `publicContent()` is the guarantee that prices, commitments and
 * notes never reach the public site.
 */

/* ------------------------------------------------------------- vocabulary */

export const AVAILABILITY = [
  { value: "available", label: "Available" },
  { value: "reserved", label: "Reserved" },
  { value: "sold", label: "Sold" },
  { value: "not_for_sale", label: "Not for sale" },
];

export const CATEGORIES = [
  { value: "figurative", label: "Figurative" },
  { value: "landscape", label: "Landscape" },
];

export const COMMITMENT_TYPES = [
  { value: "gallery", label: "Gallery" },
  { value: "collector", label: "Collector" },
  { value: "platform", label: "Platform" },
  { value: "reserved", label: "Reserved" },
  { value: "other", label: "Other" },
];

export const EXHIBITION_TYPES = [
  { value: "solo", label: "Solo Exhibition" },
  { value: "group", label: "Group Exhibition" },
  { value: "residency", label: "Residency" },
];

export const EXHIBITION_STATUS = [
  { value: "past", label: "Past" },
  { value: "confirmed", label: "Confirmed" },
  { value: "upcoming", label: "Upcoming" },
];

export const MARKETS = [
  { value: "europe", label: "Europe" },
  { value: "uae", label: "UAE" },
  { value: "gcc", label: "GCC" },
  { value: "uk", label: "UK" },
  { value: "usa", label: "USA" },
  { value: "other", label: "Other" },
];

export const INTERESTS = [
  { value: "collector_introductions", label: "Collector introductions" },
  { value: "exhibitions", label: "Exhibitions" },
  { value: "curated_presentations", label: "Curated presentations" },
  { value: "gallery_representation", label: "Gallery representation" },
  { value: "art_fairs", label: "Art fairs" },
];

export const EXCLUSIVITY = [
  { value: "non_exclusive", label: "Non-exclusive" },
  { value: "open", label: "Open to discussion" },
  { value: "exclusive", label: "Exclusive" },
];

export const labelOf = (options, value) => options.find((o) => o.value === value)?.label ?? "";

/** A well-sized selection to send a gallery. */
export const COMMERCIAL_TARGET_MIN = 10;
export const COMMERCIAL_TARGET_MAX = 15;

/* ----------------------------------------------------------- the contract */

/**
 * Artwork fields the public site must never receive. Add a commercial field?
 * Add it here — publicContent() reads this list.
 */
export const PRIVATE_ARTWORK_FIELDS = [
  "artistPrice",
  "retailPrice",
  "showPriceInCommercial",
  "currentLocation",
  "exhibitionHistory",
  "previouslyExhibited",
  "hasCommitment",
  "commitment",
  "includeInCommercial",
  "commercialOrder",
  "privateNotes",
];

/* --------------------------------------------------------- blank records */

export function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/** Ids stay stable once created; only new records get a generated one. */
export function makeId(title, taken = []) {
  const base = slugify(title) || "artwork";
  let id = base;
  let n = 2;
  while (taken.includes(id)) id = `${base}-${n++}`;
  return id;
}

export const emptyArtwork = () => ({
  id: "",
  title: "",
  year: new Date().getFullYear(),
  medium: "Oil on canvas",
  category: "figurative",
  widthCm: null,
  heightCm: null,
  mainImage: "",
  detailImages: [],
  availability: "available",
  currentLocation: "",
  artistPrice: null,
  retailPrice: null,
  showPriceInCommercial: false,
  previouslyExhibited: false,
  exhibitionHistory: [],
  hasCommitment: false,
  commitment: { type: "", details: "", until: "" },
  includeInCommercial: false,
  featured: false,
  displayOrder: 0,
  commercialOrder: 0,
  privateNotes: "",
});

export const emptyExhibitionRecord = () => ({
  name: "",
  venue: "",
  city: "",
  country: "",
  year: "",
});

export const emptyExhibition = () => ({
  id: "",
  type: "group",
  name: "",
  venue: "",
  city: "",
  country: "",
  startDate: "",
  endDate: "",
  status: "past",
  link: "",
});

export const emptyContent = () => ({
  artist: {
    name: "",
    location: "",
    shortBio: "",
    statement: "",
    currentPractice: "",
    nextBodyOfWork: "",
    profileImage: "",
    studioImage: "",
  },
  artworks: [],
  exhibitions: [],
  contact: {
    email: "",
    instagramHandle: "",
    instagramUrl: "",
    singulartLabel: "",
    singulartUrl: "",
    websiteLabel: "",
    websiteUrl: "",
  },
  commercial: {
    markets: [],
    priorityCountries: "",
    interestedIn: [],
    openToRepresentation: false,
    exclusivity: "open",
    privateNotes: "",
  },
});

/* ------------------------------------------------------------ normalising */

const str = (v) => (v === null || v === undefined ? "" : String(v));
const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const bool = (v) => v === true || v === "true" || v === "on";
const list = (v) => (Array.isArray(v) ? v : []);

export function normaliseArtwork(raw = {}, taken = []) {
  const title = str(raw.title);
  return {
    id: str(raw.id) || makeId(title, taken),
    title,
    year: num(raw.year) ?? new Date().getFullYear(),
    medium: str(raw.medium),
    category: CATEGORIES.some((o) => o.value === raw.category) ? raw.category : "figurative",
    widthCm: num(raw.widthCm),
    heightCm: num(raw.heightCm),
    mainImage: str(raw.mainImage),
    detailImages: list(raw.detailImages).map(str).filter(Boolean),
    availability: AVAILABILITY.some((o) => o.value === raw.availability) ? raw.availability : "available",
    currentLocation: str(raw.currentLocation),
    artistPrice: num(raw.artistPrice),
    retailPrice: num(raw.retailPrice),
    showPriceInCommercial: bool(raw.showPriceInCommercial),
    previouslyExhibited: bool(raw.previouslyExhibited),
    exhibitionHistory: list(raw.exhibitionHistory)
      .map((e) => ({
        name: str(e?.name),
        venue: str(e?.venue),
        city: str(e?.city),
        country: str(e?.country),
        year: str(e?.year),
      }))
      .filter((e) => e.name || e.venue || e.city),
    hasCommitment: bool(raw.hasCommitment),
    commitment: {
      type: str(raw.commitment?.type),
      details: str(raw.commitment?.details),
      until: str(raw.commitment?.until),
    },
    includeInCommercial: bool(raw.includeInCommercial),
    featured: bool(raw.featured),
    // two separate orders: `displayOrder` is the running order on the public
    // site, `commercialOrder` is the sequence a gallery is shown. Reordering
    // the selection must never rearrange the website.
    displayOrder: num(raw.displayOrder) ?? 0,
    commercialOrder: num(raw.commercialOrder) ?? 0,
    privateNotes: str(raw.privateNotes),
  };
}

export function normaliseExhibition(raw = {}, taken = []) {
  const name = str(raw.name);
  return {
    id: str(raw.id) || makeId(`${name}-${str(raw.startDate)}`, taken),
    type: EXHIBITION_TYPES.some((o) => o.value === raw.type) ? raw.type : "group",
    name,
    venue: str(raw.venue),
    city: str(raw.city),
    country: str(raw.country),
    startDate: str(raw.startDate),
    endDate: str(raw.endDate),
    status: EXHIBITION_STATUS.some((o) => o.value === raw.status) ? raw.status : "past",
    link: str(raw.link),
  };
}

/** Accepts anything and returns a complete, well-typed content object. */
export function normaliseContent(raw = {}) {
  const base = emptyContent();
  const artworkIds = [];
  const exhibitionIds = [];

  const artworks = list(raw.artworks).map((a) => {
    const normalised = normaliseArtwork(a, artworkIds);
    artworkIds.push(normalised.id);
    return normalised;
  });

  const exhibitions = list(raw.exhibitions).map((e) => {
    const normalised = normaliseExhibition(e, exhibitionIds);
    exhibitionIds.push(normalised.id);
    return normalised;
  });

  return {
    artist: { ...base.artist, ...Object.fromEntries(Object.entries(raw.artist || {}).map(([k, v]) => [k, str(v)])) },
    artworks,
    exhibitions,
    contact: { ...base.contact, ...Object.fromEntries(Object.entries(raw.contact || {}).map(([k, v]) => [k, str(v)])) },
    commercial: {
      markets: list(raw.commercial?.markets).map(str),
      priorityCountries: str(raw.commercial?.priorityCountries),
      interestedIn: list(raw.commercial?.interestedIn).map(str),
      openToRepresentation: bool(raw.commercial?.openToRepresentation),
      exclusivity: EXCLUSIVITY.some((o) => o.value === raw.commercial?.exclusivity)
        ? raw.commercial.exclusivity
        : "open",
      privateNotes: str(raw.commercial?.privateNotes),
    },
  };
}

/* ----------------------------------------------------------- public view */

/** The dimension line the site prints under a title. */
export function dimensionsLabel(artwork) {
  if (!artwork?.widthCm || !artwork?.heightCm) return "";
  return `${artwork.widthCm} × ${artwork.heightCm} cm`;
}

/** "Oil on canvas · 80 × 90 cm · 2026" — exactly what the page shows today. */
export function artworkMeta(artwork) {
  return [artwork.medium, dimensionsLabel(artwork), artwork.year].filter(Boolean).join(" · ");
}

export function publicArtwork(artwork) {
  const out = { ...artwork };
  for (const field of PRIVATE_ARTWORK_FIELDS) delete out[field];
  return out;
}

/**
 * What the public site is allowed to see: the artworks as they appear on the
 * page, the artist's words, and the exhibition list. No pricing, no
 * commitments, no notes, no commercial section at all.
 */
export function publicContent(content) {
  const c = normaliseContent(content);
  return {
    artist: {
      name: c.artist.name,
      location: c.artist.location,
      shortBio: c.artist.shortBio,
      statement: c.artist.statement,
      profileImage: c.artist.profileImage,
      studioImage: c.artist.studioImage,
    },
    artworks: c.artworks
      .slice()
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map(publicArtwork),
    exhibitions: c.exhibitions,
    contact: c.contact,
  };
}

/** Works in one category, in the site's running order. */
export function artworksInCategory(content, category) {
  return (content.artworks || [])
    .filter((a) => a.category === category)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
}

export const categoryLabel = (value) => labelOf(CATEGORIES, value);

/**
 * Image sources are stored site-absolute so they resolve the same on /, on
 * /figurative/ and on /commercial/. Older relative values are repaired here.
 */
export function assetUrl(src) {
  const value = String(src || "");
  if (!value || value.startsWith("http") || value.startsWith("data:") || value.startsWith("/")) return value;
  return `/${value}`;
}

export const isForthcoming = (status) => status === "confirmed" || status === "upcoming";

/**
 * The gallery-facing package: the curated selection in the artist's order,
 * prices only where she switched them on, the practice fields, forthcoming
 * shows and what she is looking for. Private notes are never included — not
 * the per-artwork ones, not the commercial ones.
 */
export function commercialPortfolio(content) {
  const c = normaliseContent(content);
  const works = c.artworks
    .filter((a) => a.includeInCommercial)
    .sort((a, b) => a.commercialOrder - b.commercialOrder)
    .map((a) => ({
      id: a.id,
      title: a.title,
      year: a.year,
      medium: a.medium,
      category: a.category,
      widthCm: a.widthCm,
      heightCm: a.heightCm,
      dimensions: dimensionsLabel(a),
      mainImage: a.mainImage,
      detailImages: a.detailImages,
      availability: a.availability,
      currentLocation: a.currentLocation,
      featured: a.featured,
      exhibitionHistory: a.previouslyExhibited ? a.exhibitionHistory : [],
      commitment: a.hasCommitment ? a.commitment : null,
      pricing: a.showPriceInCommercial
        ? { currency: "EUR", artistPrice: a.artistPrice, retailPrice: a.retailPrice }
        : null,
    }));

  return {
    artist: {
      name: c.artist.name,
      location: c.artist.location,
      shortBio: c.artist.shortBio,
      statement: c.artist.statement,
      currentPractice: c.artist.currentPractice,
      nextBodyOfWork: c.artist.nextBodyOfWork,
      profileImage: c.artist.profileImage,
      studioImage: c.artist.studioImage,
    },
    works,
    exhibitions: {
      forthcoming: c.exhibitions.filter((e) => isForthcoming(e.status)),
      past: c.exhibitions.filter((e) => !isForthcoming(e.status)),
    },
    contact: c.contact,
    preferences: {
      markets: c.commercial.markets,
      priorityCountries: c.commercial.priorityCountries,
      interestedIn: c.commercial.interestedIn,
      openToRepresentation: c.commercial.openToRepresentation,
      exclusivity: c.commercial.exclusivity,
    },
  };
}
