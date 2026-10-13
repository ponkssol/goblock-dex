import { ProductSettings } from "../_ui/product";
import { adminMeta } from "../meta";

export const metadata = adminMeta("Fees", "/admin/fees", "Free-key, brand-link, and platform fee rates.");

export default function AdminFeesPage() {
  return <ProductSettings section="fees" />;
}
