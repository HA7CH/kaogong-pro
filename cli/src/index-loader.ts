// cli/src/index-loader.ts
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import type { PositionIndex, Position, ExamType } from "./codes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const CANDIDATE_PATHS = [
  join(__dirname, "..", "data", "positions-index.json.gz"),
  join(__dirname, "..", "..", "data", "positions-index.json.gz"),
  join(__dirname, "..", "..", "cli", "data", "positions-index.json.gz"),
];

let cached: PositionIndex | null = null;

export function loadIndex(): PositionIndex {
  if (cached) return cached;
  let lastErr: Error | null = null;
  for (const p of CANDIDATE_PATHS) {
    if (!existsSync(p)) continue;
    try {
      const buf = readFileSync(p);
      const json = p.endsWith(".gz")
        ? gunzipSync(buf).toString("utf-8")
        : buf.toString("utf-8");
      cached = JSON.parse(json) as PositionIndex;
      return cached;
    } catch (e: any) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("positions-index.json.gz not found");
}

export type IndexFilter = {
  year?: number;
  exam?: ExamType;
  education?: string;
  major?: string;
  political?: string;
  province?: string;
  dept?: string;
  inst_type?: string;
  grassroots?: string;
  exam_category?: string;
};

export function filterPositions(
  positions: Position[],
  f: IndexFilter,
): Position[] {
  return positions.filter((p) => {
    if (f.year && p.year !== f.year) return false;
    if (f.exam && p.exam !== f.exam) return false;
    if (f.education && !p.education.includes(f.education)) return false;
    if (f.major && !matchMajor(p.major, f.major)) return false;
    if (f.political && f.political !== "不限" && p.political !== "不限" && !p.political.includes(f.political)) return false;
    if (f.province && !p.work_location.includes(f.province)) return false;
    if (f.dept && !p.dept_name.includes(f.dept)) return false;
    if (f.inst_type && p.inst_type !== f.inst_type) return false;
    if (f.grassroots && p.grassroots_years !== "无限制" && p.grassroots_years !== f.grassroots) return false;
    if (f.exam_category && p.exam_category !== f.exam_category) return false;
    return true;
  });
}

function matchMajor(positionMajor: string, userMajor: string): boolean {
  if (positionMajor.includes("不限")) return true;
  const normalized = positionMajor.replace(/[;；,，、]/g, "|");
  return normalized.split("|").some(
    (m) => m.trim().includes(userMajor) || userMajor.includes(m.trim()),
  );
}
