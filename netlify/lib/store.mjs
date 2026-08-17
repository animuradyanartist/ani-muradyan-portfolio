/**
 * Where the content and the uploaded images live.
 *
 * On Netlify: Netlify Blobs — no database to run, no build needed to publish a
 * change, and the same store is shared by every function instance.
 * Locally (node server.cjs): plain files under .data/, so the admin can be run
 * and tested on this machine without any cloud service.
 *
 * Either way the shape is identical, so the code above this file never knows
 * which one it is talking to.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SEED_FILE = path.join(ROOT, "content.json");
const LOCAL_DIR = path.join(ROOT, ".data");
const LOCAL_CONTENT = path.join(LOCAL_DIR, "content.json");
const LOCAL_IMAGES = path.join(LOCAL_DIR, "images");

const CONTENT_KEY = "content.json";

let blobsPromise;

/** Netlify Blobs when it is available and configured; null when running locally. */
async function blobs() {
  if (blobsPromise === undefined) {
    blobsPromise = (async () => {
      if (!process.env.NETLIFY && !process.env.NETLIFY_BLOBS_CONTEXT) return null;
      try {
        const { getStore } = await import("@netlify/blobs");
        return {
          content: getStore("portfolio-content"),
          images: getStore("portfolio-images"),
        };
      } catch (err) {
        console.error("[store] Netlify Blobs unavailable, falling back to local files:", err);
        return null;
      }
    })();
  }
  return blobsPromise;
}

/** The content committed in the repo — the starting point before any edit. */
export async function readSeed() {
  return JSON.parse(await fs.readFile(SEED_FILE, "utf8"));
}

/** Saved content if the artist has ever saved; otherwise the committed seed. */
export async function readContent() {
  const store = await blobs();
  if (store) {
    const saved = await store.content.get(CONTENT_KEY, { type: "json" });
    if (saved) return saved;
    return readSeed();
  }
  try {
    return JSON.parse(await fs.readFile(LOCAL_CONTENT, "utf8"));
  } catch {
    return readSeed();
  }
}

export async function writeContent(content) {
  const store = await blobs();
  if (store) {
    await store.content.setJSON(CONTENT_KEY, content);
    return;
  }
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  await fs.writeFile(LOCAL_CONTENT, JSON.stringify(content, null, 2));
}

const safeKey = (key) => String(key).replace(/[^a-zA-Z0-9._-]/g, "");

export async function putImage(key, buffer, contentType) {
  const name = safeKey(key);
  const store = await blobs();
  if (store) {
    await store.images.set(name, buffer, { metadata: { contentType } });
  } else {
    await fs.mkdir(LOCAL_IMAGES, { recursive: true });
    await fs.writeFile(path.join(LOCAL_IMAGES, name), buffer);
    await fs.writeFile(path.join(LOCAL_IMAGES, `${name}.type`), contentType || "image/jpeg");
  }
  return `/api/images/${name}`;
}

export async function getImage(key) {
  const name = safeKey(key);
  const store = await blobs();
  if (store) {
    const result = await store.images.getWithMetadata(name, { type: "arrayBuffer" });
    if (!result) return null;
    return {
      body: Buffer.from(result.data),
      contentType: result.metadata?.contentType || "application/octet-stream",
    };
  }
  try {
    const body = await fs.readFile(path.join(LOCAL_IMAGES, name));
    let contentType = "image/jpeg";
    try {
      contentType = await fs.readFile(path.join(LOCAL_IMAGES, `${name}.type`), "utf8");
    } catch {
      /* default is fine */
    }
    return { body, contentType };
  } catch {
    return null;
  }
}
