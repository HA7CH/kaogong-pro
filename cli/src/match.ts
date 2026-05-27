// cli/src/match.ts
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
