import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { TrackedTask } from "@/lib/task-tracker";
import type { useTaskTracker } from "@/lib/use-task-tracker";
import { mockDialog } from "@/test/dialog";
import { TaskHistory } from "./task-history";
const date = "2026-10-28T14:00:00Z";
function entry(
  id: string,
  status: "SUCCEEDED" | "FAILED" | "RUNNING",
): TrackedTask {
  const summary = {
    taskId: id,
    templateId: "demo-avatar",
    templateTitle: `模板 ${id}`,
    status,
    currentStep: "GENERATE" as const,
    resultUrl: status === "SUCCEEDED" ? `/api/tasks/${id}/result` : null,
    errorCode: status === "FAILED" ? "SIMULATED_FAILURE" : null,
    errorMessage: status === "FAILED" ? "测试配置触发失败" : null,
    version: 3,
    createdAt: date,
    updatedAt: date,
    startedAt: date,
    finishedAt: status === "RUNNING" ? null : date,
  };
  return {
    summary,
    queryError: null,
    lastSyncedAt: Date.parse(date),
    fetching: false,
    missing: false,
    detail: {
      ...summary,
      assets: [
        {
          assetId: "asset-a",
          position: 1,
          previewUrl: "/api/assets/asset-a/content",
        },
      ],
      steps: [
        {
          name: "VALIDATE",
          order: 1,
          status: "SUCCEEDED",
          startedAt: date,
          finishedAt: date,
          errorCode: null,
          errorMessage: null,
        },
        {
          name: "GENERATE",
          order: 2,
          status:
            status === "FAILED"
              ? "FAILED"
              : status === "RUNNING"
                ? "RUNNING"
                : "SUCCEEDED",
          startedAt: date,
          finishedAt: date,
          errorCode: summary.errorCode,
          errorMessage: summary.errorMessage,
        },
        {
          name: "FINALIZE",
          order: 3,
          status:
            status === "FAILED"
              ? "SKIPPED"
              : status === "RUNNING"
                ? "PENDING"
                : "SUCCEEDED",
          startedAt: null,
          finishedAt: null,
          errorCode: null,
          errorMessage: null,
        },
      ],
    },
  };
}
function model(entries: TrackedTask[]) {
  return {
    entries,
    loading: false,
    listError: null,
    nextCursor: null,
    tracker: {
      readDetail: vi.fn(),
      retry: vi.fn(),
      refresh: vi.fn(),
      loadMore: vi.fn(),
    },
  } as unknown as ReturnType<typeof useTaskTracker>;
}
beforeEach(mockDialog);
it("shows only matching history while retaining active records for state tracking", () => {
  render(
    <TaskHistory
      model={model([
        entry("success", "SUCCEEDED"),
        entry("failed", "FAILED"),
        entry("active", "RUNNING"),
      ])}
      status="SUCCEEDED"
    />,
  );
  expect(
    screen.getByRole("article", { name: "模板 success 制作完成" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("article", { name: /模板 failed/ }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("article", { name: /模板 active/ }),
  ).not.toBeInTheDocument();
  expect(screen.getByText(/当前显示 1 条/)).toBeInTheDocument();
});
it("opens failure details with inputs and skipped stages, and restores the trigger on Escape", () => {
  const data = model([entry("failed", "FAILED")]);
  render(<TaskHistory model={data} />);
  const trigger = screen.getByRole("button", {
    name: /查看模板 failed的任务详情/,
  });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog", { name: "制作详情" });
  expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(within(dialog).getByText("未执行")).toBeInTheDocument();
  expect(
    within(dialog).getByRole("img", { name: "本次任务的输入素材 1" }),
  ).toBeInTheDocument();
  expect(data.tracker.readDetail).toHaveBeenCalledWith("failed");
  const close = within(dialog).getByRole("button", { name: "关闭制作详情" });
  const templateLink = within(dialog).getByRole("link", {
    name: /模板 failed/,
  });
  close.focus();
  fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
  expect(templateLink).toHaveFocus();
  fireEvent.keyDown(templateLink, { key: "Tab" });
  expect(close).toHaveFocus();
  fireEvent(dialog, new Event("cancel", { cancelable: true }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  expect(document.body.style.overflow).toBe("");
});
it("keeps a running business status on query errors and offers recovery", () => {
  const record = {
    ...entry("active", "RUNNING"),
    queryError: "网络暂时不可用",
  };
  const data = model([record]);
  render(<TaskHistory model={data} />);
  expect(
    screen.getByRole("article", { name: "模板 active 正在制作" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "恢复查询" }));
  expect(data.tracker.retry).toHaveBeenCalledWith("active");
  expect(screen.queryByText("制作失败")).not.toBeInTheDocument();
});
it("reports a filter empty state rather than claiming the user has no records", () => {
  render(
    <TaskHistory model={model([entry("active", "RUNNING")])} status="FAILED" />,
  );
  expect(screen.getByText("没有符合筛选条件的记录")).toBeInTheDocument();
  expect(screen.queryByText("还没有制作记录")).not.toBeInTheDocument();
});
