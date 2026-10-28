"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { IdentityChoices, useAuth } from "./auth-provider";
export function StudioHeader() {
  const path = usePathname();
  const auth = useAuth();
  const menu = useRef<HTMLDetailsElement>(null);
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
        <Link
          className={
            path.startsWith("/history") ? "nav-link active" : "nav-link"
          }
          href="/history"
        >
          我的制作
        </Link>
        <a
          className="nav-link docs-nav"
          href="https://github.com/Zyw-mmj/material-studio/tree/main/docs"
          target="_blank"
          rel="noreferrer"
        >
          技术文档 ↗
        </a>
      </nav>
      <details className="identity-menu" ref={menu}>
        <summary aria-label="选择或切换演示身份">
          <span className="avatar-badge">
            {auth.user?.userId === "demo-a"
              ? "A"
              : auth.user?.userId === "demo-b"
                ? "B"
                : "○"}
          </span>
          {auth.busy ? "切换中…" : (auth.user?.displayName ?? "选择身份")}
          <span aria-hidden="true">⌄</span>
        </summary>
        <div className="identity-popover">
          <span className="eyebrow">DEMO IDENTITY</span>
          <p>个人素材与制作记录按身份隔离。</p>
          <IdentityChoices
            onChoose={() => menu.current?.removeAttribute("open")}
          />
          {auth.user && (
            <button
              className="logout-button"
              disabled={auth.busy}
              onClick={() => {
                menu.current?.removeAttribute("open");
                void auth.logout();
              }}
            >
              退出当前身份
            </button>
          )}
          {auth.error && (
            <p className="form-error" role="alert">
              {auth.error}
            </p>
          )}
        </div>
      </details>
    </header>
  );
}
