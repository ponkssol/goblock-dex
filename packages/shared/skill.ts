export type SkillSettings = {
  network: "mainnet" | "devnet";
  slippageBps: number;
  confirm: boolean;
};

export const DEFAULT_SKILL: SkillSettings = {
  network: "mainnet",
  slippageBps: 100,
  confirm: true,
};

export function skillMarkdown(settings: SkillSettings = DEFAULT_SKILL): string {
  const confirm = settings.confirm
    ? "Call build_swap only after the user agrees to the quote."
    : "This connection turned confirmation off. Call build_swap after get_quote, and still show the quote.";
  return `# goblock

Quote and build Solana swaps. goblock never signs and never sends the transaction.

## Tools

- \`search_tokens\`: find a mint from a name or symbol.
- \`get_price\`: the token's USD price and its price in SOL.
- \`get_quote\`: the best route across PumpSwap, Raydium, Meteora, and Orca. Call this before a swap.
- \`build_swap\`: an unsigned transaction for the wallet named in the call. ${confirm}
- \`get_receipt\`: whether a coin is graduated or still on the bonding curve, plus creator fee, mayhem, and cashback.
- \`get_balance\`: SOL and token balances. Read only.

## Rules

- Amounts are human units, such as \`0.1\`, not lamports.
- Pinned symbols: SOL and USDC. For any other name, use the mint returned by \`search_tokens\`.
- Show the venue, amount received, minimum, goblock fee, and sell-back SOL before the user signs.
- The transaction from \`build_swap\` is the final quote. Do not broadcast it.
- A free key pays the goblock fee in SOL on the SOL side. A paid key pays the subscription instead, so the swap fee is 0.
- Default slippage on this connection is ${settings.slippageBps / 100}%.
- ${settings.network === "devnet" ? "This URL asks for devnet. This server quotes mainnet." : "This server quotes mainnet."}
`;
}

export const PUBLIC_SKILL = skillMarkdown();
