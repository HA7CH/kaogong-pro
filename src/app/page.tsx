"use client";

import { useState } from "react";

const PROMPT = `跑 \`npx @ha7ch/kaogong-pro@latest help\` 摸清所有命令，然后帮我选 2026 年国考岗位。

先问我：学历、专业、政治面貌、意向省份/城市、是否有基层经验、模考成绩（行测+申论总分）。
用 CLI 拉真实数据——查历年分数线、岗位限制条件，然后给我冲/稳/保三档推荐。
每条推荐都要有数据支撑，不要编造。`;

type Status = "live" | "building" | "none";
type ExamRow = { name: string; positions: Status; cutoffs: Status; ratios: Status };

const EXAMS: ExamRow[] = [
  { name: "国考 2026", positions: "live", cutoffs: "building", ratios: "building" },
  { name: "国考 2025", positions: "building", cutoffs: "building", ratios: "none" },
  { name: "国考 2024", positions: "building", cutoffs: "building", ratios: "none" },
];

function StatusIcon({ status }: { status: Status }) {
  if (status === "live")
    return <span style={{ color: "var(--success)" }}>&#10003;</span>;
  if (status === "building")
    return <span style={{ color: "var(--warning)" }}>&#9680;</span>;
  return <span style={{ color: "var(--muted-foreground)" }}>&mdash;</span>;
}

export default function Home() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="page">
      {/* Hero */}
      <h1 className="brand">考公 Pro</h1>
      <p className="lede">$ npx @ha7ch/kaogong-pro help</p>

      {/* Prompt Card */}
      <div className="prompt-card">
        <div className="prompt-header">
          <span>复制到 Claude Code / Codex / Cursor</span>
          <button className="copy-btn" onClick={handleCopy}>
            {copied ? "✓ 已复制" : "⧉ 复制"}
          </button>
        </div>
        <div className="prompt-body">{PROMPT}</div>
      </div>

      {/* Data Coverage */}
      <p className="section-label">Data Coverage</p>
      <table className="status-table">
        <thead>
          <tr>
            <th>考试</th>
            <th>职位表</th>
            <th>分数线</th>
            <th>竞争比</th>
          </tr>
        </thead>
        <tbody>
          {EXAMS.map((e) => (
            <tr key={e.name}>
              <td>{e.name}</td>
              <td><StatusIcon status={e.positions} /></td>
              <td><StatusIcon status={e.cutoffs} /></td>
              <td><StatusIcon status={e.ratios} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Install */}
      <p className="section-label">Install</p>
      <pre className="code-block">npx @ha7ch/kaogong-pro@latest help</pre>

      {/* Footer */}
      <footer className="footer">
        <a href="https://github.com/HA7CH/kaogong-pro">GitHub</a>
        <span style={{ margin: "0 0.5rem" }}>&middot;</span>
        <a href="https://www.npmjs.com/package/@ha7ch/kaogong-pro">npm</a>
        <span style={{ margin: "0 0.5rem" }}>&middot;</span>
        <a href="https://ha7ch.com">ha7ch.com</a>
      </footer>
    </main>
  );
}
