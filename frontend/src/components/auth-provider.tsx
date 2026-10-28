"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { ApiRequestError, mutateApi, requestApi, type User } from "@/lib/api";

type State = {
  user: User | null;
  ready: boolean;
  busy: boolean;
  epoch: number;
  error: string | null;
};
type Auth = State & {
  login: (id: "demo-a" | "demo-b") => Promise<void>;
  logout: () => Promise<void>;
  recheck: () => Promise<User | null>;
};
const Context = createContext<Auth | null>(null);
const changeKey = "studio:identity-changed";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({
    user: null,
    ready: false,
    busy: false,
    epoch: 0,
    error: null,
  });
  const sequence = useRef(0);
  const busy = useRef(false);
  const lastKnown = useRef<User | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  const invalidateSequence = useCallback(() => {
    ++sequence.current;
  }, []);
  const publish = useCallback(() => {
    channel.current?.postMessage({ kind: "identity-changed" });
    try {
      localStorage.setItem(changeKey, crypto.randomUUID());
    } catch {
      /* storage can be unavailable */
    }
  }, []);
  const recheck = useCallback(async () => {
    if (busy.current) return null;
    const current = ++sequence.current;
    try {
      const user = await requestApi<User>("/auth/me");
      if (current !== sequence.current) return null;
      lastKnown.current = user;
      setState((previous) => ({
        ...previous,
        user,
        ready: true,
        busy: false,
        error: null,
        epoch:
          previous.user?.userId === user.userId
            ? previous.epoch
            : previous.epoch + 1,
      }));
      return user;
    } catch (error) {
      if (current !== sequence.current) return null;
      if (error instanceof ApiRequestError && error.status === 401) {
        lastKnown.current = null;
        setState((previous) => ({
          ...previous,
          user: null,
          ready: true,
          busy: false,
          epoch: previous.epoch + 1,
          error: null,
        }));
        return null;
      }
      setState((previous) => ({
        ...previous,
        ready: true,
        busy: false,
        error: "身份暂时无法更新，将保留最近一次确认的信息",
      }));
      return lastKnown.current;
    }
  }, []);
  useEffect(() => {
    void recheck();
    const invalidate = () => {
      busy.current = false;
      lastKnown.current = null;
      ++sequence.current;
      setState((previous) => ({
        ...previous,
        user: null,
        ready: false,
        busy: false,
        epoch: previous.epoch + 1,
        error: null,
      }));
      void recheck();
    };
    const unauthorized = () => {
      busy.current = false;
      lastKnown.current = null;
      ++sequence.current;
      setState((previous) => ({
        ...previous,
        user: null,
        ready: true,
        busy: false,
        epoch: previous.epoch + 1,
        error: "会话已失效，请重新选择演示身份",
      }));
    };
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel("material-studio");
      channel.current.onmessage = invalidate;
    }
    const storage = (event: StorageEvent) => {
      if (event.key === changeKey) invalidate();
    };
    const visible = () => {
      if (document.visibilityState === "visible") void recheck();
    };
    window.addEventListener("storage", storage);
    window.addEventListener("studio:unauthorized", unauthorized);
    document.addEventListener("visibilitychange", visible);
    return () => {
      invalidateSequence();
      channel.current?.close();
      channel.current = null;
      window.removeEventListener("storage", storage);
      window.removeEventListener("studio:unauthorized", unauthorized);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [recheck, invalidateSequence]);
  const login = useCallback(
    async (id: "demo-a" | "demo-b") => {
      busy.current = true;
      lastKnown.current = null;
      const current = ++sequence.current;
      setState((previous) => ({
        ...previous,
        user: null,
        busy: true,
        ready: true,
        error: null,
        epoch: previous.epoch + 1,
      }));
      try {
        await mutateApi<User>("/auth/login", { demoUserId: id });
        const user = await requestApi<User>("/auth/me");
        if (current === sequence.current) {
          lastKnown.current = user;
          setState((previous) => ({
            ...previous,
            user,
            busy: false,
            ready: true,
            error: null,
          }));
          publish();
        }
      } catch (error) {
        if (current === sequence.current)
          setState((previous) => ({
            ...previous,
            user: null,
            busy: false,
            error: error instanceof Error ? error.message : "身份切换失败",
          }));
      } finally {
        if (current === sequence.current) busy.current = false;
      }
    },
    [publish],
  );
  const logout = useCallback(async () => {
    busy.current = true;
    lastKnown.current = null;
    const current = ++sequence.current;
    setState((previous) => ({
      ...previous,
      user: null,
      busy: true,
      epoch: previous.epoch + 1,
      error: null,
    }));
    try {
      await mutateApi<void>("/auth/logout", undefined);
      if (current === sequence.current) {
        setState((previous) => ({ ...previous, busy: false, ready: true }));
        publish();
      }
    } catch (error) {
      if (current === sequence.current) {
        busy.current = false;
        setState((previous) => ({
          ...previous,
          busy: false,
          error: error instanceof Error ? error.message : "退出失败",
        }));
        await recheck();
      }
    } finally {
      if (current === sequence.current) busy.current = false;
    }
  }, [publish, recheck]);
  return (
    <Context.Provider value={{ ...state, login, logout, recheck }}>
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("AuthProvider is required");
  return value;
}
export function IdentityChoices({ onChoose }: { onChoose?: () => void } = {}) {
  const auth = useAuth();
  return (
    <div className="identity-choices">
      {(["demo-a", "demo-b"] as const).map((id, index) => (
        <button
          key={id}
          aria-label={`选择演示用户 ${index === 0 ? "A" : "B"}`}
          disabled={auth.busy}
          onClick={() => {
            onChoose?.();
            void auth.login(id);
          }}
          className="identity-choice"
        >
          <span className="avatar-badge">{index === 0 ? "A" : "B"}</span>
          <span>
            演示用户 {index === 0 ? "A" : "B"}
            <small>
              {auth.user?.userId === id ? "当前身份" : "选择此身份"}
            </small>
          </span>
        </button>
      ))}
    </div>
  );
}
export function LoginPanel() {
  const auth = useAuth();
  return (
    <div className="login-panel">
      <span className="eyebrow">YOUR PERSONAL STUDIO</span>
      <h2>{auth.ready ? "选择身份，开始制作。" : "正在确认身份…"}</h2>
      <p>
        选择一个演示用户，上传素材并查看属于自己的制作记录。演示身份用于验证数据隔离，不用于真实私密数据。
      </p>
      {auth.ready && <IdentityChoices />}
      {auth.busy && <p role="status">正在切换身份…</p>}
      {auth.error && (
        <p className="form-error" role="alert">
          {auth.error}{" "}
          <button className="text-button" onClick={() => void auth.recheck()}>
            重新确认
          </button>
        </p>
      )}
    </div>
  );
}
