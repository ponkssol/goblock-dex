"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function Reveal({
  children,
  className = "",
  motion,
  id,
}: {
  children: ReactNode;
  className?: string;
  motion: string;
  id?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [phase, setPhase] = useState<"in" | "up" | "down">("down");

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setPhase(entry.isIntersecting ? "in" : entry.boundingClientRect.top < 0 ? "up" : "down"),
      { threshold: 0.18 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      id={id}
      data-motion={motion}
      className={`j-reveal ${phase === "down" ? "" : phase} ${className}`.replace(/\s+/g, " ").trim()}
    >
      {children}
    </section>
  );
}
