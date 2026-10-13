import { WaitlistView } from "../_ui/waitlist";
import { adminMeta } from "../meta";

export const metadata = adminMeta("Waitlist", "/admin/waitlist", "People who joined the goblock waitlist.");

export default function AdminWaitlistPage() {
  return <WaitlistView />;
}
