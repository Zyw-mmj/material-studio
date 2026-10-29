import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { AuthProvider } from "./auth-provider";
import { StudioHeader } from "./studio-header";
import { mockDialog } from "@/test/dialog";
import { mutateApi, requestApi, type User } from "@/lib/api";
vi.mock("next/navigation", () => ({ usePathname: () => "/history" }));
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  requestApi: vi.fn(),
  mutateApi: vi.fn(),
}));
const a: User = { userId: "demo-a", displayName: "演示用户 A", mode: "DEMO" };
const b: User = { userId: "demo-b", displayName: "演示用户 B", mode: "DEMO" };
beforeEach(() => {
  mockDialog();
  vi.stubGlobal("BroadcastChannel", undefined);
});
it("exposes an accessible account dialog, real identity and personal-history link", async () => {
  vi.mocked(requestApi).mockResolvedValue(a);
  render(
    <AuthProvider>
      <StudioHeader />
    </AuthProvider>,
  );
  await screen.findByText("演示用户 A");
  const trigger = screen.getByRole("button", { name: "打开账户与个人记录" });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog", { name: "账户与个人记录" });
  expect(within(dialog).getByText("身份 ID · demo-a")).toBeInTheDocument();
  expect(
    within(dialog).getByRole("link", { name: /我的制作记录/ }),
  ).toHaveAttribute("href", "/history");
  expect(screen.getByRole("link", { name: "我的制作" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  fireEvent.click(
    within(dialog).getByRole("button", { name: "关闭账户与个人记录" }),
  );
  expect(trigger).toHaveFocus();
});
it("switches the server-backed identity through the account dialog", async () => {
  vi.mocked(requestApi).mockResolvedValueOnce(a).mockResolvedValue(b);
  vi.mocked(mutateApi).mockResolvedValue(b);
  render(
    <AuthProvider>
      <StudioHeader />
    </AuthProvider>,
  );
  await screen.findByText("演示用户 A");
  fireEvent.click(screen.getByRole("button", { name: "打开账户与个人记录" }));
  const choice = screen.getByRole("button", { name: "选择演示用户 B" });
  choice.focus();
  fireEvent.click(choice);
  await waitFor(() =>
    expect(screen.getByText("身份 ID · demo-b")).toBeInTheDocument(),
  );
  expect(mutateApi).toHaveBeenCalledWith("/auth/login", {
    demoUserId: "demo-b",
  });
  expect(
    screen.getByRole("button", { name: "选择演示用户 B" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(screen.queryByText("身份 ID · demo-a")).not.toBeInTheDocument();
  expect(choice).toHaveFocus();
  fireEvent.click(choice);
  expect(mutateApi).toHaveBeenCalledTimes(1);
});
