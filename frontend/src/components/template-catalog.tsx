"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { TemplateList } from "@/lib/api";
import { useApiResource } from "@/lib/use-api-resource";
import { StudioIcon } from "./studio-icon";

export function TemplateCatalog() {
  const params = useSearchParams();
  const router = useRouter();
  const category = params.get("category") ?? "";
  const { data, error, isLoading, retry } = useApiResource<TemplateList>(
    `/templates${category ? `?category=${encodeURIComponent(category)}` : ""}`,
  );
  const health = useApiResource<{ status: string }>("/health");
  const categories = data?.categories ?? (category ? [category] : []);
  return (
    <div className="page-shell catalog-shell">
      <header className="page-intro">
        <div>
          <h1>模板库</h1>
          <p>选择模板，上传图片。制作在后台继续，结果随时可看。</p>
        </div>
        <span
          className={`service-state ${health.data?.status === "UP" ? "online" : ""}`}
        >
          <span className="status-dot" />
          {health.isLoading
            ? "连接中"
            : health.data?.status === "UP"
              ? "工作室已就绪"
              : "服务暂不可用"}
        </span>
      </header>
      <section className="catalog" aria-labelledby="templates-heading">
        <div className="catalog-toolbar">
          <div className="category-tabs" role="group" aria-label="模板分类">
            {["", ...categories].map((item) => (
              <button
                type="button"
                key={item || "all"}
                className={`category-tab${category === item ? " selected" : ""}`}
                aria-pressed={category === item}
                onClick={() =>
                  router.replace(
                    item
                      ? `/templates?category=${encodeURIComponent(item)}`
                      : "/templates",
                    { scroll: false },
                  )
                }
              >
                {item || "全部模板"}
              </button>
            ))}
          </div>
          <p className="toolbar-note">
            <span role="status">
              {data ? `${data.items.length} 个模板 · ` : ""}
            </span>
            JPEG / PNG · 单张最大 5 MiB
          </p>
        </div>
        <div className="collection-heading visually-hidden">
          <h2 id="templates-heading">{category || "全部模板"}</h2>
          <span role="status">
            {data ? `${data.items.length} 个模板` : "正在读取"}
          </span>
        </div>
        {isLoading && (
          <>
            <p className="visually-hidden" role="status">
              正在加载模板…
            </p>
            <div className="template-grid" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div className="template-skeleton" key={i} />
              ))}
            </div>
          </>
        )}
        {error && (
          <div className="empty-panel" role="alert">
            <StudioIcon name="error" size={30} />
            <h3>暂时无法读取模板</h3>
            <p>{error.message}</p>
            <button type="button" className="outline-button" onClick={retry}>
              重新加载
            </button>
          </div>
        )}
        {data && !data.items.length && (
          <div className="empty-panel">
            <StudioIcon name="image" size={32} />
            <h3>这个分类暂时没有模板</h3>
            <p>选择“全部模板”或其他分类，继续寻找灵感。</p>
          </div>
        )}
        {data && (
          <div className="template-grid">
            {data.items.map((template, index) => (
              <Link
                className="template-card"
                key={template.id}
                href={`/templates/${template.id}`}
                aria-label={`${template.title}，需要 ${template.requiredImageCount} 张图片，查看模板`}
              >
                <Image
                  src={template.coverUrl}
                  alt={template.title}
                  width={800}
                  height={1000}
                  unoptimized
                  priority={index < 3}
                />
                <span className="image-count">
                  需 {template.requiredImageCount} 张图片
                </span>
                <span className="template-overlay">
                  <span className="card-category">{template.category}</span>
                  <strong>{template.title}</strong>
                  <span className="card-action">
                    使用这个模板 <StudioIcon name="arrow" size={16} />
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
      <aside className="collection-guide" aria-label="制作流程">
        <p>
          <span>01</span> 选择喜欢的模板
        </p>
        <StudioIcon name="arrow" size={16} />
        <p>
          <span>02</span> 上传所需图片
        </p>
        <StudioIcon name="arrow" size={16} />
        <p>
          <span>03</span> 在我的制作中查看结果
        </p>
      </aside>
    </div>
  );
}
