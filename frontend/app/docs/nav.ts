import { pageMeta } from "../site";

export type DocLink = { href: string; title: string; lead: string };
export type DocGroup = { title: string; links: DocLink[] };

export const DOC_GROUPS: DocGroup[] = [
  {
    title: "Get started",
    links: [
      {
        href: "/docs",
        title: "Introduction",
        lead: "Integrate Solana swaps into your app with one API.",
      },
      {
        href: "/docs/quickstart",
        title: "Quickstart",
        lead: "Quote, sign, and send your first swap in a few lines of code.",
      },
      {
        href: "/docs/authentication",
        title: "Authentication",
        lead: "Every request to the API carries your key in one header.",
      },
    ],
  },
  {
    title: "Swap API",
    links: [
      {
        href: "/docs/swap",
        title: "Quote a swap",
        lead: "One GET compares every venue and returns the route that pays the wallet the most.",
      },
      {
        href: "/docs/response",
        title: "Response",
        lead: "Every field the quote returns, and what it means for the wallet.",
      },
      {
        href: "/docs/sign",
        title: "Sign and send",
        lead: "Turn the quote into a signature in the user's own wallet.",
      },
      {
        href: "/docs/routing",
        title: "Routing",
        lead: "How goblock compares five venues and three shapes of route.",
      },
    ],
  },
  {
    title: "Fees and plans",
    links: [
      {
        href: "/docs/brand-link",
        title: "Brand link",
        lead: "Share a link with your name on it and earn on every landed swap.",
      },
      {
        href: "/docs/plans",
        title: "Plans and limits",
        lead: "Plans differ by request cap. None of them adds a fee to the swap.",
      },
    ],
  },
  {
    title: "Reference",
    links: [
      {
        href: "/docs/errors",
        title: "Errors",
        lead: "Status codes, and the message you can show to the user.",
      },
    ],
  },
];

export const DOC_LINKS = DOC_GROUPS.flatMap((group) => group.links.map((link) => ({ ...link, group: group.title })));

export function docFor(href: string) {
  return DOC_LINKS.find((link) => link.href === href);
}

export function docMeta(href: string) {
  const doc = docFor(href);
  return pageMeta({
    title: `${doc?.title ?? "Docs"} · goblock docs`,
    description: doc?.lead ?? "goblock swap API documentation.",
    path: href,
  });
}
