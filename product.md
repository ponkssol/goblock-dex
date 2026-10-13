# goblock

Swap SOL to a Pump token for less than Jupiter, and still land quickly. A regular goblock swap takes no goblock fee.

## Edge

- A new coin skips Jupiter's 50 bps. An ordinary coin skips Jupiter's 10 bps. The user pays the pool fee.
- A direct pool is used when it pays the most. A second hop, or a split across two pools, is used only when the wallet receives more. The tip stays capped.
- Before the signature, the trader sees what they get if the token is sold straight back, plus coin status: still on the bonding curve or graduated, the creator fee, mayhem, and cashback. DFlow does not show this.
- Anyone who subscribes can use the production API. The key is issued without a 2–5 day application, unlike DFlow.

That price edge goes away if the homepage swap is charged too.

## Swap

One step. The best pool among PumpSwap, Raydium, Meteora, and Orca. The user signs in their own wallet.

The priority fee follows the slot queue at that moment, with a cap of 0.0001 SOL. The tip is enough to land within one or two slots. The tip is not used as revenue.

## Where goblock gets paid

- A homepage swap, through `/api/swap`, stays free and needs no key.
- A brand-link swap takes 5 bps. Half goes to the brand wallet and half to the goblock treasury, and only if the transaction lands. On a new coin this stays well below Jupiter's fee.
- A free API key pays a fee in SOL on the SOL side of the swap: 0 bps with a stablecoin or an LST, 3 bps with a major token, 5 bps with any other pool token, and 20 bps on a bonding curve. Pairs without SOL pay nothing. Each rate sits below Jupiter's for the same pair.
- A bot on a monthly plan pays the subscription instead of a cut of the trader's swap. The trader page stays the same.
- An integrator can add `platformFeeBps` (50–255) with `feeWallet`. goblock keeps 10%, or the free-key fee for that pair when that is larger.

Brand link: `/?brand=Name&brandWallet=<address>`

goblock treasury: `GOBLOCK_TREASURY`, or the buyback vault PDA `7bo6FFvvfPfzcBn7tow8hhUrtXmYboeoqCaNmHBqqsaF` when that variable is empty.

## Buyback

Fees collect in the vault PDA (seed `vault`) of the goblock program. Once new fees reach 0.1 SOL, anyone can call `distribute`: 60% goes to the team wallet `CwVD4jd6BeLAWZeEqMFerD8bLoQevSy5rmwawFTa3nuo`, and 40% is held in the vault to buy $GOBLOCK on the Pump curve or PumpSwap. The program burns every token it buys in the same transaction. The team wallet sets the $GOBLOCK mint once at `/buyback/settings`, and it is locked after that. The public page is `/buyback`.

## API

`/api/v1/swap` requires an `x-api-key` header. Monthly keys are listed in `GOBLOCK_API_KEYS`, separated by commas, and add no swap fee. Free keys come from `POST /api/v1/key`: each one is signed with `GOBLOCK_KEY_SECRET`, so nothing is stored, and a free key can be refused by listing it in `GOBLOCK_BLOCKED_KEYS`.

DFlow production has to be applied for and then approved. goblock hands out a free production key in one call.

## Current code

The site and the API run as separate processes. The site forwards `/api` and wallet RPC calls to the API server, so the RPC URL stays in the API environment. A quote compares PumpSwap, the bonding curve, Raydium, Meteora, and Orca. It keeps one pool when that pays the most, and uses a second hop or a two-pool split when that pays more. The on-chain route checks that the output token account gained at least the quoted minimum. The coin receipt, the sell-back preview, the capped priority fee, the 5 bps link fee, and the key on `/api/v1/swap` are already in use.

Automatic subscription billing comes later. The on-chain router is published on its own at https://github.com/ponkssol/goblock-program. Its `route` instruction forwards a swap to an allowed program and writes a `goblock:` log. Program `GBLK6CfBQXsTjYZqzpNs5gxYjp8r3NqnqZiohjuvxMww` is live on mainnet and devnet. A signed swap is one goblock instruction, and that instruction forwards the pool swap.
