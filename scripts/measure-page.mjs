import http from "node:http";
import https from "node:https";
import { promisify } from "node:util";
import { brotliDecompress, gunzip, inflate } from "node:zlib";

const decompressors = {
  br: promisify(brotliDecompress),
  gzip: promisify(gunzip),
  deflate: promisify(inflate),
};
const target = new URL(process.argv[2] || "http://127.0.0.1:3010/");
const samples = Number(process.argv[3] || 3);

if (!['http:', 'https:'].includes(target.protocol) ||
    !Number.isInteger(samples) || samples < 1 || samples > 10) {
  throw new Error("Usage: node scripts/measure-page.mjs <http(s) URL> [1-10 samples]");
}

const transport = target.protocol === "https:" ? https : http;
const agent = new transport.Agent({ keepAlive: true });
const round = (value) => Math.round(value * 10) / 10;
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

async function measure() {
  const start = performance.now();
  return new Promise((resolve, reject) => {
    const request = transport.get(target, {
      agent,
      headers: { "Accept-Encoding": "br, gzip, deflate" },
    }, (response) => {
      const ttfbMs = performance.now() - start;
      const chunks = [];
      let size = 0;
      response.on("data", (chunk) => {
        size += chunk.length;
        if (size > 10 * 1024 * 1024) {
          response.destroy(new Error("Page exceeded the 10 MB measurement limit"));
        } else {
          chunks.push(chunk);
        }
      });
      response.on("error", reject);
      response.on("end", async () => {
        try {
          const totalMs = performance.now() - start;
          const compressed = Buffer.concat(chunks);
          const encoding = String(response.headers["content-encoding"] || "identity");
          const decoded = decompressors[encoding]
            ? await decompressors[encoding](compressed)
            : compressed;
          const html = decoded.toString("utf8");
          const fontPreloads = new Set([
            ...[...html.matchAll(/<link\b[^>]*\bas="font"[^>]*>/gi)]
              .map(([tag]) => tag.match(/\bhref="([^"]+)"/i)?.[1]),
            ...[...String(response.headers.link || "").matchAll(/<([^>]+)>[^,]*\bas="?font\b/gi)]
              .map((match) => match[1]),
          ].filter(Boolean));
          resolve({
            status: response.statusCode,
            reusedConnection: request.reusedSocket,
            ttfbMs: round(ttfbMs),
            totalMs: round(totalMs),
            transferredBytes: compressed.length,
            htmlBytes: decoded.length,
            encoding,
            cacheControl: response.headers["cache-control"] || null,
            pageCache: response.headers["x-nextjs-cache"] || null,
            imageCount: (html.match(/<img\b/g) || []).length,
            responsiveImageCount: (html.match(/<img\b[^>]*\bsrcset=/gi) || []).length,
            fontPreloadCount: fontPreloads.size,
            scriptCount: (html.match(/<script\b[^>]*\bsrc=/gi) || []).length,
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.setTimeout(30000, () => request.destroy(new Error("Page request timed out")));
    request.on("error", reject);
  });
}

try {
  const measurements = [];
  for (let index = 0; index < samples; index += 1) {
    measurements.push(await measure());
  }
  console.log(JSON.stringify({
    url: `${target.origin}${target.pathname}`,
    note: "HTTP measurements from this machine; not browser load times or Core Web Vitals.",
    medianTtfbMs: round(median(measurements.map((item) => item.ttfbMs))),
    measurements,
  }, null, 2));
  if (measurements.some((item) => item.status !== 200)) process.exitCode = 1;
} finally {
  agent.destroy();
}
