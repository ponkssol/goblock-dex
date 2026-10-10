import type { Metadata } from "next";
import { BRAND_FEE_BPS, treasuryAddress } from "@/lib/fees";
import { SiteNav } from "../site-nav";
import { BrandForm } from "./brand-form";

export const metadata: Metadata = {
  title: "Brand — goblock",
  description: "Build a goblock swap link that shares a 5 bps fee with your wallet.",
};

export default function BrandPage() {
  const treasury = treasuryAddress().toBase58();
  return (
    <main className="stage page">
      <SiteNav />
      <section className="band first">
        <div>
          <h2>A link that shares the fee.</h2>
          <p className="copy">
            Share a Trade link with your name on it. When someone swaps through that link, {BRAND_FEE_BPS} bps is split
            between your wallet and goblock.
          </p>
          <ul className="checks">
            <li>The fee is taken only if the swap lands.</li>
            <li>A visit without these parameters stays free.</li>
            <li className="break">Treasury {treasury}</li>
          </ul>
        </div>
        <BrandForm />
      </section>
    </main>
  );
}
