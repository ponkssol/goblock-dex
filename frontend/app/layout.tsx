import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import { PageMotion } from "./page-motion";
import { Providers } from "./providers";
import { OG_IMAGE, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, siteOrigin } from "./site";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "Solana swap",
    "Solana DEX aggregator",
    "best price swap",
    "Raydium",
    "Orca",
    "Meteora",
    "PumpSwap",
    "pump.fun",
    "swap API",
    "goblock",
  ],
  category: "finance",
  creator: SITE_NAME,
  publisher: SITE_NAME,
  formatDetection: { telephone: false, email: false, address: false },
  icons: {
    icon: [{ url: "/goblock-logo.png", type: "image/png", sizes: "500x500" }],
    apple: [{ url: "/goblock-logo.png", sizes: "500x500" }],
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#090d10",
  colorScheme: "dark",
};

const STRUCTURED = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteOrigin()}/#organization`,
      name: SITE_NAME,
      url: siteOrigin(),
      logo: `${siteOrigin()}/goblock-logo.png`,
    },
    {
      "@type": "WebSite",
      "@id": `${siteOrigin()}/#website`,
      name: SITE_NAME,
      url: siteOrigin(),
      description: SITE_DESCRIPTION,
      publisher: { "@id": `${siteOrigin()}/#organization` },
      inLanguage: "en",
    },
    {
      "@type": "WebApplication",
      name: SITE_NAME,
      url: `${siteOrigin()}/trade`,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      description: SITE_DESCRIPTION,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@id": `${siteOrigin()}/#organization` },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const projectId = process.env.REOWN_API_KEY ?? "";
  return (
    <html lang="en" className={`${inter.variable} ${interTight.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED).replace(/</g, "\\u003c") }}
        />
        <Providers projectId={projectId}>
          <PageMotion>{children}</PageMotion>
        </Providers>
      </body>
    </html>
  );
}
