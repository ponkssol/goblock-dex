import { pageMeta } from "../site";

export function adminMeta(title: string, path: string, description: string) {
  return {
    ...pageMeta({ title: `${title} · goblock Admin`, description, path }),
    robots: { index: false, follow: false },
  };
}
