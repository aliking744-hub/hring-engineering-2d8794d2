// Generates the public-route sitemap without any external runtime dependency.
import { writeFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = (process.env.PUBLIC_BASE_URL || "https://hring.ir").replace(/\/$/, "");

interface SitemapEntry {
  path: string;
  changefreq: "weekly" | "monthly";
  priority: string;
}

const entries: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/blog", changefreq: "weekly", priority: "0.8" },
  { path: "/faq", changefreq: "monthly", priority: "0.7" },
  { path: "/product-catalog", changefreq: "monthly", priority: "0.7" },
  { path: "/shop", changefreq: "weekly", priority: "0.6" },
];

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildXml(items: SitemapEntry[]): string {
  const urls = items.map((entry) =>
    [
      "  <url>",
      `    <loc>${xmlEscape(`${BASE_URL}${entry.path}`)}</loc>`,
      `    <changefreq>${entry.changefreq}</changefreq>`,
      `    <priority>${entry.priority}</priority>`,
      "  </url>",
    ].join("\n")
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
  ].join("\n");
}

writeFileSync(resolve("public/sitemap.xml"), buildXml(entries));
console.log(`sitemap.xml written (${entries.length} public routes, base=${BASE_URL})`);
