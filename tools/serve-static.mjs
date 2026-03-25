import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
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
  const server = createServer(async (req, res) => {
    const { pathname } = new URL(req.url ?? "/", "http://localhost");
    const urlPath = decodeURIComponent(pathname);

    let filePath;

    if (routes) {
      const matchedPrefix = Object.keys(routes).find(
        (prefix) => urlPath.startsWith(prefix + "/") || urlPath === prefix,
      );
      if (matchedPrefix) {
        const relativePart = urlPath.slice(matchedPrefix.length);
        filePath = join(routes[matchedPrefix], relativePart);
      }
    }

    if (!filePath) {
      filePath = join(root, urlPath);
    }

    async function tryServe(path) {
      let resolvedPath = path;

      // If path ends with a directory separator or has no extension, try index.html
      if (resolvedPath.endsWith("/") || resolvedPath.endsWith("\\")) {
        resolvedPath = join(resolvedPath, "index.html");
      }

      let data;
      try {
        data = await readFile(resolvedPath);
      } catch {
        // Check if it's a directory by trying index.html
        try {
          data = await readFile(join(resolvedPath, "index.html"));
          resolvedPath = join(resolvedPath, "index.html");
        } catch {
          return null;
        }
      }

      const ext = extname(resolvedPath).toLowerCase();
      const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType });
      res.end(data);
      return true;
    }

    const served = await tryServe(filePath);
    if (served) return;

    // SPA fallback
    if (fallback) {
      const fallbackPath = join(root, fallback);
      const fallbackServed = await tryServe(fallbackPath);
      if (fallbackServed) return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end(`404 Not Found: ${urlPath}`);
  });

  server.listen(port, "127.0.0.1", () => {
    const address = server.address();
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
