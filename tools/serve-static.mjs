import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { spawn } from "node:child_process";

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

/** Verify that a resolved file path stays within the allowed root directory. */
function isPathContained(filePath, allowedRoot) {
  const resolved = resolve(filePath);
  const root = resolve(allowedRoot);
  return resolved === root || resolved.startsWith(root + sep);
}

/**
 * Serve a directory over HTTP and open the browser.
 *
 * @param {string} root  Absolute path to the directory to serve.
 * @param {object} [opts]
 * @param {number} [opts.port=0]  Port to listen on (0 = OS-assigned).
 * @param {boolean} [opts.open=true]  Open browser automatically.
 * @param {string} [opts.fallback]  Path (relative to root) to serve for unknown routes.
 * @param {Record<string, string>} [opts.routes]  URL prefix -> filesystem directory map.
 */
export function serveStatic(root, { port = 0, open = true, fallback, routes } = {}) {
  // Pre-sort route prefixes by length descending so longer prefixes match first.
  // Done once at startup rather than per-request.
  const sortedRoutePrefixes = routes ? Object.keys(routes).toSorted((a, b) => b.length - a.length) : [];

  const server = createServer((req, res) => {
    handleRequest(req, res, root, { fallback, routes, sortedRoutePrefixes }).catch((err) => {
      console.error("Request handler error:", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
      }
    });
  });

  server.listen(port, "127.0.0.1", () => {
    const address = server.address();
    if (!address || typeof address === "string") {
      console.error("Unexpected server address:", address);
      return;
    }
    const url = `http://localhost:${address.port}`;
    console.log(`Serving ${root}`);
    console.log(`Listening on ${url}`);
    console.log("Press Ctrl+C to stop.\n");

    if (open) {
      if (process.platform === "win32") {
        spawn("cmd", ["/c", "start", url], { detached: true, stdio: "ignore" }).unref();
      } else {
        const cmd = process.platform === "darwin" ? "open" : "xdg-open";
        spawn(cmd, [url], { detached: true, stdio: "ignore" }).unref();
      }
    }
  });

  return server;
}

async function handleRequest(req, res, root, { fallback, routes, sortedRoutePrefixes }) {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  const urlPath = decodeURIComponent(pathname);

  let filePath;
  let containmentRoot = root;

  if (routes) {
    const matchedPrefix = sortedRoutePrefixes.find((prefix) => urlPath.startsWith(prefix + "/") || urlPath === prefix);
    if (matchedPrefix) {
      const relativePart = urlPath.slice(matchedPrefix.length);
      filePath = join(routes[matchedPrefix], relativePart);
      containmentRoot = routes[matchedPrefix];
    }
  }

  if (!filePath) {
    filePath = join(root, urlPath);
  }

  // Prevent path traversal outside the intended directory
  if (!isPathContained(filePath, containmentRoot)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("403 Forbidden");
    return;
  }

  const served = await tryServe(filePath, res);
  if (served) return;

  // SPA fallback
  if (fallback) {
    const fallbackPath = join(root, fallback);
    const fallbackServed = await tryServe(fallbackPath, res);
    if (fallbackServed) return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end(`404 Not Found: ${urlPath}`);
}

async function tryServe(path, res) {
  let resolvedPath = path;

  if (resolvedPath.endsWith("/")) {
    resolvedPath = join(resolvedPath, "index.html");
  }

  let data;
  try {
    data = await readFile(resolvedPath);
  } catch {
    try {
      data = await readFile(join(resolvedPath, "index.html"));
      resolvedPath = join(resolvedPath, "index.html");
    } catch {
      return false;
    }
  }

  const ext = extname(resolvedPath).toLowerCase();
  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
  res.writeHead(200, { "Content-Type": contentType });
  res.end(data);
  return true;
}
