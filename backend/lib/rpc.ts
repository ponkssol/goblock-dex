import { Connection, type FetchFn } from "@solana/web3.js";

const endpoint = process.env.SOLANA_RPC_URL ?? "https://solana-rpc.publicnode.com";

const MAX_IN_FLIGHT = 24;
const MAX_PER_SECOND = 80;
let inFlight = 0;
const sentAt: number[] = [];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function takeSlot() {
  for (;;) {
    const now = Date.now();
    while (sentAt.length > 0 && now - sentAt[0] >= 1_000) sentAt.shift();
    if (inFlight < MAX_IN_FLIGHT && sentAt.length < MAX_PER_SECOND) {
      inFlight += 1;
      sentAt.push(now);
      return;
    }
    await sleep(40);
  }
}

function freeSlot() {
  inFlight = Math.max(0, inFlight - 1);
}

async function limited(response: Response): Promise<boolean> {
  if (response.ok) return false;
  if (response.status === 429) return true;
  const text = await response.clone().text();
  return text.includes('"code":429') || text.includes("Too many requests");
}

export const pacedFetch: FetchFn = async (input, init) => {
  await takeSlot();
  try {
    let wait = 700;
    let response = await fetch(input, init);
    for (let attempt = 0; attempt < 4 && (await limited(response)); attempt += 1) {
      await response.arrayBuffer().catch(() => undefined);
      await sleep(wait);
      wait = Math.min(wait * 2, 4_000);
      response = await fetch(input, init);
    }
    return response;
  } finally {
    freeSlot();
  }
};

export const connection = new Connection(endpoint, {
  commitment: "confirmed",
  disableRetryOnRateLimit: true,
  fetch: pacedFetch,
});
