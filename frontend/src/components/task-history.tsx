"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { TaskFilter } from "@/lib/api";
import { terminal, type TrackedTask } from "@/lib/task-tracker";
import type { useTaskTracker } from "@/lib/use-task-tracker";
import { StudioDialog } from "./studio-dialog";
import { StudioIcon } from "./studio-icon";

type Tracker = ReturnType<typeof useTaskTracker>["tracker"];
export const taskLabels: Record<string, string> = {
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
function timestamp(value: string, full = false) {
  return new Intl.DateTimeFormat("zh-CN", {
    ...(full ? { year: "numeric" as const } : {}),
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
export function matchesTaskStatus(
  entry: TrackedTask,
  status: TaskFilter["status"],
) {
  return (
    status === "ALL" ||
    (status === "ACTIVE"
      ? !terminal(entry.summary.status)
      : entry.summary.status === status)
  );
}
function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`task-status status-${status.toLowerCase()}`}>
      <span className="status-dot" />
      {taskLabels[status]}
    </span>
  );
}
function QueryWarning({
  entry,
  tracker,
}: {
  entry: TrackedTask;
  tracker: Tracker;
}) {
  if (!entry.queryError) return null;
  return (
    <div className="query-warning" role="status">
      <strong>
        {entry.missing ? "记录不存在或不可访问" : "状态暂时无法更新"}
      </strong>
      <p>{entry.queryError}</p>
      {!entry.missing && (
        <button
          type="button"
          className="text-button"
          onClick={() => tracker.retry(entry.summary.taskId)}
        >
          恢复查询
        </button>
      )}
    </div>
  );
}
function ResultImage({
  entry,
  large = false,
}: {
  entry: TrackedTask;
  large?: boolean;
}) {
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const task = entry.summary;
  if (!task.resultUrl) return null;
  return error ? (
    <div className="result-error">
      <StudioIcon name="image" size={30} />
      <p>图片暂时无法显示，任务仍已完成。</p>
      <button
        type="button"
        className="text-button"
        onClick={() => {
          setRevision((v) => v + 1);
          setError(false);
        }}
      >
        重新加载图片
      </button>
    </div>
  ) : (
    <Image
      src={`${task.resultUrl}?view=${revision}`}
      alt={`${task.templateTitle}的模拟制作结果`}
      width={large ? 1000 : 500}
      height={large ? 800 : 400}
      unoptimized
      onError={() => setError(true)}
    />
  );
}
function StepList({ entry }: { entry: TrackedTask }) {
  return (
    <ol className="step-list" aria-label="制作阶段">
      {entry.detail?.steps.map((step) => (
        <li className={`step-${step.status.toLowerCase()}`} key={step.name}>
          <span className="step-dot" />
          <div>
            <strong>{taskLabels[step.name]}</strong>
            <small>
              {taskLabels[step.status]}
              {step.startedAt && ` · ${timestamp(step.startedAt)}`}
              {step.finishedAt && ` — ${timestamp(step.finishedAt)}`}
            </small>
            {step.errorMessage && <p>{step.errorMessage}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
function TaskCard({
  entry,
  tracker,
  onOpen,
}: {
  entry: TrackedTask;
  tracker: Tracker;
  onOpen: () => void;
}) {
  const task = entry.summary;
  return (
    <article
      className={`task-card task-${task.status.toLowerCase()}`}
      aria-label={`${task.templateTitle} ${taskLabels[task.status]}`}
    >
      {task.status === "SUCCEEDED" ? (
        <div className="task-visual result-preview">
          <ResultImage entry={entry} />
          <button
            type="button"
            className="result-open"
            onClick={onOpen}
            aria-label={`预览${task.templateTitle}的结果，任务 ${task.taskId.slice(0, 8)}`}
          >
            <StudioIcon name="image" />
            查看结果
          </button>
        </div>
      ) : (
        <div
          className={`task-visual ${task.status === "FAILED" ? "failed-visual" : "processing-visual"}`}
        >
          {task.status === "FAILED" ? (
            <>
              <StudioIcon name="error" size={32} />
              <strong>
                {task.currentStep
                  ? `${taskLabels[task.currentStep]}未完成`
                  : "任务未能开始"}
              </strong>
              <span>打开详情查看原因</span>
            </>
          ) : (
            <>
              <span className="progress-orbit" aria-hidden="true" />
              <strong>
                {entry.placeholder
                  ? "任务已受理"
                  : task.currentStep
                    ? taskLabels[task.currentStep]
                    : "已进入制作队列"}
              </strong>
              <span>后台处理中，可继续浏览</span>
            </>
          )}
        </div>
      )}
      <div className="task-card-body">
        <div className="task-card-top">
          <StatusBadge status={task.status} />
          <span className="task-short-id" title={task.taskId}>
            #{task.taskId.slice(0, 8)}
          </span>
        </div>
        <h3>{task.templateTitle}</h3>
        {task.status === "FAILED" && (
          <p className="failure-excerpt">
            {task.errorMessage ?? "正在读取失败原因"}
          </p>
        )}
        <QueryWarning entry={entry} tracker={tracker} />
        <div className="task-card-bottom">
          <time dateTime={task.createdAt}>{timestamp(task.createdAt)}</time>
          <button
            type="button"
            className="text-button"
            aria-label={`查看${task.templateTitle}的任务详情，任务 ${task.taskId.slice(0, 8)}`}
            onClick={onOpen}
          >
            查看详情 <StudioIcon name="arrow" size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}
function TaskDialog({
  entry,
  tracker,
  onClose,
}: {
  entry: TrackedTask | undefined;
  tracker: Tracker;
  onClose: () => void;
}) {
  const task = entry?.summary;
  return (
    <StudioDialog
      open={!!entry}
      onClose={onClose}
      title="制作详情"
      description={
        task
          ? `${task.templateTitle} · ${timestamp(task.createdAt, true)}`
          : undefined
      }
      wide
    >
      {entry && task && (
        <div className="task-detail-layout">
          <section className="detail-result" aria-label="制作结果">
            <div className="detail-result-heading">
              <h3>{task.status === "SUCCEEDED" ? "结果预览" : "当前进度"}</h3>
              <StatusBadge status={task.status} />
            </div>
            {task.status === "SUCCEEDED" ? (
              <div className="large-result">
                <ResultImage entry={entry} large />
              </div>
            ) : (
              <div
                className={`detail-placeholder ${task.status === "FAILED" ? "failed-visual" : "processing-visual"}`}
              >
                {task.status === "FAILED" ? (
                  <StudioIcon name="error" size={38} />
                ) : (
                  <span className="progress-orbit" aria-hidden="true" />
                )}
                <h4>
                  {task.currentStep
                    ? taskLabels[task.currentStep]
                    : taskLabels[task.status]}
                </h4>
                <p role="status">
                  {task.status === "FAILED"
                    ? task.errorMessage
                    : "制作在后台继续，关闭此窗口不会中断任务。"}
                </p>
              </div>
            )}
            <p className="small-muted">模拟结果为第一张输入图片的副本。</p>
            <QueryWarning entry={entry} tracker={tracker} />
            {entry.detail && (
              <div className="input-materials">
                <h3>本次输入素材</h3>
                <div>
                  {entry.detail.assets.map((asset) => (
                    <figure key={asset.position}>
                      <Image
                        src={asset.previewUrl}
                        alt={`本次任务的输入素材 ${asset.position}`}
                        width={160}
                        height={160}
                        unoptimized
                      />
                      <figcaption>素材 {asset.position}</figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            )}
          </section>
          <section className="detail-record" aria-label="任务信息与阶段">
            <h3>任务信息</h3>
            <dl className="record-metadata">
              <div>
                <dt>任务编号</dt>
                <dd className="full-task-id">{task.taskId}</dd>
              </div>
              <div>
                <dt>模板</dt>
                <dd>
                  <Link
                    href={`/templates/${task.templateId}`}
                    onClick={onClose}
                  >
                    {task.templateTitle} <span aria-hidden="true">↗</span>
                  </Link>
                </dd>
              </div>
              <div>
                <dt>创建时间</dt>
                <dd>{timestamp(task.createdAt, true)}</dd>
              </div>
              <div>
                <dt>开始时间</dt>
                <dd>
                  {task.startedAt
                    ? timestamp(task.startedAt, true)
                    : "尚未开始"}
                </dd>
              </div>
              <div>
                <dt>结束时间</dt>
                <dd>
                  {task.finishedAt
                    ? timestamp(task.finishedAt, true)
                    : "尚未结束"}
                </dd>
              </div>
            </dl>
            <h3 className="stages-title">处理阶段</h3>
            {entry.detail ? (
              <StepList entry={entry} />
            ) : (
              <p className="small-muted" role="status">
                {entry.fetching ? "正在读取阶段明细…" : "尚未读取到阶段明细。"}
              </p>
            )}
            {!entry.detail && !entry.fetching && !entry.missing && (
              <button
                type="button"
                className="outline-button"
                onClick={() => tracker.retry(task.taskId)}
              >
                重新读取详情
              </button>
            )}
            {task.errorCode && (
              <p className="error-code">失败代码：{task.errorCode}</p>
            )}
            <p className="last-synced">
              {entry.fetching
                ? "正在同步状态…"
                : entry.lastSyncedAt
                  ? `最后同步 ${new Date(entry.lastSyncedAt).toLocaleTimeString("zh-CN", { hour12: false })}`
                  : "等待同步"}
            </p>
          </section>
        </div>
      )}
    </StudioDialog>
  );
}
export function TaskHistory({
  model,
  title = "本模板的制作记录",
  status = "ALL",
  archive = false,
}: {
  model: ReturnType<typeof useTaskTracker>;
  title?: string;
  status?: TaskFilter["status"];
  archive?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const entries = model.entries.filter((entry) =>
    matchesTaskStatus(entry, status),
  );
  const selected = model.entries.find(
    (entry) => entry.summary.taskId === selectedId,
  );
  const active = model.entries.filter(
    (entry) => !terminal(entry.summary.status),
  ).length;
  return (
    <section
      className={`task-history${archive ? " archive-records" : ""}`}
      aria-label={title}
    >
      <div className="history-heading">
        <div>
          <h2>{title}</h2>
          {!archive && <p>受理后会自动更新，离开页面也会继续制作。</p>}
        </div>
        <div className="history-heading-actions">
          {!archive && (
            <Link href="/history" className="text-link">
              全部记录 <StudioIcon name="arrow" size={14} />
            </Link>
          )}
          <button
            type="button"
            className="icon-button"
            aria-disabled={model.loading}
            onClick={() => {
              if (!model.loading) void model.tracker.refresh();
            }}
            aria-label="刷新制作记录"
          >
            <StudioIcon name="refresh" />
          </button>
        </div>
      </div>
      <p className="history-summary" role="status">
        {model.loading
          ? "正在同步记录…"
          : `当前显示 ${entries.length} 条${model.nextCursor ? "，可加载更早记录" : ""}`}
        {active > 0 && <span> · {active} 项正在处理中</span>}
      </p>
      {model.listError && (
        <div className="query-warning" role="alert">
          <strong>制作记录暂时无法更新</strong>
          <p>{model.listError}</p>
          <button
            type="button"
            className="text-button"
            onClick={() => void model.tracker.refresh()}
          >
            恢复历史查询
          </button>
        </div>
      )}
      {model.loading && entries.length === 0 && (
        <div className="task-grid" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div className="task-skeleton" key={i} />
          ))}
        </div>
      )}
      {!model.loading && !model.listError && !entries.length && (
        <div className="history-empty">
          <StudioIcon name="history" size={34} />
          <h3>
            {status === "ALL" ? "还没有制作记录" : "没有符合筛选条件的记录"}
          </h3>
          <p>
            {status === "ACTIVE"
              ? "处理完成的任务会出现在“已完成”或“失败”中。"
              : status !== "ALL"
                ? "试试其他状态或模板，查看已有制作。"
                : "选择模板并上传图片，你的作品会出现在这里。"}
          </p>
          {status === "ALL" && (
            <Link className="outline-button" href="/templates">
              去选择模板 <StudioIcon name="arrow" size={16} />
            </Link>
          )}
        </div>
      )}
      <div className="task-grid">
        {entries.map((entry) => (
          <TaskCard
            key={entry.summary.taskId}
            entry={entry}
            tracker={model.tracker}
            onOpen={() => {
              setSelectedId(entry.summary.taskId);
              model.tracker.readDetail(entry.summary.taskId);
            }}
          />
        ))}
      </div>
      {model.nextCursor && (
        <button
          type="button"
          className="outline-button load-more"
          aria-disabled={model.loading}
          onClick={() => {
            if (!model.loading) void model.tracker.loadMore();
          }}
        >
          {model.loading ? "正在加载…" : "加载更早的记录"}
        </button>
      )}
      <TaskDialog
        entry={selected}
        tracker={model.tracker}
        onClose={() => setSelectedId(null)}
      />
    </section>
  );
}
