import {
  ApiRequestError,
  type CreatedTask,
  type TaskDetail,
  type TaskFilter,
  type TaskPage,
  type TaskSummary,
  type Template,
} from "./api";

export const terminal = (status: string) =>
  status === "SUCCEEDED" || status === "FAILED";
export type TrackedTask = {
  summary: TaskSummary;
  detail?: TaskDetail;
  queryError: string | null;
  lastSyncedAt: number | null;
  fetching: boolean;
  missing: boolean;
  placeholder?: boolean;
};
export type TaskSnapshot = {
  entries: TrackedTask[];
  loading: boolean;
  listError: string | null;
  nextCursor: string | null;
};
export type TaskTransport = {
  list: (filter: TaskFilter, signal: AbortSignal) => Promise<TaskPage>;
  detail: (id: string, signal: AbortSignal) => Promise<TaskDetail>;
};
type Watch = {
  timer?: ReturnType<typeof setTimeout>;
  controller?: AbortController;
  busy: boolean;
  failures: number;
  force: boolean;
};

/** A page-scoped scheduler. Business statuses only change from server responses. */
export class TaskTracker {
  private records = new Map<string, TrackedTask>();
  private listeners = new Set<() => void>();
  private watches = new Map<string, Watch>();
  private queue = new Set<string>();
  private running = false;
  private paused = false;
  private cycle = 0;
  private concurrent = 0;
  private listController?: AbortController;
  private snapshot: TaskSnapshot = {
    entries: [],
    loading: true,
    listError: null,
    nextCursor: null,
  };
  constructor(
    private transport: TaskTransport,
    private templateId?: string,
    readonly scope = "",
    private statusFilter: TaskFilter["status"] = "ALL",
  ) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private emit(patch: Partial<TaskSnapshot> = {}) {
    this.snapshot = {
      ...this.snapshot,
      ...patch,
      entries: [...this.records.values()].sort(
        (a, b) =>
          Date.parse(b.summary.createdAt) - Date.parse(a.summary.createdAt) ||
          b.summary.taskId.localeCompare(a.summary.taskId),
      ),
    };
    this.listeners.forEach((listener) => listener());
  }
  start() {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    ++this.cycle;
    void this.refresh();
  }
  stop() {
    this.running = false;
    this.cancel();
  }
  private cancel() {
    ++this.cycle;
    this.listController?.abort();
    for (const watch of this.watches.values()) {
      clearTimeout(watch.timer);
      watch.controller?.abort();
    }
    this.watches.clear();
    this.queue.clear();
    this.concurrent = 0;
  }
  suspend() {
    this.paused = true;
    this.cancel();
  }
  resume() {
    if (!this.running) return;
    this.paused = false;
    void this.refresh();
  }
  private alive(cycle: number) {
    return this.running && !this.paused && cycle === this.cycle;
  }
  private accept(summary: TaskSummary, detail?: TaskDetail) {
    const old = this.records.get(summary.taskId);
    if (old && summary.version < old.summary.version) return;
    this.records.set(summary.taskId, {
      summary,
      detail:
        detail ??
        (old?.summary.version === summary.version ? old.detail : undefined),
      queryError: null,
      lastSyncedAt: Date.now(),
      fetching: false,
      missing: false,
    });
    this.emit();
    if (terminal(summary.status)) {
      const watch = this.watches.get(summary.taskId);
      if (watch && !watch.busy) {
        clearTimeout(watch.timer);
        this.watches.delete(summary.taskId);
        this.queue.delete(summary.taskId);
      }
    }
  }
  async refresh() {
    if (!this.running || this.paused) return;
    this.listController?.abort();
    const controller = new AbortController();
    this.listController = controller;
    const cycle = this.cycle;
    this.emit({ loading: true, listError: null });
    for (const entry of this.records.values())
      if (!terminal(entry.summary.status) && !entry.missing)
        this.schedule(entry.summary.taskId, 0);
    try {
      const first = await this.transport.list(
        { status: this.statusFilter, templateId: this.templateId, limit: 20 },
        controller.signal,
      );
      if (!this.alive(cycle) || controller.signal.aborted) return;
      first.items.forEach((item) => {
        this.accept(item);
        if (!terminal(item.status)) this.schedule(item.taskId, 0);
      });
      this.emit({ nextCursor: first.nextCursor });
      let cursor: string | undefined;
      do {
        const active = await this.transport.list(
          { status: "ACTIVE", templateId: this.templateId, limit: 100, cursor },
          controller.signal,
        );
        if (!this.alive(cycle) || controller.signal.aborted) return;
        active.items.forEach((item) => {
          this.accept(item);
          if (!terminal(item.status)) this.schedule(item.taskId, 0);
        });
        cursor = active.nextCursor ?? undefined;
      } while (cursor);
      if (this.statusFilter === "ACTIVE") this.emit({ nextCursor: null });
    } catch (error) {
      if (this.alive(cycle) && !controller.signal.aborted)
        this.emit({
          listError: error instanceof Error ? error.message : "历史查询失败",
        });
    } finally {
      if (
        this.alive(cycle) &&
        this.listController === controller &&
        !controller.signal.aborted
      )
        this.emit({ loading: false });
    }
  }
  async loadMore() {
    const cursor = this.snapshot.nextCursor;
    if (!cursor || this.snapshot.loading || !this.running || this.paused)
      return;
    const controller = new AbortController();
    this.listController?.abort();
    this.listController = controller;
    const cycle = this.cycle;
    this.emit({ loading: true, listError: null });
    try {
      const page = await this.transport.list(
        {
          status: this.statusFilter,
          templateId: this.templateId,
          limit: 20,
          cursor,
        },
        controller.signal,
      );
      if (!this.alive(cycle) || controller.signal.aborted) return;
      page.items.forEach((item) => {
        this.accept(item);
        if (!terminal(item.status)) this.schedule(item.taskId, 0);
      });
      this.emit({ nextCursor: page.nextCursor });
    } catch (error) {
      if (this.alive(cycle) && !controller.signal.aborted)
        this.emit({
          listError: error instanceof Error ? error.message : "加载更多失败",
        });
    } finally {
      if (this.alive(cycle) && !controller.signal.aborted)
        this.emit({ loading: false });
    }
  }
  add(created: CreatedTask, template: Template) {
    const summary: TaskSummary = {
      taskId: created.taskId,
      templateId: template.id,
      templateTitle: template.title,
      status: created.status,
      currentStep: null,
      resultUrl: null,
      errorCode: null,
      errorMessage: null,
      version: -1,
      createdAt: created.createdAt,
      updatedAt: created.createdAt,
      startedAt: null,
      finishedAt: null,
    };
    if (!this.records.has(summary.taskId))
      this.records.set(summary.taskId, {
        summary,
        queryError: null,
        lastSyncedAt: null,
        fetching: false,
        missing: false,
        placeholder: true,
      });
    this.emit();
    this.schedule(summary.taskId, 0, true);
  }
  retry(id: string) {
    const watch = this.watches.get(id);
    if (watch) watch.failures = 0;
    this.schedule(id, 0, true);
  }
  readDetail(id: string) {
    if (!this.records.get(id)?.detail) this.schedule(id, 0, true);
  }
  private schedule(id: string, delay: number, force = false) {
    if (!this.running || this.paused) return;
    const record = this.records.get(id);
    if (
      !record ||
      record.missing ||
      (!force && terminal(record.summary.status))
    )
      return;
    let watch = this.watches.get(id);
    if (!watch) {
      watch = { busy: false, failures: 0, force };
      this.watches.set(id, watch);
    } else watch.force ||= force;
    if (force && watch.timer) {
      clearTimeout(watch.timer);
      watch.timer = undefined;
    }
    if (watch.busy || watch.timer) return;
    watch.timer = setTimeout(() => {
      if (this.watches.get(id) !== watch) return;
      watch.timer = undefined;
      this.queue.add(id);
      this.drain();
    }, delay);
  }
  private drain() {
    while (
      this.running &&
      !this.paused &&
      this.concurrent < 4 &&
      this.queue.size
    ) {
      const id = this.queue.values().next().value!;
      this.queue.delete(id);
      const watch = this.watches.get(id);
      const record = this.records.get(id);
      if (!watch || watch.busy || !record) continue;
      if (terminal(record.summary.status) && !watch.force) {
        this.watches.delete(id);
        continue;
      }
      void this.fetch(id, watch);
    }
  }
  private async fetch(id: string, watch: Watch) {
    const cycle = this.cycle;
    const controller = new AbortController();
    watch.controller = controller;
    watch.busy = true;
    watch.force = false;
    this.concurrent++;
    const old = this.records.get(id)!;
    this.records.set(id, { ...old, fetching: true });
    this.emit();
    try {
      const detail = await this.transport.detail(id, controller.signal);
      if (!this.alive(cycle) || controller.signal.aborted) return;
      this.accept(detail, detail);
      watch.failures = 0;
    } catch (error) {
      if (!this.alive(cycle) || controller.signal.aborted) return;
      const existing = this.records.get(id);
      if (existing)
        this.records.set(id, {
          ...existing,
          fetching: false,
          queryError:
            error instanceof Error ? error.message : "状态暂时无法更新",
          missing: error instanceof ApiRequestError && error.status === 404,
        });
      watch.failures++;
      this.emit();
    } finally {
      if (this.alive(cycle) && this.watches.get(id) === watch) {
        watch.busy = false;
        watch.controller = undefined;
        this.concurrent--;
        const current = this.records.get(id);
        if (!current || current.missing || terminal(current.summary.status)) {
          this.watches.delete(id);
          this.queue.delete(id);
        } else
          this.schedule(
            id,
            watch.force
              ? 0
              : watch.failures
                ? Math.min(2000 * 2 ** (watch.failures - 1), 30000)
                : 2000,
            watch.force,
          );
        this.drain();
      }
    }
  }
}
