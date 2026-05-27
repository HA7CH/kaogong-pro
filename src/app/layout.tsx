import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "考公 Pro — 用 Claude Code 规划你的考公选岗",
  description: "免费、开源的国考/省考岗位选择工具。CLI + MCP，零 token 设计。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className="antialiased">{children}</body>
    </html>
  );
}
