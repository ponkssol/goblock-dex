import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const dynamic = "force-static";

const VENUES = ["PumpSwap", "Pump curve", "Raydium", "Meteora", "Orca"];

async function dataUri(file: string) {
  const bytes = await readFile(path.join(process.cwd(), "public", file));
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

async function googleFont(weight: number) {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Inter+Tight:wght@${weight}`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    return await (await fetch(url)).arrayBuffer();
  } catch {
    return null;
  }
}

export async function GET() {
  const [wordmark, mark, bold, regular] = await Promise.all([
    dataUri("goblock logo wordmark.png"),
    dataUri("goblock-mark.png"),
    googleFont(800),
    googleFont(500),
  ]);
  const fonts = [
    ...(bold ? [{ name: "Inter Tight", data: bold, weight: 800 as const, style: "normal" as const }] : []),
    ...(regular ? [{ name: "Inter Tight", data: regular, weight: 500 as const, style: "normal" as const }] : []),
  ];

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          padding: 40,
          background: "#090d10",
          fontFamily: fonts.length ? "Inter Tight" : undefined,
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            padding: "56px 64px",
            borderRadius: 36,
            overflow: "hidden",
            background: "linear-gradient(160deg, #dcf9a4 0%, #b9ec95 52%, #8dd8c6 100%)",
            color: "#0b1014",
          }}
        >
          <img
            src={mark}
            width={540}
            height={282}
            style={{ position: "absolute", right: -60, bottom: -40, opacity: 0.12 }}
            alt=""
          />
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "14px 22px",
                borderRadius: 999,
                background: "#0b1014",
              }}
            >
              <img src={wordmark} width={166} height={40} alt="goblock" />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 86, fontWeight: 800, letterSpacing: -4, lineHeight: 1 }}>Best-price</div>
            <div style={{ fontSize: 86, fontWeight: 800, letterSpacing: -4, lineHeight: 1.05 }}>Solana swaps.</div>
            <div style={{ marginTop: 22, fontSize: 30, fontWeight: 500, color: "rgba(11,16,20,0.72)" }}>
              One quote across five venues. Signed in your own wallet.
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {VENUES.map((venue) => (
              <div
                key={venue}
                style={{
                  display: "flex",
                  padding: "10px 20px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.45)",
                  fontSize: 24,
                  fontWeight: 500,
                }}
              >
                {venue}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts: fonts.length ? fonts : undefined },
  );
}
