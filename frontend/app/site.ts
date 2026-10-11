import type { Metadata } from "next";

export const SITE_NAME = "goblock";
export const SITE_TITLE = "goblock · Best-price Solana swaps";
export const SITE_DESCRIPTION =
  "goblock compares Raydium, Orca, Meteora, PumpSwap, and the Pump bonding curve in one quote, then you sign the better Solana swap in your own wallet.";
export const OG_IMAGE = { url: "/og.png", width: 1200, height: 630, alt: "goblock, best-price Solana swaps" };

export function siteOrigin() {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const origin =
    process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || (vercel ? `https://${vercel}` : "") || "http://localhost:3000";
  return origin.replace(/\/+$/, "");
}

export function pageMeta({
  title,
  description,
  path,
  keywords,
}: {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
}): Metadata {
  return {
    title,
    description,
    keywords,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_US",
      title,
      description,
      url: path,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE.url],
    },
  };
}
