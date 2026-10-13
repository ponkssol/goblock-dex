import { ProductSettings } from "../_ui/product";
import { adminMeta } from "../meta";

export const metadata = adminMeta("Pricing", "/admin/settings", "Builder and Starter prices for the program deployer.");

export default function AdminPricingPage() {
  return <ProductSettings section="pricing" />;
}
