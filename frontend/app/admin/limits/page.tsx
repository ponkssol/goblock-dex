import { ProductSettings } from "../_ui/product";
import { adminMeta } from "../meta";

export const metadata = adminMeta("Rate limits", "/admin/limits", "Per-minute request caps for goblock API keys.");

export default function AdminLimitsPage() {
  return <ProductSettings section="limits" />;
}
