"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function StudioHeader() {
  const path = usePathname();
  return (
    <header className="site-header">
      <Link
        className="brand"
        href="/templates"
        aria-label="FRAME 素材制作平台首页"
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3 11V3h8M17 3h8v8M25 17v8h-8M11 25H3v-8"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <path d="M10 10h8v8h-8z" fill="currentColor" />
        </svg>
        <span>
          FRAME<span className="brand-subtitle">素材工作室</span>
        </span>
      </Link>
      <nav aria-label="主导航">
        <Link
          className={
            path.startsWith("/templates") ? "nav-link active" : "nav-link"
          }
          href="/templates"
        >
          模板库
        </Link>
        <a
          className="nav-link"
          href="https://github.com/Zyw-mmj/material-studio/tree/main/docs"
          target="_blank"
          rel="noreferrer"
        >
          技术文档 <span aria-hidden="true">↗</span>
        </a>
      </nav>
      <span className="header-tag">
        <span className="status-dot" /> SIMULATION STUDIO
      </span>
    </header>
  );
}
