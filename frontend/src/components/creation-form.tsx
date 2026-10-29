"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import {
  ApiRequestError,
  mutateApi,
  type Asset,
  type CreatedTask,
  type CreateTask,
  type Template,
} from "@/lib/api";
import type { TaskTracker } from "@/lib/task-tracker";

type Slot = {
  phase: "empty" | "uploading" | "ready" | "error";
  preview?: string;
  asset?: Asset;
  error?: string;
};
type Frozen = { key: string; body: CreateTask };
export function CreationForm({
  template,
  tracker,
}: {
  template: Template;
  tracker: TaskTracker;
}) {
  const [slots, setSlots] = useState<Slot[]>(() =>
    Array.from({ length: template.requiredImageCount }, () => ({
      phase: "empty",
    })),
  );
  const [submission, setSubmission] = useState<
    "idle" | "posting" | "uncertain"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (message || error) feedback.current?.focus();
  }, [message, error]);
  const versions = useRef(new Map<number, number>());
  const controllers = useRef(new Map<number, AbortController>());
  const previews = useRef(new Map<number, string>());
  const submitController = useRef<AbortController | null>(null);
  const frozen = useRef<Frozen | null>(null);
  const alive = useRef(true);
  const base = useId();
  useEffect(() => {
    alive.current = true;
    const activeControllers = controllers.current;
    const objectUrls = previews.current;
    return () => {
      alive.current = false;
      activeControllers.forEach((c) => c.abort());
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      submitController.current?.abort();
    };
  }, []);
  const reset = (index: number) => {
    versions.current.set(index, (versions.current.get(index) ?? 0) + 1);
    controllers.current.get(index)?.abort();
    const old = previews.current.get(index);
    if (old) URL.revokeObjectURL(old);
    previews.current.delete(index);
    setSlots((old) =>
      old.map((slot, i) => (i === index ? { phase: "empty" } : slot)),
    );
  };
  const upload = async (index: number, file: File) => {
    reset(index);
    setError(null);
    setMessage(null);
    const version = versions.current.get(index)!;
    const fail = (text: string) =>
      setSlots((old) =>
        old.map((slot, i) =>
          i === index ? { phase: "error", error: text } : slot,
        ),
      );
    if (
      !template.acceptedMimeTypes.includes(
        file.type as "image/png" | "image/jpeg",
      )
    ) {
      fail("请选择 JPEG 或 PNG 图片");
      return;
    }
    if (file.size < 1 || file.size > template.maxFileSizeBytes) {
      fail("图片必须非空，且单张不超过 5 MiB");
      return;
    }
    const preview = URL.createObjectURL(file);
    previews.current.set(index, preview);
    const controller = new AbortController();
    controllers.current.set(index, controller);
    setSlots((old) =>
      old.map((slot, i) =>
        i === index ? { phase: "uploading", preview } : slot,
      ),
    );
    try {
      const body = new FormData();
      body.set("file", file);
      const asset = await mutateApi<Asset>("/assets", body, controller.signal);
      if (
        alive.current &&
        !controller.signal.aborted &&
        versions.current.get(index) === version
      )
        setSlots((old) =>
          old.map((slot, i) =>
            i === index ? { phase: "ready", preview, asset } : slot,
          ),
        );
    } catch (cause) {
      if (
        alive.current &&
        !controller.signal.aborted &&
        versions.current.get(index) === version
      )
        setSlots((old) =>
          old.map((slot, i) =>
            i === index
              ? {
                  phase: "error",
                  preview,
                  error:
                    cause instanceof Error ? cause.message : "上传失败，请重试",
                }
              : slot,
          ),
        );
    } finally {
      if (controllers.current.get(index) === controller)
        controllers.current.delete(index);
    }
  };
  const submit = async () => {
    if (submission === "posting") return;
    setError(null);
    setMessage(null);
    if (!frozen.current) {
      if (!slots.every((s) => s.phase === "ready" && s.asset)) return;
      frozen.current = {
        key: crypto.randomUUID(),
        body: {
          templateId: template.id,
          assetIds: slots.map((s) => s.asset!.assetId),
        },
      };
    }
    const request = frozen.current;
    const controller = new AbortController();
    submitController.current = controller;
    setSubmission("posting");
    try {
      const created = await mutateApi<CreatedTask>(
        "/tasks",
        request.body,
        controller.signal,
        { "Idempotency-Key": request.key },
      );
      if (!alive.current || controller.signal.aborted) return;
      tracker.add(created, template);
      frozen.current = null;
      slots.forEach((_, index) => reset(index));
      setSubmission("idle");
      setMessage("任务已受理。可以继续上传素材，制作下一份灵感。");
    } catch (cause) {
      if (!alive.current || controller.signal.aborted) return;
      const uncertain =
        !(cause instanceof ApiRequestError) ||
        cause.status >= 500 ||
        cause.code === "CSRF_INVALID";
      setSubmission(uncertain ? "uncertain" : "idle");
      if (!uncertain) frozen.current = null;
      setError(
        uncertain
          ? "提交结果待确认。请点击下方按钮，用同一提交标识确认，避免重复创建。"
          : cause instanceof Error
            ? cause.message
            : "提交失败",
      );
    }
  };
  const ready = slots.every((slot) => slot.phase === "ready" && slot.asset);
  const frozenInputs = submission !== "idle";
  return (
    <section className="creation-form" aria-label="上传素材并创建任务">
      <div className="upload-heading">
        <h2>上传你的素材</h2>
        <span>
          {slots.filter((s) => s.phase === "ready").length} /{" "}
          {template.requiredImageCount}
        </span>
      </div>
      <p className="small-muted">JPEG / PNG · 单张最大 5 MiB</p>
      <div className={`upload-slots slots-${template.requiredImageCount}`}>
        {slots.map((slot, index) => (
          <div className={`upload-slot upload-${slot.phase}`} key={index}>
            <input
              className="visually-hidden"
              id={`${base}-${index}`}
              type="file"
              aria-label={`选择图片 ${index + 1}`}
              accept={template.acceptedMimeTypes.join(",")}
              disabled={frozenInputs}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) void upload(index, file);
              }}
              aria-describedby={`${base}-status-${index}`}
            />
            <label className="upload-target" htmlFor={`${base}-${index}`}>
              {slot.preview ? (
                <Image
                  src={slot.preview}
                  alt={`素材 ${index + 1} 的本地预览`}
                  width={300}
                  height={300}
                  unoptimized
                />
              ) : (
                <span className="upload-add" aria-hidden="true">
                  +
                </span>
              )}
              <span className="upload-target-caption">
                {slot.phase === "uploading"
                  ? "正在上传…"
                  : slot.phase === "ready"
                    ? "素材已就绪"
                    : `选择图片 ${index + 1}`}
              </span>
            </label>
            <div className="upload-actions">
              <label htmlFor={`${base}-${index}`}>
                {slot.preview ? "替换图片" : "本地图片"}
              </label>
              {slot.phase !== "empty" && (
                <button
                  className="text-button"
                  disabled={frozenInputs}
                  onClick={() => {
                    reset(index);
                    document.getElementById(`${base}-${index}`)?.focus();
                  }}
                  aria-label={`移除素材 ${index + 1}`}
                >
                  移除
                </button>
              )}
            </div>
            <div id={`${base}-status-${index}`}>
              {slot.error && (
                <p className="form-error" role="alert">
                  {slot.error}
                </p>
              )}
              {slot.asset && (
                <p className="upload-meta">
                  {slot.asset.width} × {slot.asset.height} ·{" "}
                  {Math.ceil(slot.asset.sizeBytes / 1024)} KB
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      <button
        className="create-button"
        disabled={
          submission === "posting" || (submission !== "uncertain" && !ready)
        }
        onClick={() => void submit()}
      >
        {submission === "posting"
          ? "正在提交…"
          : submission === "uncertain"
            ? "确认提交结果"
            : "开始制作"}
        <span aria-hidden="true">↗</span>
      </button>
      {error && (
        <p className="form-error" role="alert" ref={feedback} tabIndex={-1}>
          {error}
        </p>
      )}
      {message && (
        <p className="form-success" role="status" ref={feedback} tabIndex={-1}>
          {message}
        </p>
      )}
      <p className="small-muted creation-note">
        提交后可离开页面，稍后在记录中查看结果。
      </p>
    </section>
  );
}
