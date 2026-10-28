"use client";

import Image from "next/image";
import Link from "next/link";
import type { Template } from "@/lib/api";
import { useApiResource } from "@/lib/use-api-resource";

export function TemplateDetail({ id }: { id: string }) {
  const { data, error, isLoading, retry } = useApiResource<Template>(
    `/templates/${encodeURIComponent(id)}`,
  );
  return (
    <div className="page-shell detail-shell">
      <Link href="/templates" className="back-link">
        ← 返回模板库
      </Link>
      {isLoading && (
        <div className="detail-loading" aria-label="正在加载模板">
          <div className="template-skeleton" />
          <div className="loading-copy">正在准备这个画面…</div>
        </div>
      )}
      {error && (
        <div className="empty-panel" role="alert">
          <h1>暂时无法打开这个模板</h1>
          <p>{error.message}</p>
          <button className="outline-button" onClick={retry}>
            重新加载
          </button>
        </div>
      )}
      {data && (
        <article className="detail-grid">
          <div className="detail-cover">
            <Image
              src={data.coverUrl}
              alt={data.title}
              width={800}
              height={1000}
              unoptimized
              priority
            />
          </div>
          <div className="detail-copy">
            <span className="eyebrow">TEMPLATE / {data.category}</span>
            <h1>{data.title}</h1>
            <p className="detail-description">{data.description}</p>
            <dl className="requirements">
              <div>
                <dt>所需素材</dt>
                <dd>{data.requiredImageCount} 张图片</dd>
              </div>
              <div>
                <dt>支持格式</dt>
                <dd>
                  {data.acceptedMimeTypes
                    .map((type) => type.replace("image/", "").toUpperCase())
                    .join(" / ")}
                </dd>
              </div>
              <div>
                <dt>单张上限</dt>
                <dd>{data.maxFileSizeBytes / 1024 / 1024} MiB</dd>
              </div>
            </dl>
            <div className="implementation-note">
              <span className="status-dot" />
              <div>
                <strong>模板已就绪</strong>
                <p>
                  当前为工程初始化版本。上传与异步制作尚未开放，暂不接收图片。
                </p>
              </div>
            </div>
            <Link href="/templates" className="primary-link">
              继续探索模板 <span aria-hidden="true">↗</span>
            </Link>
            <p className="detail-fineprint">
              模拟生成演示 · 后续结果为输入图片副本，无真实 AI 推理
            </p>
          </div>
        </article>
      )}
    </div>
  );
}
