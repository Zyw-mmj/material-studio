import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError, type TaskDetail, type TaskSummary } from "./api";
import { TaskTracker, type TaskTransport } from "./task-tracker";
const time = "2026-10-28T14:00:00Z";
function summary(
  id: string,
  status: TaskSummary["status"] = "RUNNING",
  version = 1,
): TaskSummary {
  return {
    taskId: id,
    templateId: "demo-avatar",
    templateTitle: id,
    status,
    currentStep: status === "SUCCEEDED" ? "FINALIZE" : "GENERATE",
    resultUrl: status === "SUCCEEDED" ? `/api/tasks/${id}/result` : null,
    errorCode: null,
    errorMessage: null,
    version,
    createdAt: time,
    updatedAt: time,
    startedAt: time,
    finishedAt: status === "SUCCEEDED" ? time : null,
  };
}
function detail(
  id: string,
  status: TaskSummary["status"] = "RUNNING",
  version = 2,
): TaskDetail {
  return {
    ...summary(id, status, version),
    assets: [
      {
        assetId: "asset",
        position: 1,
        previewUrl: "/api/assets/asset/content",
      },
    ],
    steps: ["VALIDATE", "GENERATE", "FINALIZE"].map((name, index) => ({
      name: name as "VALIDATE" | "GENERATE" | "FINALIZE",
      order: index + 1,
      status:
        status === "SUCCEEDED"
          ? "SUCCEEDED"
          : index === 0
            ? "SUCCEEDED"
            : index === 1
              ? "RUNNING"
              : "PENDING",
      startedAt: index < 2 ? time : null,
      finishedAt: index === 0 ? time : null,
      errorCode: null,
      errorMessage: null,
    })),
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
function transport(items: TaskSummary[]): TaskTransport {
  return {
    list: vi.fn(async () => ({ items, nextCursor: null })),
    detail: vi.fn(async (id) => detail(id, "SUCCEEDED")),
  };
}
const stores: TaskTracker[] = [];
function store(api: TaskTransport) {
  const value = new TaskTracker(api);
  stores.push(value);
  return value;
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  stores.splice(0).forEach((s) => s.stop());
  vi.useRealTimers();
});
describe("page-scoped task queries", () => {
  it("keeps multiple tasks independent when replies arrive out of order", async () => {
    const a = deferred<TaskDetail>(),
      b = deferred<TaskDetail>();
    const api = transport([summary("a"), summary("b")]);
    api.detail = vi.fn((id) => (id === "a" ? a.promise : b.promise));
    const tracker = store(api);
    tracker.start();
    await flush();
    await vi.advanceTimersByTimeAsync(0);
    b.resolve(detail("b", "SUCCEEDED", 4));
    await flush();
    a.resolve(detail("a", "RUNNING", 2));
    await flush();
    const entries = tracker.getSnapshot().entries;
    expect(entries.find((e) => e.summary.taskId === "a")?.summary.status).toBe(
      "RUNNING",
    );
    expect(entries.find((e) => e.summary.taskId === "b")?.summary.status).toBe(
      "SUCCEEDED",
    );
  });
  it("stops automatic requests for terminal tasks and when none remain", async () => {
    const api = transport([summary("a")]);
    const tracker = store(api);
    tracker.start();
    await flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(api.detail).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60000);
    expect(api.detail).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("preserves business status on query failure and recovers on retry", async () => {
    const api = transport([summary("a")]);
    api.detail = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiRequestError("网络不可用", "SERVICE_UNAVAILABLE", 503),
      )
      .mockResolvedValue(detail("a", "SUCCEEDED", 4));
    const tracker = store(api);
    tracker.start();
    await flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(tracker.getSnapshot().entries[0].summary.status).toBe("RUNNING");
    expect(tracker.getSnapshot().entries[0].queryError).toBe("网络不可用");
    tracker.retry("a");
    await vi.advanceTimersByTimeAsync(0);
    expect(api.detail).toHaveBeenCalledTimes(2);
    expect(tracker.getSnapshot().entries[0].summary.status).toBe("SUCCEEDED");
    expect(tracker.getSnapshot().entries[0].queryError).toBeNull();
  });
  it("aborts requests and ignores late replies after leaving the page", async () => {
    const pending = deferred<TaskDetail>();
    let signal: AbortSignal | undefined;
    const api = transport([summary("a")]);
    api.detail = vi.fn((_, s) => {
      signal = s;
      return pending.promise;
    });
    const tracker = store(api);
    tracker.start();
    await flush();
    await vi.advanceTimersByTimeAsync(0);
    tracker.stop();
    expect(signal?.aborted).toBe(true);
    pending.resolve(detail("a", "SUCCEEDED", 4));
    await flush();
    expect(tracker.getSnapshot().entries[0].summary.status).toBe("RUNNING");
    expect(vi.getTimerCount()).toBe(0);
  });
  it("restores active tasks beyond the first history page", async () => {
    const api = transport([]);
    api.list = vi.fn(async (filter) =>
      filter.status === "ALL"
        ? {
            items: [summary("recent", "SUCCEEDED", 4)],
            nextCursor: "history-next",
          }
        : filter.cursor
          ? { items: [summary("oldest")], nextCursor: null }
          : { items: [summary("older")], nextCursor: "active-next" },
    );
    const tracker = store(api);
    tracker.start();
    await flush();
    expect(tracker.getSnapshot().entries.map((e) => e.summary.taskId)).toEqual(
      expect.arrayContaining(["recent", "older", "oldest"]),
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(api.detail).toHaveBeenCalledTimes(2);
    expect(api.detail).not.toHaveBeenCalledWith("recent", expect.anything());
  });
  it("limits detail concurrency and does not overlap the same task", async () => {
    const pending = Array.from({ length: 6 }, () => deferred<TaskDetail>());
    const api = transport(
      Array.from({ length: 6 }, (_, i) => summary(String(i))),
    );
    api.detail = vi.fn((id) => pending[Number(id)].promise);
    const tracker = store(api);
    tracker.start();
    await flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(api.detail).toHaveBeenCalledTimes(4);
    tracker.retry("0");
    await vi.advanceTimersByTimeAsync(0);
    expect(api.detail).toHaveBeenCalledTimes(4);
    pending[0].resolve(detail("0", "SUCCEEDED", 4));
    await flush();
    expect(api.detail).toHaveBeenCalledTimes(5);
  });
  it("never overwrites a newer snapshot with an older in-flight reply", async () => {
    const pending = deferred<TaskDetail>();
    const api = transport([summary("a", "RUNNING", 1)]);
    api.detail = vi.fn(() => pending.promise);
    const tracker = store(api);
    tracker.start();
    await flush();
    await vi.advanceTimersByTimeAsync(0);
    api.list = vi.fn(async () => ({
      items: [summary("a", "RUNNING", 5)],
      nextCursor: null,
    }));
    await tracker.refresh();
    pending.resolve(detail("a", "RUNNING", 2));
    await flush();
    expect(tracker.getSnapshot().entries[0].summary.version).toBe(5);
  });
  it("stops inaccessible tasks without inventing a FAILED business status", async () => {
    const api = transport([summary("a")]);
    api.detail = vi
      .fn()
      .mockRejectedValue(
        new ApiRequestError("不可访问", "TASK_NOT_FOUND", 404),
      );
    const tracker = store(api);
    tracker.start();
    await flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(tracker.getSnapshot().entries[0].missing).toBe(true);
    expect(tracker.getSnapshot().entries[0].summary.status).toBe("RUNNING");
    await vi.advanceTimersByTimeAsync(30000);
    expect(api.detail).toHaveBeenCalledTimes(1);
  });
  it("pauses while hidden and restores pending records on resume", async () => {
    const pending = deferred<TaskDetail>();
    const api = transport([summary("a")]);
    api.detail = vi
      .fn()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue(detail("a", "SUCCEEDED", 4));
    const tracker = store(api);
    tracker.start();
    await flush();
    await vi.advanceTimersByTimeAsync(0);
    tracker.suspend();
    pending.resolve(detail("a", "SUCCEEDED", 4));
    await flush();
    await vi.advanceTimersByTimeAsync(30000);
    expect(tracker.getSnapshot().entries[0].summary.status).toBe("RUNNING");
    tracker.resume();
    await flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(tracker.getSnapshot().entries[0].summary.status).toBe("SUCCEEDED");
  });
});
