import { PageHead } from "../../dashboard/_ui/shell";
import { VoucherAdmin } from "../../dashboard/_ui/vouchers";
import { adminMeta } from "../meta";

export const metadata = adminMeta("Discount codes", "/admin/vouchers", "Create and disable goblock checkout discount codes.");

export default function AdminVouchersPage() {
  return (
    <>
      <PageHead title="Discount codes" sub="A code lowers the Builder or Starter price. It is claimed only after the payment lands." />
      <VoucherAdmin />
    </>
  );
}
