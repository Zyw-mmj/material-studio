import type { components } from "@/types/api.generated";

export type Template = components["schemas"]["Template"];
export type TemplateList = components["schemas"]["TemplateList"];

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
): Promise<T> {
  const timeout = AbortSignal.timeout(10_000);
  const response = await fetch(`/api${path}`, {
    cache: "no-store",
    credentials: "same-origin",
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers: { Accept: "application/json" },
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error =
      body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    throw new ApiRequestError(
      typeof error.message === "string"
        ? error.message
        : "暂时无法连接服务，请稍后重试",
      typeof error.code === "string" ? error.code : "SERVICE_UNAVAILABLE",
      response.status,
      typeof error.requestId === "string"
        ? error.requestId
        : (response.headers.get("X-Request-ID") ?? undefined),
    );
  }
  if (!body || typeof body !== "object") {
    throw new ApiRequestError(
      "服务返回了无法识别的数据",
      "INVALID_RESPONSE",
      response.status,
    );
  }
  return body as T;
}
