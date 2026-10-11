import { solana } from "@reown/appkit/networks";
import { createAppKit } from "@reown/appkit/react";
import { SolanaAdapter } from "@reown/appkit-adapter-solana/react";
import { kitProject } from "./kit-config";
import { siteOrigin } from "./site";
import { connectionConfig } from "./solana";

let started = false;

export function startAppKit() {
  const projectId = kitProject();
  if (started || !projectId) return;
  started = true;
  const origin = typeof window === "undefined" ? siteOrigin() : window.location.origin;
  createAppKit({
    adapters: [new SolanaAdapter({ connectionSettings: connectionConfig })],
    networks: [solana],
    defaultNetwork: solana,
    projectId,
    metadata: {
      name: "goblock",
      description: "goblock — a direct swap with no homepage fee.",
      url: origin,
      icons: [`${origin}/goblock-logo.png`],
    },
    themeMode: "dark",
    themeVariables: {
      "--w3m-accent": "#a8e26a",
    },
    features: {
      analytics: false,
      email: false,
      socials: false,
    },
  });
}
