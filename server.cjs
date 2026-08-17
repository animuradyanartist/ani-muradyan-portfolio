/* Local dev server: the static site + the same admin API that runs on Netlify.
   Zero dependencies. Resolves the web root from __dirname (absolute) so it
   never relies on process.cwd() — avoids sandbox getcwd denials.

   The /api/* routes are handled by netlify/lib/api.mjs — the exact module the
   deployed function uses — so what works here works in production. Content and
   uploads are written to .data/ locally instead of Netlify Blobs. */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = process.env.PORT ? Number(process.env.PORT) : 4321;

// Local-only credentials so the admin can be opened on this machine. On
// Netlify these come from the site's environment variables and there is no
// default — a site without ADMIN_PASSWORD refuses every login.
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "local-dev";
process.env.ADMIN_SECRET = process.env.ADMIN_SECRET || "local-dev-secret";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".cjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

const apiPromise = import("./netlify/lib/api.mjs");

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function handleApiRequest(req, res, url) {
  const { handleApi } = await apiPromise;
  const raw = await readBody(req);
  const contentType = req.headers["content-type"] || "";
  let body = null;
  if (raw.length) {
    body = contentType.includes("application/json")
      ? JSON.parse(raw.toString("utf8") || "{}")
      : raw;
  }

  const result = await handleApi({
    method: req.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
    headers: req.headers,
    body,
  });

  res.writeHead(result.status, result.headers);
  res.end(result.body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  if (url.pathname.startsWith("/api/")) {
    try {
      await handleApiRequest(req, res, url);
    } catch (err) {
      console.error("API error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Server error" }));
    }
    return;
  }

  // Directory URLs (/, /admin, /commercial/, /figurative) serve their
  // index.html — the same thing Netlify does for the built folders.
  let urlPath = decodeURIComponent(url.pathname);
  if (!path.extname(urlPath)) {
    urlPath = `${urlPath.replace(/\/+$/, "")}/index.html`;
  }

  // prevent path traversal
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not found");
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": TYPES[ext] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`portfolio on http://localhost:${PORT}  ·  admin on http://localhost:${PORT}/admin`);
});
