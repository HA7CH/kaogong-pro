// cli/src/ingest.ts
// CSV-converted 职位表 → positions-index.json.gz
// Pre-convert Excel: libreoffice --headless --convert-to csv raw/file.xlsx --outdir raw/
// Usage:
//   npx tsx src/ingest.ts raw/guokao-2026.csv [raw/guokao-2025.csv ...]
//   npx tsx src/ingest.ts --exam beijing raw/beijing-2024.csv
// Filename prefix (guokao-/beijing-) auto-detects exam type if --exam omitted.

import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import type { Position, PositionIndex, ExamType } from "./codes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"' && content[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { current.push(field.trim()); field = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && content[i + 1] === "\n") i++;
        current.push(field.trim());
        if (current.some((c) => c)) rows.push(current);
        current = []; field = "";
      } else { field += ch; }
    }
  }
  if (field || current.length) {
    current.push(field.trim());
    if (current.some((c) => c)) rows.push(current);
  }
  return rows;
}

function inferYear(filename: string): number {
  const match = filename.match(/(\d{4})/);
  return match ? Number(match[1]) : new Date().getFullYear();
}

function ingestGuokaoCSV(csvPath: string, headers: string[], rows: string[][], year: number): Position[] {
  const colIndex: Record<string, number> = {};
  for (let i = 0; i < headers.length; i++) {
    colIndex[headers[i].replace(/\s/g, "")] = i;
  }
  const positions: Position[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const get = (col: string) => row[colIndex[col]] ?? "";
    const id = get("职位代码");
    if (!id) continue;
    positions.push({
      id, year, exam: "guokao",
      dept_code: get("部门代码"),
      dept_name: get("部门名称"),
      bureau: get("用人司局"),
      inst_type: get("机构性质"),
      inst_level: get("机构层级"),
      position_name: get("职位名称") || get("招考职位"),
      position_attr: get("职位属性"),
      position_dist: get("职位分布"),
      position_desc: get("职位简介"),
      exam_category: get("考试类别"),
      headcount: Number(get("招考人数")) || 1,
      education: get("学历"),
      degree: get("学位"),
      major: get("专业"),
      political: get("政治面貌"),
      grassroots_years: get("基层工作最低年限") || "无限制",
      work_location: get("工作地点"),
      remarks: get("备注"),
    });
  }
  console.log(`  ${csvPath}: ${positions.length} guokao positions (${year})`);
  return positions;
}

// 北京职位表 — 字段映射:
//   单位名称 → dept_name, 用人部门 → bureau, 机构性质 → inst_type,
//   职位层级 → inst_level, 职位名称 → position_name, 职位类别 → exam_category,
//   职位简介 → position_desc, 招考人数 → headcount, 学历要求 → education,
//   学位要求 → degree, 专业要求 → major, 政治面貌 → political,
//   基层工作经历最低年限 → grassroots_years, 备注+其它条件 → remarks
//   北京没有 work_location/部门代码/职位属性/职位分布，硬编码 work_location=北京
function ingestBeijingCSV(csvPath: string, headers: string[], rows: string[][], year: number): Position[] {
  const colIndex: Record<string, number> = {};
  for (let i = 0; i < headers.length; i++) {
    colIndex[headers[i].replace(/\s/g, "")] = i;
  }
  const positions: Position[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const get = (col: string) => row[colIndex[col]] ?? "";
    const id = get("职位代码");
    if (!id) continue;
    const remarks = [get("其它条件"), get("备注")].filter(Boolean).join(" | ");
    positions.push({
      id, year, exam: "beijing",
      dept_code: "",
      dept_name: get("单位名称"),
      bureau: get("用人部门"),
      inst_type: get("机构性质"),
      inst_level: get("职位层级"),
      position_name: get("职位名称"),
      position_attr: "",
      position_dist: "",
      position_desc: get("职位简介"),
      exam_category: get("职位类别"),
      headcount: Number(get("招考人数")) || 1,
      education: get("学历要求"),
      degree: get("学位要求"),
      major: get("专业要求") || "不限",
      political: get("政治面貌") || "不限",
      grassroots_years: get("基层工作经历最低年限") || "无限制",
      work_location: "北京",
      remarks,
    });
  }
  console.log(`  ${csvPath}: ${positions.length} beijing positions (${year})`);
  return positions;
}

function detectExam(filename: string, override?: ExamType): ExamType {
  if (override) return override;
  if (filename.includes("beijing")) return "beijing";
  return "guokao";
}

function ingestCSV(csvPath: string, exam: ExamType): Position[] {
  const content = readFileSync(csvPath, "utf-8");
  const rows = parseCSV(content);
  if (rows.length < 2) throw new Error(`${csvPath}: too few rows`);
  const year = inferYear(basename(csvPath));
  if (exam === "beijing") return ingestBeijingCSV(csvPath, rows[0], rows, year);
  return ingestGuokaoCSV(csvPath, rows[0], rows, year);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log("Usage: npx tsx src/ingest.ts [--exam <guokao|beijing>] raw/file.csv [...]");
    console.log("Auto-detects exam from filename prefix (guokao-/beijing-).");
    process.exit(1);
  }

  let examOverride: ExamType | undefined;
  const files: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--exam") {
      examOverride = args[++i] as ExamType;
    } else {
      files.push(args[i]);
    }
  }

  const allPositions: Position[] = [];
  const years = new Set<number>();
  const exams = new Set<ExamType>();

  for (const f of files) {
    const exam = detectExam(basename(f), examOverride);
    exams.add(exam);
    const positions = ingestCSV(f, exam);
    allPositions.push(...positions);
    for (const p of positions) years.add(p.year);
  }

  const index: PositionIndex = {
    meta: {
      built_at: new Date().toISOString(),
      version: "0.2.0",
      exams: [...exams].sort() as ExamType[],
      years: [...years].sort(),
      total_positions: allPositions.length,
    },
    positions: allPositions,
  };

  const outPath = join(__dirname, "..", "data", "positions-index.json.gz");
  const json = JSON.stringify(index);
  const gz = gzipSync(json);
  writeFileSync(outPath, gz);

  console.log(`\nWrote ${outPath}`);
  console.log(`  ${allPositions.length} positions across years ${[...years].join(", ")}`);
  console.log(`  JSON: ${(json.length / 1024).toFixed(0)} KB → gzip: ${(gz.length / 1024).toFixed(0)} KB`);
}

main();
