import { describe, expect, it, vi } from "vitest";
import { ApiRequestError, requestApi } from "./api";

describe("API response handling", () => {
  it("preserves server error codes and request IDs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "TEMPLATE_NOT_FOUND",
            message: "模板不存在",
            requestId: "request-test",
          }),
          { status: 404 },
        ),
      ),
    );
    await expect(requestApi("/templates/missing")).rejects.toMatchObject({
      code: "TEMPLATE_NOT_FOUND",
      status: 404,
      requestId: "request-test",
      message: "模板不存在",
    });
  });
  it("handles a proxy's non-JSON outage response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("Bad Gateway", {
          status: 502,
          headers: { "X-Request-ID": "proxy-test" },
        }),
      ),
    );
    await expect(requestApi("/templates")).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      status: 502,
      requestId: "proxy-test",
    });
  });
  it("rejects malformed successful responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("null", { status: 200 })),
    );
    await expect(requestApi("/templates")).rejects.toBeInstanceOf(
      ApiRequestError,
    );
  });
});
