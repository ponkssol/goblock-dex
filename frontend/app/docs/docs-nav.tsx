"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { DOC_GROUPS, DOC_LINKS } from "./nav";

export function DocsSidebar() {
  const path = usePathname();

  return (
    <nav className="d-side" aria-label="Docs">
      {DOC_GROUPS.map((group) => (
        <div className="d-side-group" key={group.title}>
          <small>{group.title}</small>
          {group.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={path === link.href ? "on" : undefined}
              aria-current={path === link.href ? "page" : undefined}
            >
              {link.title}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

function Toc({ path }: { path: string }) {
  const [items, setItems] = useState<[string, string][]>([]);
  const [active, setActive] = useState("");

  useEffect(() => {
    const heads = Array.from(document.querySelectorAll<HTMLElement>(".d-main .d-sec[id]"));
    setItems(heads.map((node) => [node.id, node.querySelector("h2")?.textContent ?? node.id]));

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
  }, [path]);

  return (
    <aside className="d-toc" aria-label="On this page">
      {items.length ? (
        <>
          <small>On this page</small>
          {items.map(([id, label]) => (
            <a key={id} href={`#${id}`} className={active === id ? "on" : undefined}>
              {label}
            </a>
          ))}
        </>
      ) : null}
    </aside>
  );
}

export function DocsBody({ children }: { children: ReactNode }) {
  const path = usePathname();
  const index = DOC_LINKS.findIndex((link) => link.href === path);
  const doc = DOC_LINKS[index];
  const prev = index > 0 ? DOC_LINKS[index - 1] : undefined;
  const next = index >= 0 ? DOC_LINKS[index + 1] : undefined;
  const intro = path === "/docs";

  return (
    <>
      <article className={intro ? "d-main wide" : "d-main"} key={path}>
        {doc && !intro ? (
          <header className="d-head">
            <span>{doc.group}</span>
            <h1>{doc.title}</h1>
            <p>{doc.lead}</p>
          </header>
        ) : null}
        {children}
        {doc ? (
          <nav className="d-pager" aria-label="Pages">
            {prev ? (
              <Link href={prev.href}>
                <small>Previous</small>
                <b>{prev.title}</b>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link className="next" href={next.href}>
                <small>Next</small>
                <b>{next.title}</b>
              </Link>
            ) : null}
          </nav>
        ) : null}
      </article>
      {intro ? null : <Toc path={path} />}
    </>
  );
}
