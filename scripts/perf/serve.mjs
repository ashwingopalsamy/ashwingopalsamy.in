// Static server for a built dist/ that approximates the edge: brotli for text assets, 404.html
// fallback, 301 for a directory requested without a trailing slash, immutable cache on /_astro/.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import zlib from "node:zlib";

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".json": "application/json",
  ".xml": "application/xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".wasm": "application/wasm",
  ".pf_meta": "application/octet-stream",
};

export async function startServer(distDir, port) {
  const root = path.resolve(distDir);
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let f = path.join(root, p);
    if (p.endsWith("/")) f = path.join(f, "index.html");
    const inRoot = f.startsWith(root + path.sep);
    if (!inRoot || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      if (inRoot && fs.existsSync(`${f}/index.html`)) {
        res.writeHead(301, { location: `${p}/` });
        return res.end();
      }
      f = path.join(root, "404.html");
      res.statusCode = 404;
    }
    const ext = path.extname(f);
    const body = fs.readFileSync(f);
    const headers = { "content-type": types[ext] || "application/octet-stream" };
    if (p.startsWith("/_astro/")) headers["cache-control"] = "public, max-age=31536000, immutable";
    if (/\.(html|js|css|svg|json|xml|txt|md)$/.test(ext) && (req.headers["accept-encoding"] || "").includes("br")) {
      headers["content-encoding"] = "br";
      res.writeHead(res.statusCode || 200, headers);
      return res.end(
        zlib.brotliCompressSync(body, {
          params: { [zlib.constants.BROTLI_PARAM_QUALITY]: ext === ".html" ? 5 : 11 },
        }),
      );
    }
    res.writeHead(res.statusCode || 200, headers);
    res.end(body);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    close: () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  };
}
