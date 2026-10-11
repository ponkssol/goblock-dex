export const SOL_MINT = "So11111111111111111111111111111111111111112";

export type TokenInfo = {
  symbol: string;
  mint: string;
  decimals: number;
  image?: string;
};

export const SOL: TokenInfo = {
  symbol: "SOL",
  mint: SOL_MINT,
  decimals: 9,
  image: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
};

export const USDC: TokenInfo = {
  symbol: "USDC",
  mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  decimals: 6,
  image:
    "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
};

export const FARTCOIN: TokenInfo = {
  symbol: "FARTCOIN",
  mint: "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump",
  decimals: 6,
  image: "https://images.pump.fun/coin-image/9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump",
};

export function isMint(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}
