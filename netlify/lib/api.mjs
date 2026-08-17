/**
 * The admin API, written once and run in two places: as a Netlify function in
 * production and inside server.cjs locally. It speaks plain objects in and out
 * so neither host needs to know about the other.
 *
 * Privacy rule, enforced here: /api/content is public and always goes through
 * publicContent(); everything that carries prices, commitments or notes sits
 * behind /api/admin/* and requires the session cookie.
 */
import crypto from "node:crypto";
import { normaliseContent, publicContent, commercialPortfolio } from "../../content-schema.mjs";
import { readContent, writeContent, putImage, getImage } from "./store.mjs";

const COOKIE = "ps_admin";
const SESSION_HOURS = 12;

const json = (status, data, headers = {}) => ({
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  body: JSON.stringify(data),
});

/* ------------------------------------------------------------------ auth */

const secret = () => process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || "";

function sign(value) {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex");
}

function makeToken() {
  const expires = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  return `${expires}.${sign(String(expires))}`;
}

function validToken(token) {
  if (!token || !secret()) return false;
  const [expires, signature] = String(token).split(".");
  if (!expires || !signature) return false;
  if (Number(expires) < Date.now()) return false;
  const expected = sign(expires);
  // constant-time compare so a wrong signature leaks nothing through timing
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function readCookie(header, name) {
  return (header || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

const isAuthed = (headers) => validToken(readCookie(headers.cookie || headers.Cookie, COOKIE));

function sessionCookie(token, maxAge) {
  const parts = [
    `${COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAge}`,
  ];
  if (process.env.NETLIFY) parts.push("Secure");
  return parts.join("; ");
}

/* ---------------------------------------------------------------- routing */

/**
 * @param {object} req  { method, path, headers, body, query }
 *   `body` is a parsed object for JSON requests, or a Buffer for uploads.
 * @returns {Promise<{status:number, headers:object, body:string|Buffer}>}
 */
export async function handleApi(req) {
  const { method, headers = {}, query = {} } = req;
  const path = req.path.replace(/\/+$/, "") || "/";

  /* ---- session ---- */

  if (path === "/api/login" && method === "POST") {
    const password = req.body?.password;
    if (!process.env.ADMIN_PASSWORD) {
      return json(500, { message: "ADMIN_PASSWORD is not configured for this site." });
    }
    if (typeof password !== "string" || password !== process.env.ADMIN_PASSWORD) {
      return json(401, { authenticated: false, message: "Wrong password" });
    }
    return json(200, { authenticated: true }, { "set-cookie": sessionCookie(makeToken(), SESSION_HOURS * 3600) });
  }

  if (path === "/api/logout" && method === "POST") {
    return json(200, { authenticated: false }, { "set-cookie": sessionCookie("", 0) });
  }

  if (path === "/api/session" && method === "GET") {
    return json(200, { authenticated: isAuthed(headers) });
  }

  /* ---- public ---- */

  if (path === "/api/content" && method === "GET") {
    const content = await readContent();
    // Not cached: a save in the admin has to show on the site immediately, and
    // this response is small. (The images it points at are still cached hard.)
    return json(200, publicContent(content), { "cache-control": "no-store" });
  }

  // The gallery-facing package that backs /commercial. Public, because the page
  // itself is shared as an unlisted link — it carries only what that page shows
  // (prices solely where the artist switched them on) and never a private note.
  if (path === "/api/commercial" && method === "GET") {
    // Uncached, like /api/content: a price or commitment changed in the admin
    // has to reach a gallery on their next load, not up to half a minute later.
    return json(200, commercialPortfolio(await readContent()), { "cache-control": "no-store" });
  }

  if (path.startsWith("/api/images/") && method === "GET") {
    const image = await getImage(path.slice("/api/images/".length));
    if (!image) return json(404, { message: "Not found" });
    return {
      status: 200,
      headers: { "content-type": image.contentType, "cache-control": "public, max-age=31536000, immutable" },
      body: image.body,
    };
  }

  /* ---- admin ---- */

  if (path.startsWith("/api/admin/")) {
    if (!isAuthed(headers)) return json(401, { message: "Please log in" });
  }

  if (path === "/api/admin/content" && method === "GET") {
    return json(200, normaliseContent(await readContent()));
  }

  if (path === "/api/admin/content" && method === "PUT") {
    const content = normaliseContent(req.body || {});
    await writeContent(content);
    return json(200, { saved: true, content });
  }

  if (path === "/api/admin/upload" && method === "POST") {
    const name = query.name || "image.jpg";
    const contentType = headers["content-type"] || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return json(400, { message: "That file is not an image" });
    }
    const body = req.body;
    if (!body || !body.length) return json(400, { message: "No image received" });
    if (body.length > 8 * 1024 * 1024) return json(413, { message: "Images must be under 8 MB" });
    const key = `${Date.now()}-${name}`;
    const url = await putImage(key, body, contentType);
    return json(200, { url });
  }

  return json(404, { message: "Unknown endpoint" });
}
