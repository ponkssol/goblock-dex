"use client";

import { useEffect, useRef, useState } from "react";

export function Contents({ items }: { items: [string, string][] }) {
  const [active, setActive] = useState(items[0]?.[0] ?? "");
  const [open, setOpen] = useState(false);
  const jump = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const heads = items
      .map(([id]) => document.getElementById(id))
      .filter((node): node is HTMLElement => node !== null);
    const pick = () => {
      const line = window.innerHeight * 0.3;
      let current = heads[0]?.id ?? "";
      for (const head of heads) {
        if (head.getBoundingClientRect().top <= line) current = head.id;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        current = heads[heads.length - 1]?.id ?? current;
      }
      setActive(current);
    };
    pick();
    window.addEventListener("scroll", pick, { passive: true });
    window.addEventListener("resize", pick);
    return () => {
      window.removeEventListener("scroll", pick);
      window.removeEventListener("resize", pick);
    };
  }, [items]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!jump.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  const index = Math.max(
    0,
    items.findIndex(([id]) => id === active),
  );
  const links = items.map(([id, label]) => (
    <a key={id} href={`#${id}`} className={active === id ? "on" : undefined} onClick={() => setOpen(false)}>
      {label}
    </a>
  ));

  return (
    <>
      <nav className="d-side l-side" aria-label="Contents">
        <div className="d-side-group">
          <small>Contents</small>
          {links}
        </div>
      </nav>

      <div className={open ? "l-jump open" : "l-jump"} ref={jump}>
        <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          <span>
            <small>
              Contents · {index + 1}/{items.length}
            </small>
            <b>{items[index]?.[1]}</b>
          </span>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        <i style={{ width: `${((index + 1) / items.length) * 100}%` }} aria-hidden="true" />
        {open ? <nav aria-label="Contents">{links}</nav> : null}
      </div>
    </>
  );
}
