// cli/src/ratio-loader.ts
//
// 加载国考报录比数据 (cli/data/ratios/guokao-{year}.json)。
// 仅 top-10 岗位有 per-position ratio；其余岗位无公开数据 → 调用方需 fallback。
//
// 复合键：(year, id, dept_name, position_name) — 因为 id 在同一年内会被多个岗位复用。

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const CANDIDATE_DIRS = [
  join(__dirname, "..", "data", "ratios"),
  join(__dirname, "..", "..", "data", "ratios"),
  join(__dirname, "..", "..", "cli", "data", "ratios"),
];

export type RatioEntry = {
  rank?: number;
  id: string;
  year: number;
  dept_name: string;
  position_name: string;
  work_location?: string;
  headcount: number;
  applicants: number;
  ratio: number;
};

export type RatioFile = {
  year: number;
  exam: string;
  snapshot_at: string;
  snapshot_kind: string;
  sources: string[];
  national: {
    total_applicants: number;
    qualified_applicants?: number;
    total_headcount: number;
    total_positions: number | null;
    avg_ratio: number;
    max_ratio?: number;
    max_ratio_position?: string;
  };
  top_positions_by_applicants: RatioEntry[];
  top_positions_by_ratio: RatioEntry[];
  notes?: string;
};

const cache = new Map<number, RatioFile | null>();

function findRatiosDir(): string | null {
  for (const d of CANDIDATE_DIRS) {
    if (existsSync(d)) return d;
  }
  return null;
}

export function loadRatio(year: number): RatioFile | null {
  if (cache.has(year)) return cache.get(year) ?? null;
  const dir = findRatiosDir();
  if (!dir) { cache.set(year, null); return null; }
  const path = join(dir, `guokao-${year}.json`);
  if (!existsSync(path)) { cache.set(year, null); return null; }
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as RatioFile;
    cache.set(year, parsed);
    return parsed;
  } catch {
    cache.set(year, null);
    return null;
  }
}

export function availableRatioYears(): number[] {
  const dir = findRatiosDir();
  if (!dir) return [];
  return readdirSync(dir)
    .map((f) => f.match(/^guokao-(\d{4})\.json$/)?.[1])
    .filter((y): y is string => Boolean(y))
    .map(Number)
    .sort((a, b) => a - b);
}

/** Composite key for matching a ratio entry to a position record. */
function ratioKey(year: number, id: string, dept_name: string, position_name: string): string {
  return `${year}|${id}|${dept_name}|${position_name}`;
}

/** Build lookup map (year-scoped) from ratio file. Merges by_applicants + by_ratio. */
export function buildRatioMap(year: number): Map<string, RatioEntry> {
  const file = loadRatio(year);
  const map = new Map<string, RatioEntry>();
  if (!file) return map;
  const all = [...file.top_positions_by_applicants, ...file.top_positions_by_ratio];
  for (const e of all) {
    const k = ratioKey(e.year, e.id, e.dept_name, e.position_name);
    // Prefer entry with higher ratio when duplicated (final official rather than snapshot)
    const prev = map.get(k);
    if (!prev || e.ratio > prev.ratio) map.set(k, e);
  }
  return map;
}

export function lookupRatio(
  map: Map<string, RatioEntry>,
  year: number,
  id: string,
  dept_name: string,
  position_name: string,
): RatioEntry | undefined {
  return map.get(ratioKey(year, id, dept_name, position_name));
}
