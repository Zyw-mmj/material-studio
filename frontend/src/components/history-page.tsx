"use client";
import Link from "next/link";
import { useState } from "react";
import { useAuth, LoginPanel } from "./auth-provider";
import { useTaskTracker } from "@/lib/use-task-tracker";
import { useApiResource } from "@/lib/use-api-resource";
import type { TaskFilter, TemplateList } from "@/lib/api";
import { TaskHistory } from "./task-history";
import { StudioIcon } from "./studio-icon";
const statuses: { value: TaskFilter["status"]; label: string }[] = [
  { value: "ALL", label: "全部记录" },
  { value: "ACTIVE", label: "进行中" },
  { value: "SUCCEEDED", label: "已完成" },
  { value: "FAILED", label: "失败" },
];
function FilteredRecords({
  status,
  templateId,
}: {
  status: TaskFilter["status"];
  templateId: string;
}) {
  const model = useTaskTracker(templateId || undefined, status);
  return <TaskHistory model={model} title="制作记录" status={status} archive />;
}
function PersonalHistory() {
  const [status, setStatus] = useState<TaskFilter["status"]>("ALL");
  const [templateId, setTemplateId] = useState("");
  const templates = useApiResource<TemplateList>("/templates");
  return (
    <>
      <div className="history-toolbar">
        <div className="status-tabs" role="group" aria-label="按制作状态筛选">
          {statuses.map((item) => (
            <button
              type="button"
              key={item.value}
              className={status === item.value ? "selected" : ""}
              aria-pressed={status === item.value}
              onClick={() => setStatus(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="template-filter">
          <label htmlFor="history-template">模板</label>
          <select
            id="history-template"
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
          >
            <option value="">全部模板</option>
            {templates.data?.items.map((item) => (
              <option value={item.id} key={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      {templates.error && (
        <p className="filter-warning" role="status">
          模板筛选暂时不可用。
          <button
            type="button"
            className="text-button"
            onClick={templates.retry}
          >
            重试读取模板
          </button>
        </p>
      )}
      <FilteredRecords
        key={`${status}:${templateId}`}
        status={status}
        templateId={templateId}
      />
    </>
  );
}
export function HistoryPage() {
  const auth = useAuth();
  return (
    <div className="page-shell personal-history">
      <header className="page-intro">
        <div>
          <span className="eyebrow">PERSONAL WORKSPACE</span>
          <h1>我的制作</h1>
          <p>
            {auth.user
              ? `${auth.user.displayName}的个人记录 · 按创建时间排序，查看进度、结果与失败原因。`
              : "选择演示身份，查看自己的制作进度与历史结果。"}
          </p>
        </div>
        <Link className="primary-link" href="/templates">
          <StudioIcon name="grid" size={16} />
          开始新的制作
        </Link>
      </header>
      {auth.user ? (
        <PersonalHistory key={`${auth.user.userId}:${auth.epoch}`} />
      ) : (
        <LoginPanel />
      )}
    </div>
  );
}
