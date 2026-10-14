"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

export function PageMotion({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const warm = (event: Event) => {
      const link = (event.target as Element | null)?.closest?.("a");
      if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
      let url: URL;
      try {
        url = new URL(link.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      router.prefetch(url.pathname + url.search);
    };
    document.addEventListener("pointerover", warm, true);
    return () => document.removeEventListener("pointerover", warm);
  }, [router]);

  return (
    <div className="page-motion">
      {children}
    </div>
  );
}
