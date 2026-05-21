import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const preferredPort = Number(process.env.PORT || 4173);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

function createStaticServer(port) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://localhost:${port}`);
      const safePath = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
      const filePath = join(root, safePath === "/" ? "index.html" : safePath);
      const data = await readFile(filePath);
      res.writeHead(200, {
        "Content-Type": types[extname(filePath)] || "application/octet-stream",
        "Cache-Control": "no-store"
      });
      res.end(data);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
    }
  });
}

function listen(port) {
  const server = createStaticServer(port);
  server.once("error", (error) => {
    if (error.code === "EADDRINUSE") {
      server.close();
      listen(port + 1);
      return;
    }
    throw error;
  });
  server.listen(port, () => {
    server.removeAllListeners("error");
    console.log(`Lottery picker running at http://localhost:${port}`);
  });
}

listen(preferredPort);
