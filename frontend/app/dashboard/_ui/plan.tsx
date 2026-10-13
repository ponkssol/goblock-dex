"use client";

import Link from "next/link";
import { PLANS, planHref } from "@/lib/plans";
import { Icon } from "./icons";
import { Card, PageHead, Tab, useLoaded } from "./shell";

export function PlanView() {
  const { overview, placeholder } = useLoaded();
  if (!overview) return placeholder;
  const paid = overview.plan === "paid";
  const active = overview.keys.find(
    (key) => key.plan !== "free" && !key.revokedAt && (!key.expiresAt || Date.parse(key.expiresAt) > Date.now()),
  );
  const current = active && (active.plan === "builder" || active.plan === "starter") ? active.plan : paid ? null : "free";

  function flag(plan: (typeof PLANS)[number]) {
    if (current === plan.id) return "Current";
    if (plan.featured) return "Popular";
    if (plan.price === "$0") return "No bill";
    return plan.period ? "Monthly" : "Talk to us";
  }

  return (
    <>
      <PageHead
        title="Plan & Fees"
        sub="What goblock charges on the swaps your keys build, and how to drop it."
      >
        <Link className="p-btn line" href="/pricing">
          Pricing Page
          <Icon name="arrow" size={16} />
        </Link>
      </PageHead>

      <div className="ds-grid c-1-1">
        <Card
          title="Current plan"
          sub={paid ? "Monthly plan" : "Free key"}
          action={<span className={paid ? "k-pill paid" : "k-pill"}>{paid ? "Paid" : "Free"}</span>}
        >
          <dl className="k-fees">
            {overview.fees.map((fee) => (
              <div key={fee.pair}>
                <dt>{fee.pair}</dt>
                <dd>{fee.bps} bps</dd>
              </div>
            ))}
          </dl>
          <p className="ds-fine">The fee is paid in SOL, on the SOL side of the swap, and only when the swap lands.</p>
        </Card>

        <Card plain title="Your own fee" sub="platformFeeBps and feeWallet">
          <div className="ds-big">
            <strong>
              {overview.platformFee.minBps}–{overview.platformFee.maxBps}
            </strong>
            <span>bps</span>
          </div>
          <p className="ds-text">
            {paid
              ? "Charge your users on top of the swap. Your wallet keeps 90% of it."
              : "Charge your users on top of the swap. goblock keeps 10% of it, or the free-key fee for the pair when that is larger, and the free-key fee is not added on top."}
          </p>
          <Link className="k-link" href="/dashboard/earnings">
            See your earnings
          </Link>
        </Card>
      </div>

      <div className="ds-section-head">
        <b>Plans</b>
        <small>Builder and Starter are paid in SOL or USDC. The request cap starts when the key is issued.</small>
      </div>
      <ul className="ds-plans">
        {PLANS.map((plan) => (
          <li key={plan.id} className={plan.featured ? "lime" : undefined}>
            <div className="ds-card-tabs">
              <Tab>{plan.name}</Tab>
              <span className="ds-flag">{flag(plan)}</span>
            </div>
            <div className="ds-plans-body">
              <div className="ds-plans-price">
                <strong>{plan.price}</strong>
                {plan.period ? <span>{plan.period}</span> : null}
              </div>
              <span className="ds-cap">{plan.cap}</span>
              <ul>
                {plan.perks.map((perk) => (
                  <li key={perk}>
                    <Icon name="check" size={14} />
                    {perk}
                  </li>
                ))}
              </ul>
              {current === plan.id ? (
                <span className="p-btn line ds-plans-btn is-current">Your plan</span>
              ) : (
                <Link className={plan.featured ? "ds-go ds-plans-btn" : "p-btn line ds-plans-btn"} href={planHref(plan.id)}>
                  {plan.cta}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
