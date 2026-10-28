import { Suspense } from "react";
import { TemplateCatalog } from "@/components/template-catalog";

export default function TemplatesPage() {
  return (
    <main id="main-content">
      <Suspense
        fallback={
          <div className="page-shell loading-copy">正在打开工作室…</div>
        }
      >
        <TemplateCatalog />
      </Suspense>
    </main>
  );
}
