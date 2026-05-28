#!/usr/bin/env node
// cli/src/index.ts
import { loadIndex, filterPositions } from "./index-loader.js";
import { recommend } from "./recommend.js";
import { matchPositions } from "./match.js";
import { loadMemory, setPrefs, addWatched, logEvent, clearMemory, memoryPath } from "./memory.js";
import { resolveProvince, PROVINCES, EXAM_TYPES, type ExamType } from "./codes.js";
import { isTty, formatPositions, formatRecommend } from "./format.js";
import { loadRatio, buildRatioMap, lookupRatio, availableRatioYears } from "./ratio-loader.js";

const VERSION = "0.1.0";

const HELP = `
kaogong-pro v${VERSION}
用 Claude Code 规划你的考公选岗。

Usage: kaogong-pro <verb> [flags]

Core:
  search      搜索岗位
                --exam <考试>  guokao/beijing  默认全部
                --keyword <text>  职位名称/部门关键词
                --education <学历>  本科/硕士/博士
                --major <专业>  你的专业
                --province <省份>  意向工作地点 (名称/拼音/代码)
                --political <政治面貌>  中共党员/不限
                --dept <部门>  部门名称关键词
                --year <年份>  默认最新年份
                --limit <N>  返回前 N 条 (默认 50)

  detail      岗位详情
                --id <职位代码>
                --year <年份>

  recommend   冲/稳/保推荐
                --score <分数>  模考成绩 (行测+申论总分)
                --education <学历>
                --major <专业>
                --province <省份>
                --political <政治面貌>
                --exam-category <考试类别>  综合/行政执法
                --year <年份>

  compare     对比岗位
                --ids <id1,id2,...>
                --year <年份>

  hot         热门岗位 (有报录比数据时按竞争比, 否则按部门 headcount)
                --year <年份>  --top <N>  [--by ratio|applicants|dept]

  cold        冷门岗位 (招录多、限制严)
                --year <年份>  --top <N>

  match       智能匹配 (基于你的 profile)
                --education/--major/--province/--political/--grassroots
                --keywords <k1,k2>  兴趣关键词

Data:
  cutoff      进面分数线
                --year <年份>  [--id <职位代码>]
  ratio       报录比 / 竞争比
                --year <年份>  [--top <N>]  [--by ratio|applicants]
  stats       统计概览
                --year <年份>

State:
  memory list       列出记忆
  memory set        设置偏好 --score 140 --education 本科 --major 计算机
  memory watch      关注岗位 --id <id> --year <year> [--note <text>]
  memory clear      清除记忆

Meta:
  help        帮助
  version     版本
  selftest    自检
  provinces   列出 31 省份
  exams       列出支持的考试类型
`.trim();

function resolveExamFlag(flag?: string): ExamType | undefined {
  if (!flag) return undefined;
  if (flag in EXAM_TYPES) return flag as ExamType;
  return undefined;
}

function parseFlags(args: string[]): { positional: string[]; flags: Record<string, string> } {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = "true";
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

function countBy(arr: Record<string, unknown>[], key: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of arr) {
    const val = String(item[key] ?? "unknown");
    counts[val] = (counts[val] ?? 0) + 1;
  }
  return counts;
}

function resolveProvinceFlag(flag?: string): string | undefined {
  if (!flag) return undefined;
  const id = resolveProvince(flag);
  return id ? PROVINCES[id]?.name : flag;
}

type VerbFn = (flags: Record<string, string>, positional: string[]) => Promise<void> | void;

const VERBS: Record<string, VerbFn> = {
  help() { console.log(HELP); },
  version() { console.log(VERSION); },

  provinces() {
    printJson(Object.entries(PROVINCES).map(([id, p]) => ({ id, ...p })));
  },

  exams() {
    printJson(Object.entries(EXAM_TYPES).map(([id, name]) => ({ id, name })));
  },

  search(flags) {
    const idx = loadIndex();
    const year = flags.year ? Number(flags.year) : Math.max(...idx.meta.years);

    let results = filterPositions(idx.positions, {
      year,
      exam: resolveExamFlag(flags.exam),
      education: flags.education,
      major: flags.major,
      political: flags.political,
      province: resolveProvinceFlag(flags.province),
      dept: flags.dept,
      grassroots: flags.grassroots,
      exam_category: flags["exam-category"],
    });

    if (flags.keyword) {
      const kw = flags.keyword.toLowerCase();
      results = results.filter((p) =>
        p.dept_name.includes(kw) || p.bureau.includes(kw) ||
        p.position_name.includes(kw) || p.position_desc.includes(kw),
      );
    }

    const limit = Number(flags.limit ?? 50);
    const sliced = results.slice(0, limit);

    if (isTty() && flags.format !== "json") {
      console.log(`共 ${results.length} 个岗位 (显示前 ${sliced.length})\n`);
      console.log(formatPositions(sliced));
    } else {
      printJson({ total: results.length, positions: sliced });
    }
  },

  detail(flags) {
    const idx = loadIndex();
    const year = flags.year ? Number(flags.year) : Math.max(...idx.meta.years);
    const id = flags.id;
    if (!id) { console.error("--id required"); process.exitCode = 1; return; }
    const exam = resolveExamFlag(flags.exam);
    const found = idx.positions.find((p) =>
      p.id === id && p.year === year && (!exam || p.exam === exam),
    );
    if (!found) { printJson({ ok: false, error: `position ${id} not found in ${year}` }); process.exitCode = 1; return; }
    printJson(found);
  },

  recommend(flags) {
    const score = Number(flags.score);
    if (!score) { console.error("--score required"); process.exitCode = 1; return; }

    const result = recommend({
      score,
      exam: resolveExamFlag(flags.exam),
      education: flags.education,
      major: flags.major,
      province: resolveProvinceFlag(flags.province),
      political: flags.political,
      grassroots: flags.grassroots,
      exam_category: flags["exam-category"],
      year: flags.year ? Number(flags.year) : undefined,
    });

    logEvent("recommend", `score=${score}`);

    if (isTty() && flags.format !== "json") {
      console.log(formatRecommend(
        { score, evaluated: result.evaluated, skipped: result.buckets.skipped },
        result.buckets,
      ));
    } else {
      printJson(result);
    }
  },

  compare(flags) {
    const idx = loadIndex();
    const year = flags.year ? Number(flags.year) : Math.max(...idx.meta.years);
    const ids = (flags.ids ?? "").split(",").filter(Boolean);
    if (ids.length < 2) { console.error("--ids requires at least 2 comma-separated IDs"); process.exitCode = 1; return; }
    const found = ids.map((id) => idx.positions.find((p) => p.id === id && p.year === year)).filter(Boolean);
    printJson(found);
  },

  hot(flags) {
    const idx = loadIndex();
    const year = flags.year ? Number(flags.year) : Math.max(...idx.meta.years);
    const top = Number(flags.top ?? 20);
    const by = flags.by ?? "ratio"; // ratio | applicants | dept

    const ratioFile = loadRatio(year);

    // Explicit dept mode or no ratio data → fallback to dept headcount sort
    if (by === "dept" || !ratioFile) {
      const yearPositions = idx.positions.filter((p) => p.year === year);
      const deptCounts = new Map<string, number>();
      for (const p of yearPositions) deptCounts.set(p.dept_name, (deptCounts.get(p.dept_name) ?? 0) + 1);
      const sorted = [...deptCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, top);
      printJson({
        mode: "dept",
        ratio_data_available: Boolean(ratioFile),
        year,
        results: sorted.map(([dept, count]) => ({ dept, positions: count })),
      });
      return;
    }

    const list = by === "applicants"
      ? ratioFile.top_positions_by_applicants
      : ratioFile.top_positions_by_ratio;

    printJson({
      mode: by,
      year,
      snapshot_at: ratioFile.snapshot_at,
      national_avg_ratio: ratioFile.national.avg_ratio,
      results: list.slice(0, top),
    });
  },

  cold(flags) {
    const idx = loadIndex();
    const year = flags.year ? Number(flags.year) : Math.max(...idx.meta.years);
    const top = Number(flags.top ?? 20);

    // Cold = 招录多 + 限制严, then de-prioritize positions known to be hot.
    const ratioMap = buildRatioMap(year);
    const hotKeys = new Set(ratioMap.keys());

    const candidates = filterPositions(idx.positions, { year })
      .filter((p) => p.headcount >= 3 && p.major !== "不限" && p.political !== "不限")
      .filter((p) => {
        // Drop positions that appear in known-hot list.
        const key = `${p.year}|${p.id}|${p.dept_name}|${p.position_name}`;
        return !hotKeys.has(key);
      })
      .sort((a, b) => b.headcount - a.headcount)
      .slice(0, top);

    printJson({
      year,
      ratio_data_available: ratioMap.size > 0,
      results: candidates,
    });
  },

  ratio(flags) {
    const idx = loadIndex();
    const year = flags.year ? Number(flags.year) : Math.max(...idx.meta.years);
    const file = loadRatio(year);

    if (!file) {
      printJson({
        ok: false,
        error: `ratio data for ${year} not available`,
        available_years: availableRatioYears(),
      });
      process.exitCode = 1;
      return;
    }

    // --id lookup — composite key needs dept_name + position_name, so we resolve via index
    if (flags.id) {
      const map = buildRatioMap(year);
      const positions = idx.positions.filter((p) => p.id === flags.id && p.year === year);
      const matches = positions
        .map((p) => ({
          position: p,
          ratio: lookupRatio(map, year, p.id, p.dept_name, p.position_name),
        }))
        .filter((m) => m.ratio);
      printJson({
        year,
        id: flags.id,
        matches,
        note: matches.length === 0 ? "no public ratio data for this position (only top-10 are published)" : undefined,
      });
      return;
    }

    const top = Number(flags.top ?? 10);
    const by = flags.by ?? "ratio";
    const list = by === "applicants"
      ? file.top_positions_by_applicants
      : file.top_positions_by_ratio;

    printJson({
      year: file.year,
      snapshot_at: file.snapshot_at,
      snapshot_kind: file.snapshot_kind,
      national: file.national,
      top_by: by,
      top: list.slice(0, top),
      notes: file.notes,
      sources: file.sources,
    });
  },

  stats(flags) {
    const idx = loadIndex();
    const year = flags.year ? Number(flags.year) : Math.max(...idx.meta.years);
    const exam = resolveExamFlag(flags.exam);
    const yearPositions = idx.positions.filter((p) =>
      p.year === year && (!exam || p.exam === exam),
    );
    const totalHeadcount = yearPositions.reduce((s, p) => s + p.headcount, 0);
    printJson({
      year,
      exam: exam ?? "all",
      total_positions: yearPositions.length,
      total_headcount: totalHeadcount,
      by_exam: countBy(yearPositions as any[], "exam"),
      by_inst_type: countBy(yearPositions as any[], "inst_type"),
      by_education: countBy(yearPositions as any[], "education"),
      by_exam_category: countBy(yearPositions as any[], "exam_category"),
    });
  },

  match(flags) {
    const results = matchPositions({
      education: flags.education,
      major: flags.major,
      political: flags.political,
      province: resolveProvinceFlag(flags.province),
      grassroots: flags.grassroots,
      keywords: flags.keywords?.split(","),
      year: flags.year ? Number(flags.year) : undefined,
    });
    const limit = Number(flags.limit ?? 30);
    printJson({ total: results.length, positions: results.slice(0, limit) });
  },

  cutoff(flags) {
    const year = Number(flags.year ?? 2026);
    printJson({ ok: false, error: `cutoff data for ${year} not yet ingested` });
  },

  "memory"(flags, positional) {
    const sub = positional[0];
    if (sub === "list" || !sub) {
      printJson(loadMemory());
    } else if (sub === "set") {
      printJson(setPrefs(flags));
    } else if (sub === "watch") {
      if (!flags.id || !flags.year) { console.error("--id and --year required"); process.exitCode = 1; return; }
      const label = flags.label ?? flags.id;
      printJson(addWatched(flags.id, Number(flags.year), label, flags.note));
    } else if (sub === "clear") {
      printJson(clearMemory());
    } else {
      console.error(`unknown memory subcommand: ${sub}`);
      process.exitCode = 1;
    }
  },

  selftest() {
    const idx = loadIndex();
    console.log(`✓ index loaded: ${idx.meta.total_positions} positions, years ${idx.meta.years.join(",")}`);
    console.log(`✓ memory path: ${memoryPath()}`);
  },

};

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) { VERBS.help({}, []); return; }

  const verb = args[0];
  const { positional, flags } = parseFlags(args.slice(1));

  const fn = VERBS[verb];
  if (!fn) {
    console.error(`unknown verb: ${verb}. Run 'kaogong-pro help' for usage.`);
    process.exitCode = 1;
    return;
  }

  try {
    await fn(flags, positional);
  } catch (e: any) {
    printJson({ ok: false, error: e.message });
    process.exitCode = 1;
  }
}

main();
