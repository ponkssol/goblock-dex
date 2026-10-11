"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

const LEAVE_MS = 260;

const section = (path: string) => path.split("/")[1] ?? "";

export function PageMotion({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [leaving, setLeaving] = useState(false);
  const [shown, setShown] = useState(path);

  if (shown !== path) {
    setShown(path);
    setLeaving(false);
  }

  useEffect(() => {
    let timer = 0;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a");
      if (!link || link.hasAttribute("download")) return;
      if (link.target && link.target !== "_self") return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (section(url.pathname) === section(window.location.pathname)) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      event.preventDefault();
      const next = url.pathname + url.search + url.hash;
      router.prefetch(next);
      setLeaving(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => router.push(next), LEAVE_MS);
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.clearTimeout(timer);
    };
  }, [router]);

  return (
    <div key={section(path)} className={leaving ? "page-motion out" : "page-motion"}>
      {children}
    </div>
  );
}
