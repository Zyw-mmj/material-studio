import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { CreationForm } from "./creation-form";
import { mutateApi, type Template } from "@/lib/api";
import type { TaskTracker } from "@/lib/task-tracker";
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  mutateApi: vi.fn(),
}));
const template: Template = {
  id: "demo-avatar",
  title: "头像相框",
  category: "创意图片",
  coverUrl: "/api/templates/demo-avatar/cover",
  description: "测试",
  requiredImageCount: 1,
  acceptedMimeTypes: ["image/png", "image/jpeg"],
  maxFileSizeBytes: 5242880,
};
const asset = (id: string) => ({
  assetId: id,
  previewUrl: `/api/assets/${id}/content`,
  mimeType: "image/png",
  sizeBytes: 40,
  width: 8,
  height: 8,
});
const accepted = {
  taskId: "task-test",
  status: "QUEUED",
  createdAt: "2026-10-28T14:00:00Z",
  replayed: false,
};
const mutate = vi.mocked(mutateApi);
beforeEach(() => {
  let count = 0;
  const OriginalURL = URL;
  vi.stubGlobal(
    "URL",
    class extends OriginalURL {
      static createObjectURL = vi.fn(() => `blob:preview-${++count}`);
      static revokeObjectURL = vi.fn();
    },
  );
});
function mount() {
  const add = vi.fn();
  const view = render(
    <CreationForm
      template={template}
      tracker={{ add } as unknown as TaskTracker}
    />,
  );
  const input = view.container.querySelector('input[type="file"]')!;
  return { add, input };
}
function choose(input: Element, name = "image.png") {
  fireEvent.change(input, {
    target: { files: [new File(["image"], name, { type: "image/png" })] },
  });
}
it("preserves the exact idempotency key and payload after an uncertain submission", async () => {
  let submissions = 0;
  mutate.mockImplementation(async (path) => {
    if (path === "/assets") return asset("asset-ready") as never;
    if (submissions++ === 0) throw new TypeError("offline");
    return accepted as never;
  });
  const { input, add } = mount();
  choose(input);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /开始制作/ })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: /开始制作/ }));
  await screen.findByRole("button", { name: /确认提交结果/ });
  fireEvent.click(screen.getByRole("button", { name: /确认提交结果/ }));
  await waitFor(() => expect(add).toHaveBeenCalledTimes(1));
  const posts = mutate.mock.calls.filter((call) => call[0] === "/tasks");
  expect(posts).toHaveLength(2);
  expect(posts[0][1]).toEqual(posts[1][1]);
  expect(posts[0][3]).toEqual(posts[1][3]);
  expect(screen.getByRole("button", { name: /开始制作/ })).toBeDisabled();
  expect(screen.getByRole("status")).toHaveFocus();
});
it("ignores an old upload response after replacing the selected image", async () => {
  let finish!: (value: unknown) => void;
  let uploads = 0;
  mutate.mockImplementation(async (path) => {
    if (path === "/tasks") return accepted as never;
    if (uploads++ === 0)
      return new Promise((resolve) => {
        finish = resolve;
      }) as never;
    return asset("new-asset") as never;
  });
  const { input, add } = mount();
  choose(input, "first.png");
  choose(input, "second.png");
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /开始制作/ })).toBeEnabled(),
  );
  finish(asset("old-asset"));
  await Promise.resolve();
  fireEvent.click(screen.getByRole("button", { name: /开始制作/ }));
  await waitFor(() => expect(add).toHaveBeenCalled());
  expect(mutate.mock.calls.find((call) => call[0] === "/tasks")?.[1]).toEqual({
    templateId: "demo-avatar",
    assetIds: ["new-asset"],
  });
});

it("returns keyboard focus to the upload input after removing a ready image", async () => {
  mutate.mockResolvedValue(asset("ready") as never);
  const { input } = mount();
  choose(input);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /开始制作/ })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "移除素材 1" }));
  expect(input).toHaveFocus();
  expect(screen.getByRole("button", { name: /开始制作/ })).toBeDisabled();
});
