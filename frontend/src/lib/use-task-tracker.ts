"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { taskTransport, type TaskFilter } from "./api";
import { TaskTracker } from "./task-tracker";
import { useAuth } from "@/components/auth-provider";
export function useTaskTracker(
  templateId?: string,
  status: TaskFilter["status"] = "ALL",
) {
  const { user, epoch, recheck } = useAuth();
  const tracker = useMemo(
    () =>
      new TaskTracker(
        taskTransport,
        templateId,
        `${user?.userId}:${epoch}`,
        status,
      ),
    [templateId, status, epoch, user?.userId],
  );
  const snapshot = useSyncExternalStore(
    tracker.subscribe,
    tracker.getSnapshot,
    tracker.getSnapshot,
  );
  const userId = user?.userId;
  useEffect(() => {
    tracker.start();
    const visible = async () => {
      if (document.visibilityState === "hidden") tracker.suspend();
      else {
        const identity = await recheck();
        if (identity?.userId === userId) tracker.resume();
      }
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      tracker.stop();
      document.removeEventListener("visibilitychange", visible);
    };
  }, [tracker, recheck, userId]);
  return { tracker, ...snapshot };
}
