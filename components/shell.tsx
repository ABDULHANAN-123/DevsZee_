"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { brand } from "@/lib/brand";
import { Icon } from "./icons";
export function Shell({
  children,
  active,
}: {
  children: React.ReactNode;
  active: "chat" | "dashboard";
}) {
  const [dark, setDark] = useState(false);
  const explicitTheme = useRef(false);
  useEffect(() => {
    let preference: string | null = null;
    try {
      preference = localStorage.getItem("triage.theme");
    } catch {
      /* System preference still works. */
    }
    const query = matchMedia("(prefers-color-scheme: dark)");
    const apply = (value: boolean) => {
      document.documentElement.dataset.theme = value ? "dark" : "light";
      setDark(value);
    };
    explicitTheme.current = Boolean(preference);
    apply(preference ? preference === "dark" : query.matches);
    const changed = () => {
      if (!explicitTheme.current) apply(query.matches);
    };
    query.addEventListener("change", changed);
    return () => query.removeEventListener("change", changed);
  }, []);
  function toggleTheme() {
    explicitTheme.current = true;
    const value = !dark;
    document.documentElement.dataset.theme = value ? "dark" : "light";
    setDark(value);
    try {
      localStorage.setItem("triage.theme", value ? "dark" : "light");
    } catch {
      /* Non-persistent toggle is okay. */
    }
  }
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link
            href="/"
            aria-label="Nexa home"
            className="flex items-center gap-2.5"
          >
            <span className="brand-icon">
              <Icon name="spark" />
            </span>
            <span className="text-xl font-bold tracking-tight">
              {brand.name}
              <span className="text-[var(--accent)]">.</span>
            </span>
            <span className="muted hidden border-l border-[var(--line)] pl-3 text-xs sm:block">
              CONVERSATIONS, CONNECTED
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <button
              className="icon-btn"
              onClick={toggleTheme}
              aria-label={dark ? "Use light theme" : "Use dark theme"}
            >
              <Icon name={dark ? "sun" : "moon"} />
            </button>
          </div>
          <nav
            className="flex w-full gap-1 sm:order-none sm:w-auto"
            aria-label="Main navigation"
          >
            <Link
              className={`nav-link ${active === "chat" ? "nav-active" : ""}`}
              aria-current={active === "chat" ? "page" : undefined}
              href="/"
            >
              <Icon name="chat" />
              Customer chat
            </Link>
            <Link
              className={`nav-link ${active === "dashboard" ? "nav-active" : ""}`}
              aria-current={active === "dashboard" ? "page" : undefined}
              href="/dashboard"
            >
              <Icon name="grid" />
              Owner dashboard
            </Link>
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-10">
        {children}
      </main>
      <footer className="muted mx-auto flex max-w-7xl flex-wrap justify-between gap-2 px-5 pb-6 text-xs sm:px-8">
        <span>{brand.name} · Support &amp; Lead Intelligence</span>
        <span>{brand.tagline}</span>
      </footer>
    </>
  );
}
