"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { TemplateList } from "@/lib/api";
import { useApiResource } from "@/lib/use-api-resource";

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
    <div className="page-shell">
      <section className="hero" aria-labelledby="catalog-title">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="tiny-cross">✳</span> YOUR IDEAS, IN A NEW FRAME
          </span>
          <h1 id="catalog-title">
            让灵感，
            <br />
            有一个好看的<span className="title-accent">开始。</span>
          </h1>
          <p>从喜欢的模板出发，把日常的片刻，变成值得留下的画面。</p>
        </div>
        <div className="hero-note">
          <span className="edition">
            VOL. 001 <span>—</span> CREATIVE ESSENTIALS
          </span>
          <div className="note-mark" aria-hidden="true">
            ✳
          </div>
          <p>
            一个模板。几张照片。
            <br />
            留一点空间，给你的想象。
          </p>
          <span className="note-caption">素材制作平台 / 模拟生成</span>
        </div>
      </section>

      <section className="catalog" aria-labelledby="templates-heading">
        <div className="catalog-heading">
          <div>
            <span className="section-number">01 / COLLECTION</span>
            <h2 id="templates-heading">从这里，找到你的画面</h2>
          </div>
          <span className="collection-count">
            {data
              ? `${String(data.items.length).padStart(2, "0")} 个模板`
              : "模板精选"}
          </span>
        </div>
        <div className="catalog-toolbar">
          <div className="category-tabs" aria-label="模板分类">
            {["", ...categories].map((item) => (
              <button
                className={
                  category === item ? "category-tab selected" : "category-tab"
                }
                key={item || "all"}
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
          <span className="toolbar-note">JPEG / PNG · 最大 5 MiB</span>
        </div>

        {isLoading && (
          <div className="template-grid" aria-label="正在加载模板">
            {[0, 1, 2].map((i) => (
              <div key={i} className="template-skeleton" />
            ))}
          </div>
        )}
        {error && (
          <div className="empty-panel" role="alert">
            <span className="empty-symbol">↗</span>
            <h3>模板还在路上</h3>
            <p>{error.message}</p>
            <button className="outline-button" onClick={retry}>
              重新加载
            </button>
          </div>
        )}
        {data && data.items.length === 0 && (
          <div className="empty-panel">
            <h3>这个分类，等待新的灵感。</h3>
            <p>暂时没有模板，试试其他分类。</p>
          </div>
        )}
        {data && (
          <div className="template-grid">
            {data.items.map((template, index) => (
              <Link
                className="template-card"
                key={template.id}
                href={`/templates/${template.id}`}
              >
                <div className="cover-wrap">
                  <Image
                    src={template.coverUrl}
                    alt={template.title}
                    width={800}
                    height={1000}
                    unoptimized
                    priority={index < 3}
                  />
                  <span className="image-count">
                    {template.requiredImageCount} 张素材
                  </span>
                  <span className="card-open" aria-hidden="true">
                    ↗
                  </span>
                </div>
                <div className="card-meta">
                  <span>{template.category}</span>
                  <span>NO. {String(index + 1).padStart(2, "0")}</span>
                </div>
                <h3>{template.title}</h3>
                <p>
                  查看模板与素材要求 <span aria-hidden="true">↗</span>
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="studio-strip" aria-label="项目状态">
        <span className="strip-icon" aria-hidden="true">
          ⌘
        </span>
        <div>
          <h2>创作在后台，灵感不停步。</h2>
          <p>
            选择模板、上传图片，制作会在后台继续。随时返回「我的制作」，查看进度与结果。
          </p>
        </div>
        <span
          className={`connection-label ${health.data?.status === "UP" ? "online" : ""}`}
        >
          <span className="status-dot" />
          {health.isLoading
            ? "正在连接工作室"
            : health.data?.status === "UP"
              ? "工作室服务已就绪"
              : "服务暂不可用"}
        </span>
      </section>
    </div>
  );
}
