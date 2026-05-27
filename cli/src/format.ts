// cli/src/format.ts
import type { Position } from "./codes.js";

export function isTty(): boolean {
  return !!process.stdout.isTTY;
}

function charWidth(ch: string): number {
  const code = ch.codePointAt(0) ?? 0;
  if (code >= 0x4e00 && code <= 0x9fff) return 2;
  if (code >= 0x3000 && code <= 0x303f) return 2;
  if (code >= 0xff00 && code <= 0xffef) return 2;
  return 1;
}

function strWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += charWidth(ch);
  return w;
}

function pad(s: string, width: number): string {
  const diff = width - strWidth(s);
  return diff > 0 ? s + " ".repeat(diff) : s;
}

export function renderTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(strWidth(h), ...rows.map((r) => strWidth(r[i] ?? ""))),
  );
  const sep = widths.map((w) => "─".repeat(w)).join("──");
  const head = headers.map((h, i) => pad(h, widths[i])).join("  ");
  const body = rows
    .map((r) => r.map((c, i) => pad(c, widths[i])).join("  "))
    .join("\n");
  return `${head}\n${sep}\n${body}`;
}

export function formatPositions(positions: Position[]): string {
  const headers = ["部门", "岗位", "学历", "专业", "人数", "地点", "备注"];
  const rows = positions.map((p) => [
    p.dept_name.slice(0, 12),
    p.position_name.slice(0, 16),
    p.education.slice(0, 8),
    p.major.length > 16 ? p.major.slice(0, 14) + "…" : p.major,
    String(p.headcount),
    p.work_location.slice(0, 10),
    p.remarks.length > 12 ? p.remarks.slice(0, 10) + "…" : p.remarks,
  ]);
  return renderTable(headers, rows);
}

type BucketItem = Position & { delta: number };

export function formatRecommend(
  query: { score: number; evaluated: number; skipped: number },
  buckets: { "冲": BucketItem[]; "稳": BucketItem[]; "保": BucketItem[] },
): string {
  const lines: string[] = [];
  lines.push(`模考成绩 ${query.score}  评估 ${query.evaluated} 个岗位  跳过 ${query.skipped}`);
  lines.push("");
  for (const bucket of ["冲", "稳", "保"] as const) {
    const items = buckets[bucket];
    lines.push(`── ${bucket} (${items.length}) ──`);
    if (items.length === 0) {
      lines.push("  (无)");
    } else {
      const headers = ["部门", "岗位", "差值", "人数", "地点"];
      const rows = items.slice(0, 20).map((p) => [
        p.dept_name.slice(0, 12),
        p.position_name.slice(0, 14),
        (p.delta >= 0 ? "+" : "") + p.delta.toFixed(0),
        String(p.headcount),
        p.work_location.slice(0, 10),
      ]);
      lines.push(renderTable(headers, rows));
    }
    lines.push("");
  }
  return lines.join("\n");
}
