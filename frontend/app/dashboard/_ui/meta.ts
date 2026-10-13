import { pageMeta } from "../../site";

export function dashboardMeta(title: string, path: string, description: string) {
  const meta = pageMeta({ title: `${title} · goblock API Console`, description, path });
  return path === "/dashboard" ? meta : { ...meta, robots: { index: false, follow: false } };
}
