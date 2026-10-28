import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./auth-provider";
import { mutateApi, requestApi, type User } from "@/lib/api";
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  requestApi: vi.fn(),
  mutateApi: vi.fn(),
}));
const a: User = { userId: "demo-a", displayName: "演示用户 A", mode: "DEMO" };
const b: User = { userId: "demo-b", displayName: "演示用户 B", mode: "DEMO" };
function Reader() {
  const auth = useAuth();
  return (
    <div>
      <output data-testid="identity">{auth.user?.userId ?? "none"}</output>
      <button onClick={() => void auth.login("demo-b")}>切换 B</button>
    </div>
  );
}
beforeEach(() => {
  vi.stubGlobal("BroadcastChannel", undefined);
});
it("does not restore an old identity when an earlier me request arrives after switching", async () => {
  let old!: (value: User) => void;
  vi.mocked(requestApi)
    .mockReturnValueOnce(
      new Promise((resolve) => {
        old = resolve;
      }),
    )
    .mockResolvedValue(b);
  vi.mocked(mutateApi).mockResolvedValue(b);
  render(
    <AuthProvider>
      <Reader />
    </AuthProvider>,
  );
  fireEvent.click(screen.getByText("切换 B"));
  await waitFor(() =>
    expect(screen.getByTestId("identity")).toHaveTextContent("demo-b"),
  );
  old(a);
  await Promise.resolve();
  expect(screen.getByTestId("identity")).toHaveTextContent("demo-b");
});
it("clears the current identity before rechecking a change made in another tab", async () => {
  vi.mocked(requestApi).mockResolvedValueOnce(a).mockResolvedValue(b);
  render(
    <AuthProvider>
      <Reader />
    </AuthProvider>,
  );
  await waitFor(() =>
    expect(screen.getByTestId("identity")).toHaveTextContent("demo-a"),
  );
  fireEvent(
    window,
    new StorageEvent("storage", {
      key: "studio:identity-changed",
      newValue: "changed",
    }),
  );
  await waitFor(() =>
    expect(screen.getByTestId("identity")).toHaveTextContent("demo-b"),
  );
});

it("keeps a confirmed identity and its scope during a temporary me network failure", async () => {
  vi.mocked(requestApi)
    .mockResolvedValueOnce(a)
    .mockRejectedValueOnce(new TypeError("offline"));
  function Probe() {
    const auth = useAuth();
    return (
      <div>
        <output data-testid="current-user">
          {auth.user?.userId ?? "none"}
        </output>
        <button onClick={() => void auth.recheck()}>重新确认身份</button>
      </div>
    );
  }
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() =>
    expect(screen.getByTestId("current-user")).toHaveTextContent("demo-a"),
  );
  fireEvent.click(screen.getByText("重新确认身份"));
  await waitFor(() => expect(requestApi).toHaveBeenCalledTimes(2));
  expect(screen.getByTestId("current-user")).toHaveTextContent("demo-a");
});
