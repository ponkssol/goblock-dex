import { PaymentsView } from "../_ui/payments";
import { adminMeta } from "../meta";

export const metadata = adminMeta("Payments", "/admin/payments", "Checkout payments that issued a goblock API key.");

export default function AdminPaymentsPage() {
  return <PaymentsView />;
}
