import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useApiResource } from "./use-api-resource";

it("cancels old requests and ignores late responses after changing resources", async () => {
  let finishOld!: (value: Response) => void;
  let oldSignal: AbortSignal | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, options: RequestInit) => {
      if (url.endsWith("/first")) {
        oldSignal = options.signal as AbortSignal;
        return new Promise<Response>((resolve) => {
          finishOld = resolve;
        });
      }
      return Promise.resolve(new Response(JSON.stringify({ id: "second" })));
    }),
  );
  const { result, rerender, unmount } = renderHook(
    ({ path }) => useApiResource<{ id: string }>(path),
    { initialProps: { path: "/first" } },
  );
  rerender({ path: "/second" });
  await waitFor(() => expect(result.current.data?.id).toBe("second"));
  expect(oldSignal?.aborted).toBe(true);
  await act(async () => {
    finishOld(new Response(JSON.stringify({ id: "first" })));
  });
  expect(result.current.data?.id).toBe("second");
  unmount();
});
