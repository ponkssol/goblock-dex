# goblock

Swap SOL to a Pump token for less than Jupiter, and still land quickly. A regular goblock swap takes no goblock fee.

## Edge

- A new coin skips Jupiter's 50 bps. An ordinary coin skips Jupiter's 10 bps. The user pays the pool fee.
- DFlow also charges no protocol fee. goblock is cheaper in total: one step, no extra hop, and a capped tip.
- Before the signature, the trader sees what they get if the token is sold straight back, plus coin status: still on the bonding curve or graduated, the creator fee, mayhem, and cashback. DFlow does not show this.
- Anyone who subscribes can use the production API. The key is issued without a 2–5 day application, unlike DFlow.

That price edge goes away if the homepage swap is charged too.

## Swap

One step. The best pool among PumpSwap, Raydium, Meteora, and Orca. The user signs in their own wallet.

The priority fee follows the slot queue at that moment, with a cap of 0.0001 SOL. The tip is enough to land within one or two slots. The tip is not used as revenue.

## Where goblock gets paid

- A homepage swap, through `/api/swap`, stays free and needs no key.
- A brand-link swap takes 5 bps. Half goes to the brand wallet and half to the goblock treasury, and only if the transaction lands. On a new coin this stays well below Jupiter's fee.
- A bot pays for an API subscription instead of a cut of the trader's swap. The trader page stays the same.

Brand link: `/?brand=Name&brandWallet=<address>`

goblock treasury: `GOBLOCK_TREASURY`, or `CwVD4jd6BeLAWZeEqMFerD8bLoQevSy5rmwawFTa3nuo` when that variable is empty.

## API

`/api/v1/swap` requires an `x-api-key` header. Live keys are listed in `GOBLOCK_API_KEYS`, separated by commas. Later plans differ by request cap, and they do not add a swap fee.

DFlow production has to be applied for and then approved. goblock issues a key when someone subscribes.

## Current code

A quote compares PumpSwap, the bonding curve, Raydium, Meteora, and Orca in one step, then keeps the largest result. The coin receipt, the sell-back preview, the capped priority fee, the 5 bps link fee, and the key on `/api/v1/swap` are already in use.

Automatic subscription billing comes later. The on-chain router is published on its own at https://github.com/ponkssol/goblock-program. Its `route` instruction forwards a swap to an allowed program and writes a `goblock:` log. Program `GBLK6CfBQXsTjYZqzpNs5gxYjp8r3NqnqZiohjuvxMww` is live on mainnet and devnet. The homepage still calls the venue program directly.
