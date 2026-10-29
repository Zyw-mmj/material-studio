"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "./auth-provider";
import { AccountDialog } from "./account-dialog";
import { StudioIcon } from "./studio-icon";
export function StudioHeader() {
  const path = usePathname();
  const auth = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
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
          aria-current={path.startsWith("/templates") ? "page" : undefined}
        >
          <StudioIcon name="grid" />
          模板库
        </Link>
        <Link
          className={
            path.startsWith("/history") ? "nav-link active" : "nav-link"
          }
          href="/history"
          aria-current={path.startsWith("/history") ? "page" : undefined}
        >
          <StudioIcon name="history" />
          我的制作
        </Link>
        <a
          className="nav-link docs-nav"
          href="https://github.com/Zyw-mmj/material-studio/tree/main/docs"
          target="_blank"
          rel="noreferrer"
        >
          使用与技术文档 ↗
        </a>
      </nav>
      <button
        type="button"
        className="account-trigger"
        aria-label="打开账户与个人记录"
        aria-haspopup="dialog"
        aria-expanded={accountOpen}
        onClick={() => setAccountOpen(true)}
      >
        <span className="avatar-badge">
          {auth.user?.userId === "demo-a" ? (
            "A"
          ) : auth.user?.userId === "demo-b" ? (
            "B"
          ) : (
            <StudioIcon name="user" size={16} />
          )}
        </span>
        <span>
          {auth.busy ? "切换中…" : (auth.user?.displayName ?? "选择身份")}
        </span>
        <span aria-hidden="true">⌄</span>
      </button>
      <AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} />
    </header>
  );
}
