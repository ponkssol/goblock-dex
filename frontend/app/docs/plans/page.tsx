import Link from "next/link";
import { PLANS } from "@/lib/plans";
import { docMeta } from "../nav";
import { Info, Sec, Table } from "../parts";

export const metadata = docMeta("/docs/plans");

export default function Plans() {
  return (
    <>
      <Sec id="plans" title="Plans">
        <Table
          head={["Plan", "Price", "Limit"]}
          rows={PLANS.map((plan) => [plan.name, `${plan.price}${plan.period ? ` ${plan.period}` : ""}`, plan.cap])}
        />
        <div className="p-actions">
          <Link className="p-btn" href="/pricing">
            See Pricing
          </Link>
          <Link className="p-btn line" href="/trade">
            Try the Trade Page
          </Link>
        </div>
      </Sec>

      <Sec id="checkout" title="Checkout">
        <Info>
          Checkout is not live yet. Keys are issued by the goblock team for now, and request caps start when checkout
          ships.
        </Info>
      </Sec>
    </>
  );
}
