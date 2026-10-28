"use client";
import Link from "next/link";
import { useAuth, LoginPanel } from "./auth-provider";
import { useTaskTracker } from "@/lib/use-task-tracker";
import { TaskHistory } from "./task-history";
function PersonalHistory() {
  const model = useTaskTracker();
  return <TaskHistory model={model} title="我的全部制作记录" />;
}
export function HistoryPage() {
  const auth = useAuth();
  return (
    <div className="page-shell personal-history">
      <div className="archive-intro">
        <div>
          <span className="eyebrow">YOUR PERSONAL ARCHIVE</span>
          <h1>每一次灵感，都值得留下。</h1>
          <p>查看制作进度、失败原因与已经完成的画面。</p>
        </div>
        <Link className="outline-button" href="/templates">
          探索更多模板 ↗
        </Link>
      </div>
      {auth.user ? (
        <PersonalHistory key={`${auth.user.userId}:${auth.epoch}`} />
      ) : (
        <LoginPanel />
      )}
    </div>
  );
}
