import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" className="page-shell not-found">
      <span className="eyebrow">404 / OUT OF FRAME</span>
      <h1>这张画面，暂时找不到。</h1>
      <Link className="text-link" href="/templates">
        回到模板库 ↗
      </Link>
    </main>
  );
}
