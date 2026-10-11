import { HomePage } from "./home-page";
import { SITE_DESCRIPTION, SITE_TITLE, pageMeta } from "./site";

export const metadata = pageMeta({ title: SITE_TITLE, description: SITE_DESCRIPTION, path: "/" });

export default function Page() {
  return <HomePage />;
}
