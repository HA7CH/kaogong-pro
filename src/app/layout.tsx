import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "kaogong.pro — 用 Claude Code 规划你的考公选岗",
  description: "免费、开源的国考岗位选择工具。搜索 120000+ 岗位（国考 2020-2026 七年 + 北京市考），冲/稳/保智能推荐。零依赖 CLI，零 token 设计。",
  metadataBase: new URL("https://kaogong.ha7ch.com"),
  openGraph: {
    title: "kaogong.pro",
    description: "用 Claude Code 规划你的考公选岗",
    url: "https://kaogong.ha7ch.com",
  },
  keywords: [
    "考公", "国考", "公务员考试", "岗位选择", "考公 Pro",
    "kaogong-pro", "CLI", "Claude Code", "零token",
    "冲稳保", "国考职位表", "npx @ha7ch/kaogong-pro",
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Noto+Serif+SC:wght@400;700&family=Geist+Mono&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
