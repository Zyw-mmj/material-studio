import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth-provider";
import { StudioHeader } from "@/components/studio-header";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "FRAME · 素材制作平台", template: "%s · FRAME" },
  description:
    "从一个模板开始，让灵感有一个好看的开始。上传图片，后台制作，随时查看个人进度与结果。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <a className="skip-link" href="#main-content">
          跳到主要内容
        </a>
        <AuthProvider>
          <StudioHeader />
          {children}
          <footer className="site-footer" id="project-status">
            <div>
              <span className="footer-wordmark">FRAME</span>
              <span>给每一次灵感，一个新的画面。</span>
            </div>
            <p>
              <span className="status-dot" /> 模拟图片制作{" "}
              <span className="footer-separator">/</span> JPEG / PNG ·
              真实素材，模拟生成
            </p>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
