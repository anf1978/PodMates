import { createServer } from "node:http";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { join, resolve, extname, sep } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { build } from "vite";
import type { DatasetManifest } from "../../src/data/load-dataset";
import { test as base, expect } from "./offline";

type Transfer = { path: string; bytes: number; status: number };
type Deployment = {
  origin: string;
  transfers: Transfer[];
  update: () => Promise<void>;
  disconnect: () => void;
  updateDataset: () => Promise<void>;
  killSwitch: () => Promise<void>;
};

// Serve the real build under the Pages subpath, with HTTP validators and gzip.
// Each test owns its server and update directory; never rewrite the shared preview's dist/.
export const test = base.extend<{ deployment: Deployment }>({
  deployment: async ({}, use) => {
    let root = resolve("dist");
    const updated = await mkdtemp(join(tmpdir(), "podmates-pwa-"));
    const transfers: Transfer[] = [];
    let disconnected = false;
    const overrides = new Map<string, Buffer>();
    const types: Record<string, string> = {
      ".js": "application/javascript",
      ".css": "text/css",
      ".html": "text/html",
      ".json": "application/json",
      ".webmanifest": "application/manifest+json",
      ".png": "image/png",
    };
    const server = createServer(async (request, response) => {
      if (disconnected) {
        request.socket.destroy();
        return;
      }
      const url = new URL(request.url!, "http://localhost");
      const path = resolve(
        root,
        `.${sep}${decodeURIComponent(url.pathname.slice("/PodMates/".length)) || "index.html"}`,
      );
      if (!url.pathname.startsWith("/PodMates/") || !path.startsWith(`${root}${sep}`)) {
        response.writeHead(404).end();
        return;
      }
      let body: Buffer;
      try {
        body = overrides.get(url.pathname) ?? (await readFile(path));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        response.writeHead(404).end();
        return;
      }
      const etag = `"${createHash("sha256").update(body).digest("hex")}"`;
      if (request.headers["if-none-match"] === etag) {
        transfers.push({ path: url.pathname, bytes: 0, status: 304 });
        response.writeHead(304, { ETag: etag }).end();
        return;
      }
      const compressed = gzipSync(body);
      transfers.push({ path: url.pathname, bytes: compressed.length, status: 200 });
      response
        .writeHead(200, {
          "Content-Type": types[extname(path)] ?? "application/octet-stream",
          "Content-Encoding": "gzip",
          "Cache-Control": "no-cache",
          ETag: etag,
        })
        .end(compressed);
    });
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    try {
      await use({
        transfers,
        disconnect: () => {
          disconnected = true;
        },
        updateDataset: async () => {
          const tags = Buffer.concat([
            await readFile(join(root, "data", "tags.json")),
            Buffer.from("\n"),
          ]);
          const manifest: DatasetManifest = JSON.parse(
            await readFile(join(root, "data", "manifest.json"), "utf8"),
          );
          const hash = createHash("sha256").update(tags).digest("hex");
          manifest.files["tags.json"] = {
            ...manifest.files["tags.json"],
            sha256: hash,
            version: hash.slice(0, 12),
            bytes: tags.length,
          };
          overrides.set("/PodMates/data/tags.json", tags);
          overrides.set("/PodMates/data/manifest.json", Buffer.from(JSON.stringify(manifest)));
        },
        killSwitch: async () => {
          overrides.set("/PodMates/sw.js", await readFile(resolve("scripts", "sw-kill-switch.js")));
        },
        update: async () => {
          await build({
            logLevel: "error",
            build: { outDir: updated, emptyOutDir: true },
            plugins: [
              {
                name: "test-code-change",
                transform(code, id) {
                  if (id.endsWith("/src/main.ts"))
                    return `${code}\nconsole.info("PWA update fixture");`;
                },
              },
            ],
          });
          root = updated;
        },
        // The baseURL fixture gets the ephemeral server port without a second global.
        get origin() {
          const address = server.address();
          if (!address || typeof address === "string") throw new Error("PWA server not listening");
          return `http://127.0.0.1:${address.port}`;
        },
      });
    } finally {
      await new Promise<void>((done, reject) => {
        server.close((error) => (error ? reject(error) : done()));
        server.closeAllConnections();
      });
      await rm(updated, { recursive: true, force: true });
    }
  },
  baseURL: async ({ deployment }, use) => {
    await use(deployment.origin);
  },
});

export { expect };
