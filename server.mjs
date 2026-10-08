import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFile, realpath, stat } from "node:fs/promises";
import { Readable } from "node:stream";

const PORT = Number(process.env.PORT ?? 8080);
const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
const FRONTEND_ORIGIN = "https://pokerogue.net";
const API_ORIGIN = "https://api.pokerogue.net";
const API_PREFIXES = ["/account/", "/game/", "/savedata/", "/daily/", "/auth/", "/admin/"];
const METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
const MAX_REWRITE_BYTES = 32 * 1024 * 1024;
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);
const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".m4a", "audio/mp4"],
  [".map", "application/json; charset=utf-8"],
  [".mp3", "audio/mpeg"],
  [".mp4", "video/mp4"],
  [".ogg", "audio/ogg"],
  [".otf", "font/otf"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".ttf", "font/ttf"],
  [".wav", "audio/wav"],
  [".webm", "video/webm"],
  [".webmanifest", "application/manifest+json"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".wasm", "application/wasm"],
]);

function sendText(res, status, text, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(text);
}

function isApiPath(pathname) {
  return API_PREFIXES.some((prefix) => pathname === prefix.slice(0, -1) || pathname.startsWith(prefix));
}

function requestHeaders(req) {
  const connectionTokens = String(req.headers.connection ?? "")
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  const blocked = new Set([
    ...HOP_BY_HOP,
    ...connectionTokens,
    "host",
    "content-length",
    "accept-encoding",
    "cookie",
  ]);
  const headers = new Headers();

  for (const [name, rawValue] of Object.entries(req.headers)) {
    const key = name.toLowerCase();
    if (blocked.has(key) || rawValue === undefined) continue;
    headers.set(key, Array.isArray(rawValue) ? rawValue.join(", ") : rawValue);
  }

  // The official API expects the official site's browser Origin. Account tokens in
  // Authorization are forwarded, but cookies are not stored or relayed by this app.
  headers.set("origin", FRONTEND_ORIGIN);
  headers.set("referer", `${FRONTEND_ORIGIN}/`);
  headers.set("sec-fetch-site", "same-site");
  headers.set("sec-fetch-mode", "cors");
  headers.set("sec-fetch-dest", "empty");
  return headers;
}

function rewriteApiScript(originalBytes) {
  const original = originalBytes.toString("utf8");
  // Keep the registered OAuth callback URI intact. This callback is an intentional
  // redirect to PokeRogue's official API host; ordinary API calls use this app's origin.
  const oauthCallbacks = [];
  let source = original.replace(
    /`https:\/\/api\.pokerogue\.net\/auth\/\$\{[^}]+\}\/callback`/g,
    (callback) => {
      const token = `__POKEROGUE_OAUTH_CALLBACK_${oauthCallbacks.length}__`;
      oauthCallbacks.push(callback);
      return token;
    },
  );

  const escapedApiOrigin = API_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let rewritten = source.replaceAll(`\`${API_ORIGIN}`, "`${window.location.origin}");
  const doubleQuotedApiOrigin = new RegExp(`\"${escapedApiOrigin}([^\"]*)\"`, "g");
  const singleQuotedApiOrigin = new RegExp(`'${escapedApiOrigin}([^']*)'`, "g");
  const rewriteQuotedApiUrl = (_match, suffix) =>
    suffix ? `window.location.origin + ${JSON.stringify(suffix)}` : "window.location.origin";
  rewritten = rewritten.replace(doubleQuotedApiOrigin, rewriteQuotedApiUrl);
  rewritten = rewritten.replace(singleQuotedApiOrigin, rewriteQuotedApiUrl);

  if (rewritten.includes(API_ORIGIN)) {
    throw new Error("upstream API address changed format");
  }
  oauthCallbacks.forEach((callback, index) => {
    rewritten = rewritten.replace(`__POKEROGUE_OAUTH_CALLBACK_${index}__`, callback);
  });

  return {
    body: rewritten === original ? originalBytes : Buffer.from(rewritten, "utf8"),
    changed: rewritten !== original,
  };
}

function outgoingApiHeaders(response, didRewrite) {
  const headers = {};
  const connectionTokens = String(response.headers.get("connection") ?? "")
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  const blocked = new Set([
    ...HOP_BY_HOP,
    ...connectionTokens,
    "content-length",
    "content-encoding",
    "content-md5",
    "set-cookie",
  ]);

  for (const [name, value] of response.headers) {
    const key = name.toLowerCase();
    if (!blocked.has(key)) headers[key] = value;
  }

  const setCookies = response.headers.getSetCookie?.() ?? [];
  if (setCookies.length > 0) {
    headers["set-cookie"] = setCookies.map((cookie) => cookie.replace(/;\s*domain=[^;]*/gi, ""));
  }

  headers["cache-control"] = "no-store";
  if (didRewrite) {
    delete headers.etag;
    delete headers["last-modified"];
  }
  return headers;
}

function rewriteLocation(location, baseUrl) {
  try {
    const destination = new URL(location, baseUrl);
    if (destination.origin === FRONTEND_ORIGIN) {
      return `/game-site${destination.pathname}${destination.search}${destination.hash}`;
    }
    if (destination.origin === API_ORIGIN) {
      return `${destination.pathname}${destination.search}${destination.hash}`;
    }
  } catch {
    // Leave malformed locations unchanged; the request Host never selects an upstream.
  }
  return location;
}

async function proxyApiRequest(req, res, url) {
  const upstreamUrl = new URL(`${url.pathname}${url.search}`, API_ORIGIN);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  req.once("aborted", () => controller.abort());

  try {
    const init = {
      method: req.method,
      headers: requestHeaders(req),
      redirect: "manual",
      signal: controller.signal,
    };
    if (req.method !== "GET" && req.method !== "HEAD") {
      init.body = req;
      init.duplex = "half";
    }

    const upstream = await fetch(upstreamUrl, init);
    const headers = outgoingApiHeaders(upstream, false);
    const location = upstream.headers.get("location");
    if (location) headers.location = rewriteLocation(location, upstreamUrl);

    res.writeHead(upstream.status, headers);
    if (req.method === "HEAD" || upstream.status === 204 || upstream.status === 304 || !upstream.body) {
      res.end();
    } else {
      const stream = Readable.fromWeb(upstream.body);
      stream.on("error", () => {
        if (!res.destroyed) res.destroy();
      });
      stream.pipe(res);
    }
  } finally {
    clearTimeout(timeout);
  }
}

function cacheControlFor(relativePath) {
  if (relativePath === "index.html" || relativePath === "game-site/index.html") return "no-store";
  if (relativePath.endsWith("service-worker.js") || relativePath.endsWith("asset-manifest.json")) return "no-cache";
  if (/[.-][a-zA-Z0-9_-]{8,}\./.test(path.basename(relativePath))) {
    return "public, max-age=31536000, immutable";
  }
  return "public, max-age=300";
}

function parseByteRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header ?? "");
  if (!match || (!match[1] && !match[2])) return null;
  let start;
  let end;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return null;
  return { start, end: Math.min(end, size - 1) };
}

async function serveStatic(req, res, url) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("allow", "GET, HEAD");
    sendText(res, 405, "Method not allowed");
    return;
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(url.pathname);
  } catch {
    sendText(res, 400, "Bad path");
    return;
  }
  if (decodedPath.includes("\0") || decodedPath.includes("\\") || decodedPath.split("/").some((part) => part === ".." || part === ".")) {
    sendText(res, 400, "Bad path");
    return;
  }

  let relativePath = decodedPath.replace(/^\/+/, "") || "index.html";
  if (relativePath.endsWith("/")) relativePath += "index.html";
  const candidate = path.resolve(PUBLIC_DIR, relativePath);
  try {
    const root = await realpath(PUBLIC_DIR);
    const filePath = await realpath(candidate);
    if (!filePath.startsWith(`${root}${path.sep}`)) {
      sendText(res, 404, "Not found");
      return;
    }

    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      sendText(res, 404, "Not found");
      return;
    }

    let jsResult = null;
    if (path.extname(filePath).toLowerCase() === ".js") {
      if (fileStat.size > MAX_REWRITE_BYTES) {
        sendText(res, 500, "Frontend script exceeds the proxy rewrite limit.");
        return;
      }
      jsResult = rewriteApiScript(await readFile(filePath));
    }

    const etag = `W/"${fileStat.size.toString(16)}-${Math.trunc(fileStat.mtimeMs).toString(16)}"`;
    const headers = {
      "content-type": MIME_TYPES.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream",
      "cache-control": jsResult?.changed ? "no-store" : cacheControlFor(relativePath),
      "x-content-type-options": "nosniff",
      "accept-ranges": "bytes",
      "last-modified": fileStat.mtime.toUTCString(),
    };
    if (jsResult?.changed) {
      // Rewritten bytes differ from the build artifact; do not validate/cache them under its ETag.
    } else {
      headers.etag = etag;
    }

    const ifNoneMatch = String(req.headers["if-none-match"] ?? "").split(",").map((value) => value.trim());
    if (!jsResult?.changed && (ifNoneMatch.includes("*") || ifNoneMatch.includes(etag))) {
      res.writeHead(304, headers);
      res.end();
      return;
    }

    const bodyBuffer = jsResult?.body ?? null;
    const size = bodyBuffer?.length ?? fileStat.size;
    const rangeHeader = req.headers.range;
    const ifRange = req.headers["if-range"];
    const allowRange = rangeHeader && (!ifRange || ifRange === etag) && !bodyBuffer;
    let range = null;
    if (allowRange) {
      range = parseByteRange(String(rangeHeader), size);
      if (!range) {
        res.writeHead(416, { ...headers, "content-range": `bytes */${size}` });
        res.end();
        return;
      }
    }

    const status = range ? 206 : 200;
    const responseSize = range ? range.end - range.start + 1 : size;
    headers["content-length"] = String(responseSize);
    if (range) headers["content-range"] = `bytes ${range.start}-${range.end}/${size}`;
    res.writeHead(status, headers);
    if (req.method === "HEAD") {
      res.end();
    } else if (bodyBuffer) {
      res.end(bodyBuffer);
    } else {
      const stream = createReadStream(filePath, range ? { start: range.start, end: range.end } : undefined);
      stream.on("error", () => {
        if (!res.destroyed) res.destroy();
      });
      stream.pipe(res);
    }
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
      sendText(res, 404, "Not found");
      return;
    }
    if (!res.headersSent) sendText(res, 500, "Static file unavailable");
    else if (!res.destroyed) res.destroy();
    console.error(`[static] file request failed (${error?.name ?? "Error"})`);
  }
}

async function handle(req, res) {
  if (!METHODS.has(req.method ?? "")) {
    res.setHeader("allow", [...METHODS].join(", "));
    sendText(res, 405, "Method not allowed");
    return;
  }

  let url;
  try {
    // A fixed parsing base; never use the request Host to select an upstream.
    url = new URL(req.url ?? "/", "http://proxy.invalid");
  } catch {
    sendText(res, 400, "Bad request");
    return;
  }

  if (url.pathname === "/_health") {
    sendText(res, 200, "ok");
    return;
  }

  if (url.pathname === "/manus-routes.json") {
    await serveStatic(req, res, new URL("/manus-routes.json", "http://proxy.invalid"));
    return;
  }

  if (url.pathname === "/game-site") {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.setHeader("allow", "GET, HEAD");
      sendText(res, 405, "Method not allowed");
      return;
    }
    res.writeHead(308, { location: `/game-site/${url.search}`, "cache-control": "no-store" });
    res.end();
    return;
  }

  if (isApiPath(url.pathname)) {
    try {
      await proxyApiRequest(req, res, url);
    } catch (error) {
      if (!res.headersSent) sendText(res, 502, "The upstream PokeRogue API is temporarily unavailable.");
      else if (!res.destroyed) res.destroy();
      // Intentionally omit URL, headers, credentials, and body from logs.
      console.error(`[proxy] upstream request failed (${error?.name ?? "Error"})`);
    }
    return;
  }

  await serveStatic(req, res, url);
}

const server = createServer((req, res) => {
  void handle(req, res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`PokeRogue proxy listening on 0.0.0.0:${PORT}`);
});
