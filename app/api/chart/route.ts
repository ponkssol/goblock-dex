import { spawn } from "node:child_process";
import { NextRequest, NextResponse } from "next/server";
import { isMint } from "@/lib/tokens";

const RANGES: Record<string, { resolution: string; seconds: number }> = {
  "1H": { resolution: "1m", seconds: 60 * 60 },
  "4H": { resolution: "5m", seconds: 4 * 60 * 60 },
  "1D": { resolution: "15m", seconds: 24 * 60 * 60 },
  "1W": { resolution: "1h", seconds: 7 * 24 * 60 * 60 },
};

type Candle = {
  time: number;
  open: string;
  high: string;
  low: string;
  close: string;
};

export async function GET(request: NextRequest) {
  const mint = request.nextUrl.searchParams.get("mint") ?? "";
  const range = request.nextUrl.searchParams.get("range") ?? "1D";
  if (!isMint(mint)) {
    return NextResponse.json({ candles: [], msg: "That mint is not valid." }, { status: 400 });
  }

  const spec = RANGES[range] ?? RANGES["1D"];
  const to = Math.floor(Date.now() / 1000);
  const from = to - spec.seconds;

  try {
    const stdout = await runGmgn([
      "market",
      "kline",
      "--chain",
      "sol",
      "--address",
      mint,
      "--resolution",
      spec.resolution,
      "--from",
      String(from),
      "--to",
      String(to),
      "--raw",
    ]);
    const parsed = JSON.parse(stdout) as { list?: Candle[]; code?: number; message?: string };
    if (parsed.code === 429) {
      return NextResponse.json({ candles: [], msg: parsed.message ?? "GMGN rate limit." }, { status: 429 });
    }
    const candles = (parsed.list ?? [])
      .map((candle) => ({
        time: Math.floor(candle.time / 1000),
        open: Number(candle.open),
        high: Number(candle.high),
        low: Number(candle.low),
        close: Number(candle.close),
      }))
      .filter((candle) => [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite))
      .sort((left, right) => left.time - right.time);
    const unique = candles.filter((candle, index) => index === 0 || candle.time !== candles[index - 1].time);
    const first = unique[0];
    const last = unique[unique.length - 1];
    const change = first && last ? ((last.close - first.open) / first.open) * 100 : 0;
    return NextResponse.json({ candles: unique, price: last?.close ?? null, change });
  } catch {
    return NextResponse.json({ candles: [], msg: "The chart could not be loaded." });
  }
}

function runGmgn(args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child =
      process.platform === "win32"
        ? spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "gmgn-cli", ...args], { windowsHide: true })
        : spawn("gmgn-cli", args, { windowsHide: true });
    const chunks: Buffer[] = [];
    const errors: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("timeout"));
    }, 20_000);
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => errors.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(Buffer.concat(errors).toString() || `gmgn-cli exited ${code}`));
        return;
      }
      resolve(Buffer.concat(chunks).toString());
    });
  });
}
