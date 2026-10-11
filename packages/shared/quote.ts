export type SwapVenue = "PumpSwap" | "Bonding curve" | "Raydium" | "Meteora" | "Orca";

export type SwapOrderInput = {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps: number;
  userPublicKey?: string;
  brand?: string;
  brandWallet?: string;
  /** When false, return the venue instructions instead of a wrapped transaction. */
  assemble?: boolean;
  /** When false, skip the sell-back quote so the price can return first. */
  roundTrip?: boolean;
};

export type SwapReceipt = {
  venue: SwapVenue;
  graduated: boolean;
  mayhem: boolean;
  cashback: boolean;
  creatorFeeBps: number;
  creator: string;
};

export type RouteProbe = {
  venue: string;
  ms: number;
  ok: boolean;
  outAmount?: string;
};

export type SwapQuote = {
  side: "buy" | "sell";
  trace?: RouteProbe[];
  inAmount: string;
  outAmount: string;
  minOutAmount: string;
  maxInAmount: string;
  priceImpactPct: string;
  pool: string;
  programId: string;
  venue: SwapVenue;
  /** Set when the swap uses more than one pool. */
  route?: string;
  receipt: SwapReceipt;
  roundTripOutAmount?: string;
  feeBps: number;
  feeAmount: string;
  networkFeeLamports: string;
  memo?: string;
  inputMintDecimals: number;
  outputMintDecimals: number;
  transaction?: string;
  lastValidBlockHeight?: number;
  msg?: string;
};
