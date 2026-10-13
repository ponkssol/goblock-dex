export type Plan = {
  id: string;
  name: string;
  price: string;
  period: string;
  cap: string;
  detail: string;
  perks: string[];
  cta: string;
  featured?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "/ month",
    cap: "10 requests / min",
    detail: "A key in one call. A small fee on the SOL side of the swap pays for it.",
    perks: ["0 bps on stablecoins and LSTs", "3 to 5 bps on pool tokens", "20 bps on bonding-curve coins", "Add your own fee on top"],
    cta: "Get a Free Key",
  },
  {
    id: "builder",
    name: "Builder",
    price: "$20",
    period: "/ month",
    cap: "30 requests / min",
    detail: "A script or a single bot that quotes now and then.",
    perks: ["One API key", "Quote and transaction in one call", "All five venues", "No goblock fee on the swap"],
    cta: "Get Builder",
  },
  {
    id: "starter",
    name: "Starter",
    price: "$99",
    period: "/ month",
    cap: "120 requests / min",
    detail: "Bots and apps that quote through the whole day.",
    perks: ["Everything in Builder", "Four times the request cap", "Room for an always-on bot", "No goblock fee on the swap"],
    cta: "Get Starter",
    featured: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "",
    cap: "Custom request cap",
    detail: "Wallets, terminals, and desks that quote for many users.",
    perks: ["Everything in Starter", "A cap sized to your traffic", "Separate keys per app", "Set up with the goblock team"],
    cta: "Contact us",
  },
];

export function planHref(id: string) {
  if (id === "builder" || id === "starter") return `/checkout?plan=${id}`;
  if (id === "free") return "/dashboard";
  return "/docs/plans";
}
