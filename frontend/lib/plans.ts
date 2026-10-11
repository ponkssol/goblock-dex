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
    id: "fee",
    name: "Pay per swap",
    price: "5 bps",
    period: "/ swap",
    cap: "No monthly bill",
    detail: "Apps that would rather share swap fees than pay a bill.",
    perks: ["Half of the fee to your wallet", "Paid only on a landed swap", "All five venues", "Quote and transaction in one call"],
    cta: "Start with Fees",
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
