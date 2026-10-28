"use client";

import Image from "next/image";
import { useState } from "react";
import type { TrackedTask } from "@/lib/task-tracker";
import { terminal } from "@/lib/task-tracker";
import type { useTaskTracker } from "@/lib/use-task-tracker";

const labels: Record<string, string> = {
  QUEUED: "等待处理",
  RUNNING: "正在制作",
  SUCCEEDED: "制作完成",
  FAILED: "制作失败",
  PENDING: "尚未开始",
  SKIPPED: "未执行",
  VALIDATE: "素材检查",
  GENERATE: "模拟生成",
  FINALIZE: "结果整理",
};
function timestamp(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
export function TaskCard({
  entry,
  tracker,
}: {
  entry: TrackedTask;
  tracker: ReturnType<typeof useTaskTracker>["tracker"];
}) {
  const { summary: task, detail } = entry;
  const [expanded, setExpanded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageVersion, setImageVersion] = useState(0);
  return (
    <article
      className={`task-card task-${task.status.toLowerCase()}`}
      aria-label={`${task.templateTitle} ${labels[task.status]}`}
    >
      <div className="task-card-top">
        <span className={`task-status status-${task.status.toLowerCase()}`}>
          <span className="status-dot" />
          {entry.placeholder ? "正在读取任务详情" : labels[task.status]}
        </span>
        <time dateTime={task.createdAt}>{timestamp(task.createdAt)}</time>
      </div>
      <h3>{task.templateTitle}</h3>
      <p className="task-id">{task.taskId}</p>
      {task.status === "SUCCEEDED" && task.resultUrl && (
        <div className="result-preview">
          {imageError ? (
            <div className="result-error">
              <p>结果暂时无法显示，任务仍已完成。</p>
              <button
                className="text-button"
                onClick={() => {
                  setImageVersion((v) => v + 1);
                  setImageError(false);
                }}
              >
                重新加载图片
              </button>
            </div>
          ) : (
            <Image
              src={`${task.resultUrl}?view=${imageVersion}`}
              alt={`${task.templateTitle}的模拟制作结果`}
              width={500}
              height={400}
              unoptimized
              onError={() => setImageError(true)}
            />
          )}
        </div>
      )}
      {!terminal(task.status) && (
        <div className="task-progress">
          <span className="progress-orbit" aria-hidden="true" />
          <p>
            {task.currentStep
              ? labels[task.currentStep]
              : entry.placeholder
                ? "任务已受理，正在读取进度"
                : "任务已进入队列"}
            <small>制作在后台继续，您可以离开此页面。</small>
          </p>
        </div>
      )}
      {task.status === "FAILED" && (
        <div className="task-failure">
          <strong>
            {task.currentStep
              ? `${labels[task.currentStep]}未完成`
              : "任务未能开始"}
          </strong>
          <p>{task.errorMessage ?? "正在读取失败原因"}</p>
        </div>
      )}
      {entry.queryError && (
        <div className="query-warning" role="status">
          <strong>
            {entry.missing ? "任务不存在或不可访问" : "状态暂时无法更新"}
          </strong>
          <p>{entry.queryError}</p>
          {!entry.missing && (
            <button
              className="text-button"
              onClick={() => tracker.retry(task.taskId)}
            >
              重新查询
            </button>
          )}
        </div>
      )}
      <div className="task-card-bottom">
        <button
          className="text-button"
          aria-expanded={expanded}
          onClick={() => {
            setExpanded(!expanded);
            if (!expanded) tracker.readDetail(task.taskId);
          }}
        >
          {expanded ? "收起阶段" : "阶段详情"}{" "}
          <span aria-hidden="true">{expanded ? "−" : "+"}</span>
        </button>
        <span>
          {entry.fetching
            ? "同步中…"
            : entry.lastSyncedAt
              ? `同步于 ${new Date(entry.lastSyncedAt).toLocaleTimeString("zh-CN", { hour12: false })}`
              : "待同步"}
        </span>
      </div>
      {(expanded || !terminal(task.status)) && detail && (
        <ol className="step-list" aria-label="制作阶段">
          {detail.steps.map((step) => (
            <li className={`step-${step.status.toLowerCase()}`} key={step.name}>
              <span className="step-dot" />
              <div>
                <strong>{labels[step.name]}</strong>
                <small>
                  {labels[step.status]}
                  {step.errorMessage ? ` · ${step.errorMessage}` : ""}
                </small>
              </div>
            </li>
          ))}
        </ol>
      )}
      {expanded && !detail && (
        <p className="small-muted">
          {entry.fetching
            ? "正在获取阶段明细…"
            : "尚未读取到阶段明细，可重新查询。"}
        </p>
      )}
    </article>
  );
}
export function TaskHistory({
  model,
  title = "本模板的制作记录",
}: {
  model: ReturnType<typeof useTaskTracker>;
  title?: string;
}) {
  return (
    <section className="task-history" aria-label={title}>
      <div className="history-heading">
        <div>
          <span className="section-number">YOUR CREATIONS</span>
          <h2>{title}</h2>
        </div>
        <button
          className="refresh-button"
          disabled={model.loading}
          onClick={() => void model.tracker.refresh()}
          aria-label="刷新制作记录"
        >
          ↻
        </button>
      </div>
      <p className="history-hint">
        每一次灵感，都有迹可循。结果与进度会自动保存。
      </p>
      {model.listError && (
        <div className="query-warning" role="alert">
          <p>{model.listError}</p>
          <button
            className="text-button"
            onClick={() => void model.tracker.refresh()}
          >
            恢复历史查询
          </button>
        </div>
      )}
      {model.loading && model.entries.length === 0 && (
        <p className="small-muted" role="status">
          正在读取个人记录…
        </p>
      )}
      {!model.loading && !model.listError && model.entries.length === 0 && (
        <div className="history-empty">
          <span aria-hidden="true">⌑</span>
          <h3>你的第一张作品，从这里开始。</h3>
          <p>上传素材并创建任务，记录就会出现在这里。</p>
        </div>
      )}
      <div className="task-grid">
        {model.entries.map((entry) => (
          <TaskCard
            key={entry.summary.taskId}
            entry={entry}
            tracker={model.tracker}
          />
        ))}
      </div>
      {model.nextCursor && (
        <button
          className="outline-button load-more"
          disabled={model.loading}
          onClick={() => void model.tracker.loadMore()}
        >
          {model.loading ? "正在加载…" : "更早的制作记录"}
        </button>
      )}
    </section>
  );
}
