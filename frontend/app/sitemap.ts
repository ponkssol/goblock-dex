import type { MetadataRoute } from "next";
import { DOC_LINKS } from "./docs/nav";
import { siteOrigin } from "./site";

const PAGES: [string, number, MetadataRoute.Sitemap[number]["changeFrequency"]][] = [
  ["/", 1, "weekly"],
  ["/trade", 0.9, "daily"],
  ["/pricing", 0.8, "monthly"],
  ["/docs", 0.8, "weekly"],
  ["/mcp", 0.7, "monthly"],
];

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  const lastModified = new Date();
  const docs = DOC_LINKS.filter((doc) => doc.href !== "/docs").map((doc) => ({
    url: `${origin}${doc.href}`,
    lastModified,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
  return [
    ...PAGES.map(([path, priority, changeFrequency]) => ({
      url: `${origin}${path === "/" ? "" : path}`,
      lastModified,
      changeFrequency,
      priority,
    })),
    ...docs,
  ];
}
