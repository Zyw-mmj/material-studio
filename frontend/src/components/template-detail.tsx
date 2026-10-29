"use client";

import Image from "next/image";
import Link from "next/link";
import type { Template } from "@/lib/api";
import { useApiResource } from "@/lib/use-api-resource";
import { useTaskTracker } from "@/lib/use-task-tracker";
import { LoginPanel, useAuth } from "./auth-provider";
import { CreationForm } from "./creation-form";
import { TaskHistory } from "./task-history";

function TemplatePreview({ template }: { template: Template }) {
  return (
    <div className="template-preview">
      <div className="preview-title">
        <span className="eyebrow">CREATION STUDIO / {template.category}</span>
        <h1>{template.title}</h1>
      </div>
      <div className="workbench-cover">
        <Image
          src={template.coverUrl}
          alt={template.title}
          width={800}
          height={1000}
          unoptimized
          priority
        />
      </div>
      <div className="preview-summary">
        <p className="preview-description">{template.description}</p>
        <div className="template-requirements">
          <span>{template.requiredImageCount} 张图片</span>
          <span>JPEG / PNG</span>
          <span>5 MiB / 张</span>
        </div>
      </div>
    </div>
  );
}
function Workbench({ template }: { template: Template }) {
  const model = useTaskTracker(template.id);
  return (
    <div className="workbench">
      <div className="workbench-sidebar">
        <TemplatePreview template={template} />
        <CreationForm template={template} tracker={model.tracker} />
      </div>
      <TaskHistory model={model} />
    </div>
  );
}
export function TemplateDetail({ id }: { id: string }) {
  const { data, error, isLoading, retry } = useApiResource<Template>(
    `/templates/${encodeURIComponent(id)}`,
  );
  const auth = useAuth();
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
      {data &&
        (auth.user ? (
          <Workbench
            key={`${auth.user.userId}:${auth.epoch}`}
            template={data}
          />
        ) : (
          <div className="workbench">
            <TemplatePreview template={data} />
            <LoginPanel />
          </div>
        ))}
    </div>
  );
}
