export type SwapVenue = "PumpSwap" | "Bonding curve" | "Raydium" | "Meteora" | "Orca";

export type SwapOrderInput = {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps: number;
  userPublicKey?: string;
  brand?: string;
  brandWallet?: string;
};

export type SwapReceipt = {
  venue: SwapVenue;
  graduated: boolean;
  mayhem: boolean;
  cashback: boolean;
  creatorFeeBps: number;
  creator: string;
};

export type SwapQuote = {
  side: "buy" | "sell";
  inAmount: string;
  outAmount: string;
  minOutAmount: string;
  maxInAmount: string;
  priceImpactPct: string;
  pool: string;
  programId: string;
  venue: SwapVenue;
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
