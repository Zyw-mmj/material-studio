import type { components } from "@/types/api.generated";

export type Template = components["schemas"]["Template"];
export type TemplateList = components["schemas"]["TemplateList"];
export type User = components["schemas"]["User"];
export type Asset = components["schemas"]["Asset"];
export type TaskSummary = components["schemas"]["TaskSummary"];
export type TaskDetail = components["schemas"]["TaskDetail"];
export type TaskPage = components["schemas"]["TaskPage"];
export type CreatedTask = components["schemas"]["CreatedTask"];
export type CreateTask = components["schemas"]["CreateTask"];

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}
export async function requestApi<T>(
  path: string,
  signal?: AbortSignal,
  options: RequestInit = {},
): Promise<T> {
  const timeout = AbortSignal.timeout(
    options.body instanceof FormData ? 30_000 : 10_000,
  );
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (typeof options.body === "string")
    headers.set("Content-Type", "application/json");
  const response = await fetch(`/api${path}`, {
    ...options,
    cache: "no-store",
    credentials: "same-origin",
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers,
  });
  if (response.status === 204) return undefined as T;
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error =
      body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const code =
      typeof error.code === "string" ? error.code : "SERVICE_UNAVAILABLE";
    if (
      response.status === 401 &&
      !path.startsWith("/auth/") &&
      !signal?.aborted &&
      typeof window !== "undefined"
    )
      window.dispatchEvent(new Event("studio:unauthorized"));
    throw new ApiRequestError(
      typeof error.message === "string"
        ? error.message
        : "暂时无法连接服务，请稍后重试",
      code,
      response.status,
      typeof error.requestId === "string"
        ? error.requestId
        : (response.headers.get("X-Request-ID") ?? undefined),
    );
  }
  if (!body || typeof body !== "object")
    throw new ApiRequestError(
      "服务返回了无法识别的数据",
      "INVALID_RESPONSE",
      response.status,
    );
  return body as T;
}
export async function mutateApi<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
  extraHeaders?: HeadersInit,
): Promise<T> {
  const csrf = await requestApi<{ token: string }>("/auth/csrf", signal);
  const headers = new Headers(extraHeaders);
  headers.set("X-CSRF-TOKEN", csrf.token);
  return requestApi<T>(path, signal, {
    method: "POST",
    headers,
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
}
export type TaskFilter = {
  status: "ALL" | "ACTIVE";
  templateId?: string;
  cursor?: string;
  limit?: number;
};
export const taskTransport = {
  list(filter: TaskFilter, signal: AbortSignal): Promise<TaskPage> {
    const query = new URLSearchParams({
      status: filter.status,
      limit: String(filter.limit ?? 20),
    });
    if (filter.templateId) query.set("templateId", filter.templateId);
    if (filter.cursor) query.set("cursor", filter.cursor);
    return requestApi(`/tasks?${query}`, signal);
  },
  detail(id: string, signal: AbortSignal): Promise<TaskDetail> {
    return requestApi(`/tasks/${id}`, signal);
  },
};
