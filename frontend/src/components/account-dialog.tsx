"use client";
import Link from "next/link";
import { IdentityChoices, useAuth } from "./auth-provider";
import { StudioDialog } from "./studio-dialog";
import { StudioIcon } from "./studio-icon";

export function AccountDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const auth = useAuth();
  return (
    <StudioDialog
      open={open}
      onClose={onClose}
      title="账户与个人记录"
      description="管理当前演示身份，查看属于自己的制作记录。"
    >
      <section className="account-profile" aria-label="当前账户">
        <span className="account-avatar">
          <StudioIcon name="user" size={30} />
        </span>
        <div>
          <span className="overline">当前身份</span>
          <h3>
            {auth.busy
              ? "正在切换身份…"
              : (auth.user?.displayName ?? "尚未选择身份")}
          </h3>
          <p>
            {auth.user
              ? `身份 ID · ${auth.user.userId}`
              : "选择下方身份，开始制作"}
          </p>
        </div>
        <span className="mode-badge">演示</span>
      </section>
      {auth.user && (
        <Link className="account-record-link" href="/history" onClick={onClose}>
          <StudioIcon name="history" />
          <span>
            <strong>我的制作记录</strong>
            <small>查看处理进度、成功结果与失败原因</small>
          </span>
          <StudioIcon name="arrow" />
        </Link>
      )}
      <section
        className="account-switch"
        aria-labelledby="identity-choice-heading"
      >
        <h3 id="identity-choice-heading">选择演示身份</h3>
        <p>两个身份分别保存素材与制作记录，切换后显示对应记录。</p>
        <IdentityChoices />
      </section>
      {auth.error && (
        <p role="alert" className="form-error">
          {auth.error}{" "}
          <button
            type="button"
            className="text-button"
            onClick={() => void auth.recheck()}
          >
            重新确认身份
          </button>
        </p>
      )}
      {auth.busy && (
        <p className="small-muted" role="status">
          正在确认身份，请稍候…
        </p>
      )}
      <div className="account-bottom">
        <p>演示身份可自由切换，请使用示例素材。退出后制作记录仍会保留。</p>
        {auth.user && (
          <button
            type="button"
            className="danger-button"
            disabled={auth.busy}
            onClick={() => {
              void auth.logout();
              onClose();
            }}
          >
            退出当前身份
          </button>
        )}
      </div>
    </StudioDialog>
  );
}
