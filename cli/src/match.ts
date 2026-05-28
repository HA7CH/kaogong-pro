// cli/src/match.ts
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadIndex, filterPositions, type IndexFilter } from "./index-loader.js";
import type { Position } from "./codes.js";

export type MatchProfile = {
  education?: string;
  major?: string;
  political?: string;
  province?: string;
  grassroots?: string;
  keywords?: string[];
  year?: number;
};

export type MatchResult = Position & {
  fit_score: number;
  fit_reasons: string[];
};

// --- Major classification dictionary ---

type MajorEntry = { code: string; name: string };
type CategoryEntry = {
  code: string;
  name: string;
  group: string;
  level: string;
  majors: MajorEntry[];
};
type CompositeEntry = {
  name: string;
  description?: string;
  includes_categories?: string[];
  includes_majors?: string[];
  excludes_majors?: string[];
  graduate_codes?: string[];
  keywords?: string[];
};
type GraduateCode = { code: string; name: string; level: string; group: string };
type MajorsDict = {
  version: string;
  source: string;
  categories: CategoryEntry[];
  civil_service_composites: CompositeEntry[];
  graduate_codes: GraduateCode[];
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const DICT_PATHS = [
  join(__dirname, "..", "data", "majors.json"),
  join(__dirname, "..", "..", "data", "majors.json"),
  join(__dirname, "..", "..", "cli", "data", "majors.json"),
];

let dictCache: MajorsDict | null = null;

function loadMajorsDict(): MajorsDict | null {
  if (dictCache) return dictCache;
  for (const p of DICT_PATHS) {
    if (!existsSync(p)) continue;
    try {
      dictCache = JSON.parse(readFileSync(p, "utf-8")) as MajorsDict;
      return dictCache;
    } catch {
      // ignore and try next
    }
  }
  return null;
}

/**
 * Look up the category(ies) a user-provided major belongs to.
 * Returns matching categories ranked by name overlap.
 * Empty array = unknown major (caller should fall back to string match).
 */
export function findMajorCategory(userMajor: string): CategoryEntry[] {
  const dict = loadMajorsDict();
  if (!dict || !userMajor) return [];
  const q = userMajor.trim();
  if (!q) return [];

  const hits: CategoryEntry[] = [];
  for (const cat of dict.categories) {
    // Exact category match (e.g. user typed "经济学类")
    if (cat.name === q) {
      hits.push(cat);
      continue;
    }
    // Major name match (e.g. user typed "会计学" → 工商管理类)
    if (cat.majors.some((m) => m.name === q || q.includes(m.name) || m.name.includes(q))) {
      hits.push(cat);
    }
  }
  return hits;
}

/**
 * Parse a position's major field into a structured list of accepted categories
 * and majors. Handles common separators (; ； , ， 、 /) and embedded codes
 * like "计算机科学与技术(0812)" or "0809计算机类".
 */
export function parsePositionMajor(positionMajor: string): {
  unlimited: boolean;
  categoryCodes: string[];
  categoryNames: string[];
  majorNames: string[];
  rawTokens: string[];
} {
  const empty = {
    unlimited: false,
    categoryCodes: [] as string[],
    categoryNames: [] as string[],
    majorNames: [] as string[],
    rawTokens: [] as string[],
  };
  if (!positionMajor) return empty;
  if (positionMajor.includes("不限")) return { ...empty, unlimited: true };

  const dict = loadMajorsDict();
  const tokens = positionMajor
    .split(/[;；,，、/]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const categoryCodes = new Set<string>();
  const categoryNames = new Set<string>();
  const majorNames = new Set<string>();

  for (const tokRaw of tokens) {
    // Extract embedded MOE code like (0812) or leading 0809
    const codeMatch = tokRaw.match(/\b(\d{4})\b/);
    if (codeMatch) categoryCodes.add(codeMatch[1]);

    // Strip code and parenthesis fragments for name comparison
    const tokName = tokRaw.replace(/[()（）]/g, "").replace(/\d{4}/g, "").trim();

    if (dict) {
      const catHit = dict.categories.find((c) => c.name === tokName || c.code === codeMatch?.[1]);
      if (catHit) {
        categoryCodes.add(catHit.code);
        categoryNames.add(catHit.name);
        continue;
      }
      // Maybe it's a specific major name
      let majorHit = false;
      for (const cat of dict.categories) {
        const m = cat.majors.find((mm) => mm.name === tokName);
        if (m) {
          majorNames.add(m.name);
          majorHit = true;
          break;
        }
      }
      if (majorHit) continue;
    }

    // Fallback: keep as a free-form major name token
    if (tokName) majorNames.add(tokName);
  }

  return {
    unlimited: false,
    categoryCodes: [...categoryCodes],
    categoryNames: [...categoryNames],
    majorNames: [...majorNames],
    rawTokens: tokens,
  };
}

/**
 * Smart major match: user's major matches a position's major requirement if
 *   1. position is 不限, OR
 *   2. user's resolved category code ∈ position's accepted category codes, OR
 *   3. user's major name ∈ position's accepted major names, OR
 *   4. fallback string-includes (preserved from old behavior).
 *
 * Returns { matched, reason } so callers can attribute the match.
 */
export function smartMatchMajor(
  positionMajor: string,
  userMajor: string,
): { matched: boolean; reason: "unlimited" | "category" | "major" | "string" | "none" } {
  if (!userMajor) return { matched: true, reason: "unlimited" };
  const parsed = parsePositionMajor(positionMajor);
  if (parsed.unlimited) return { matched: true, reason: "unlimited" };

  const userCats = findMajorCategory(userMajor);
  if (userCats.length && parsed.categoryCodes.length) {
    for (const c of userCats) {
      if (parsed.categoryCodes.includes(c.code)) {
        return { matched: true, reason: "category" };
      }
    }
  }
  if (userCats.length && parsed.categoryNames.length) {
    for (const c of userCats) {
      if (parsed.categoryNames.includes(c.name)) {
        return { matched: true, reason: "category" };
      }
    }
  }

  if (parsed.majorNames.some((m) => m === userMajor || m.includes(userMajor) || userMajor.includes(m))) {
    return { matched: true, reason: "major" };
  }

  // Fallback: legacy string-includes (preserves old behavior)
  const normalized = positionMajor.replace(/[;；,，、]/g, "|");
  const hit = normalized
    .split("|")
    .some((m) => m.trim().includes(userMajor) || userMajor.includes(m.trim()));
  return hit ? { matched: true, reason: "string" } : { matched: false, reason: "none" };
}

export function matchPositions(profile: MatchProfile): MatchResult[] {
  const idx = loadIndex();
  const year = profile.year ?? Math.max(...idx.meta.years);

  const filter: IndexFilter = {
    year,
    education: profile.education,
    major: profile.major,
    political: profile.political,
    province: profile.province,
    grassroots: profile.grassroots,
  };

  const candidates = filterPositions(idx.positions, filter);

  return candidates
    .map((p) => {
      let score = 0;
      const reasons: string[] = [];

      if (p.headcount >= 5) { score += 20; reasons.push("招录≥5人"); }
      else if (p.headcount >= 3) { score += 10; reasons.push("招录≥3人"); }

      if (p.political === "中共党员") { score += 15; reasons.push("限党员"); }
      if (p.grassroots_years !== "无限制") { score += 10; reasons.push("限基层经验"); }
      if (p.remarks.includes("限应届")) { score += 10; reasons.push("限应届"); }
      if (p.remarks.includes("男") || p.remarks.includes("女")) { score += 5; reasons.push("限性别"); }

      if (p.major !== "不限" && !p.major.includes("不限")) {
        score += 10;
        reasons.push("限专业");
      }

      if (profile.keywords?.length) {
        const text = `${p.dept_name} ${p.bureau} ${p.position_name} ${p.position_desc}`;
        for (const kw of profile.keywords) {
          if (text.includes(kw)) { score += 15; reasons.push(`匹配"${kw}"`); }
        }
      }

      return { ...p, fit_score: score, fit_reasons: reasons };
    })
    .sort((a, b) => b.fit_score - a.fit_score);
}
