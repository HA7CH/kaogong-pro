"use client";

import { useState } from "react";

const PROMPT = `跑 \`npx @ha7ch/kaogong-pro@latest help\` 把命令摸清楚，然后帮我选 2026 年国考岗位。

先问我：学历、专业、政治面貌、意向省份/城市、是否有基层经验、模考成绩（行测+申论总分）。
每条推荐都用 CLI 拉真实数据支撑——查历年竞争比、进面分数线、岗位限制条件。`;

type Status = "live" | "building" | "none";
type ExamRow = { name: string; positions: Status; cutoffs: Status; ratios: Status };

const EXAMS: ExamRow[] = [
  { name: "国考 2026", positions: "live", cutoffs: "building", ratios: "building" },
  { name: "国考 2025", positions: "building", cutoffs: "building", ratios: "none" },
  { name: "国考 2024", positions: "building", cutoffs: "building", ratios: "none" },
];

function Badge({ status }: { status: Status }) {
  if (status === "live") return <span className="text-green-700 text-xs font-mono">live</span>;
  if (status === "building") return <span className="text-amber-600 text-xs font-mono">building</span>;
  return <span className="text-stone-400 text-xs font-mono">&mdash;</span>;
}

export default function Home() {
  const [copied, setCopied] = useState(false);

  return (
    <main className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight mb-2">考公 Pro</h1>
      <p className="text-[var(--muted)] mb-8">
        用 Claude Code 规划你的考公选岗。免费、开源、零 token。
      </p>

      <section className="mb-12">
        <h2 className="text-sm font-mono text-[var(--muted)] uppercase tracking-widest mb-3">Quick Start</h2>
        <div className="bg-stone-100 border border-[var(--border)] rounded-lg p-4 font-mono text-sm whitespace-pre-wrap relative">
          {PROMPT}
          <button
            onClick={() => { navigator.clipboard.writeText(PROMPT); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="absolute top-3 right-3 text-xs px-2 py-1 bg-white border border-[var(--border)] rounded hover:bg-stone-50 transition-colors"
          >
            {copied ? "已复制" : "复制"}
          </button>
        </div>
        <p className="text-xs text-[var(--muted)] mt-2">粘贴到 Claude Code / Codex / Cursor，然后跟着 AI 走。</p>
      </section>

      <section className="mb-12">
        <h2 className="text-sm font-mono text-[var(--muted)] uppercase tracking-widest mb-3">Data Coverage</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left">
              <th className="py-2 font-normal text-[var(--muted)]">考试</th>
              <th className="py-2 font-normal text-[var(--muted)]">职位表</th>
              <th className="py-2 font-normal text-[var(--muted)]">分数线</th>
              <th className="py-2 font-normal text-[var(--muted)]">竞争比</th>
            </tr>
          </thead>
          <tbody>
            {EXAMS.map((e) => (
              <tr key={e.name} className="border-b border-[var(--border)]">
                <td className="py-2">{e.name}</td>
                <td className="py-2"><Badge status={e.positions} /></td>
                <td className="py-2"><Badge status={e.cutoffs} /></td>
                <td className="py-2"><Badge status={e.ratios} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-12">
        <h2 className="text-sm font-mono text-[var(--muted)] uppercase tracking-widest mb-3">Install</h2>
        <pre className="bg-stone-100 border border-[var(--border)] rounded-lg p-4 font-mono text-sm">
          npx @ha7ch/kaogong-pro@latest help
        </pre>
      </section>

      <section>
        <h2 className="text-sm font-mono text-[var(--muted)] uppercase tracking-widest mb-3">MCP</h2>
        <pre className="bg-stone-100 border border-[var(--border)] rounded-lg p-4 font-mono text-sm">
          claude mcp add kaogong-pro -- npx -y @ha7ch/kaogong-pro mcp
        </pre>
      </section>

      <footer className="mt-16 text-xs text-[var(--muted)] border-t border-[var(--border)] pt-6">
        <a href="https://github.com/HA7CH/kaogong-pro" className="hover:text-[var(--fg)] transition-colors">GitHub</a>
        <span className="mx-2">&middot;</span>
        <a href="https://ha7ch.com" className="hover:text-[var(--fg)] transition-colors">ha7ch.com</a>
      </footer>
    </main>
  );
}
