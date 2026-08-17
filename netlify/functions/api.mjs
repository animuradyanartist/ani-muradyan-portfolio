/**
 * Netlify entry point for the admin API.
 *
 * A Functions 2.0 handler: `config.path` claims every /api/* URL, so the
 * function sees the real request path and can hand it straight to the shared
 * router in ../lib/api.mjs (the same router server.cjs uses locally).
 */
import { handleApi } from "../lib/api.mjs";

export default async function handler(request) {
  const url = new URL(request.url);
  const headers = Object.fromEntries(request.headers.entries());

  let body = null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    const contentType = headers["content-type"] || "";
    if (contentType.includes("application/json")) {
      body = await request.json().catch(() => ({}));
    } else {
      body = Buffer.from(await request.arrayBuffer());
    }
  }

  const result = await handleApi({
    method: request.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
    headers,
    body,
  });

  return new Response(result.body, { status: result.status, headers: result.headers });
}

export const config = { path: "/api/*" };
