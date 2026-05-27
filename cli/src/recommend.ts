// cli/src/recommend.ts
import { loadIndex, filterPositions, type IndexFilter } from "./index-loader.js";
import type { Position, Cutoff } from "./codes.js";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export type RecommendInput = {
  score: number;
  education?: string;
  major?: string;
  province?: string;
  political?: string;
  grassroots?: string;
  exam_category?: string;
  year?: number;
};

export type RecommendCandidate = Position & {
  delta: number;
  bucket: "冲" | "稳" | "保" | "out";
};

export type RecommendOutput = {
  query: RecommendInput & { year: number };
  evaluated: number;
  buckets: {
    "冲": RecommendCandidate[];
    "稳": RecommendCandidate[];
    "保": RecommendCandidate[];
    out: RecommendCandidate[];
    skipped: number;
  };
};

function loadCutoff(year: number): Cutoff | null {
  const paths = [
    join(__dirname, "..", "data", "cutoffs", `guokao-${year}.json`),
    join(__dirname, "..", "..", "data", "cutoffs", `guokao-${year}.json`),
  ];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    try {
      return JSON.parse(readFileSync(p, "utf-8"));
    } catch { /* skip */ }
  }
  return null;
}

function getPositionCutoff(id: string, cutoff: Cutoff | null): number | null {
  if (!cutoff?.positions) return null;
  const found = cutoff.positions.find((c) => c.position_id === id);
  return found?.min_score ?? null;
}

function getNationalLine(instType: string, cutoff: Cutoff | null): number | null {
  if (!cutoff) return null;
  const lines = cutoff.national_lines;
  if (instType.includes("中央党群") || instType.includes("行政机关本级")) return lines.central.total;
  if (instType.includes("省级以下")) return lines.provincial.total;
  if (instType.includes("参照")) return lines.special.total;
  return lines.provincial.total;
}

export function recommend(input: RecommendInput): RecommendOutput {
  const idx = loadIndex();
  const year = input.year ?? Math.max(...idx.meta.years);

  const filter: IndexFilter = {
    year,
    education: input.education,
    major: input.major,
    political: input.political,
    province: input.province,
    grassroots: input.grassroots,
    exam_category: input.exam_category,
  };

  const candidates = filterPositions(idx.positions, filter);
  const cutoff = loadCutoff(year);
  const prevCutoff = loadCutoff(year - 1);

  const buckets: RecommendOutput["buckets"] = {
    "冲": [], "稳": [], "保": [], out: [], skipped: 0,
  };

  for (const p of candidates) {
    let baseline = getPositionCutoff(p.id, cutoff)
      ?? getPositionCutoff(p.id, prevCutoff)
      ?? getNationalLine(p.inst_type, cutoff)
      ?? getNationalLine(p.inst_type, prevCutoff);

    if (baseline === null) {
      buckets.skipped++;
      continue;
    }

    const delta = input.score - baseline;
    let bucket: RecommendCandidate["bucket"];

    if (delta >= 10) bucket = "保";
    else if (delta >= -3) bucket = "稳";
    else if (delta >= -15) bucket = "冲";
    else bucket = "out";

    buckets[bucket].push({ ...p, delta, bucket });
  }

  buckets["冲"].sort((a, b) => b.delta - a.delta);
  buckets["稳"].sort((a, b) => a.delta - b.delta);
  buckets["保"].sort((a, b) => a.delta - b.delta);
  buckets.out.sort((a, b) => b.delta - a.delta);

  return {
    query: { ...input, year },
    evaluated: candidates.length - buckets.skipped,
    buckets,
  };
}
