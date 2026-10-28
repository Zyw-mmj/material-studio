"use client";

import { useEffect, useState } from "react";
import { requestApi } from "@/lib/api";

type Snapshot<T> = { key: string; data: T | null; error: Error | null };

/** Page-scoped request: cancellation and a key guard prevent late responses crossing routes. */
export function useApiResource<T>(path: string) {
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([path, attempt]);
  const [snapshot, setSnapshot] = useState<Snapshot<T> | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    requestApi<T>(path, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setSnapshot({ key, data, error: null });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setSnapshot({
            key,
            data: null,
            error: error instanceof Error ? error : new Error("请求失败"),
          });
        }
      },
    );
    return () => controller.abort();
  }, [path, key]);

  return {
    data: snapshot?.key === key ? snapshot.data : null,
    error: snapshot?.key === key ? snapshot.error : null,
    isLoading: snapshot?.key !== key,
    retry: () => setAttempt((value) => value + 1),
  };
}
