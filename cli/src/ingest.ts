// cli/src/ingest.ts
// CSV-converted 国考职位表 → positions-index.json.gz
// Pre-convert Excel: libreoffice --headless --convert-to csv raw/file.xlsx --outdir raw/
// Usage: npx tsx src/ingest.ts raw/guokao-2026.csv [raw/guokao-2025.csv ...]

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

function ingestCSV(csvPath: string, exam: ExamType): Position[] {
  const content = readFileSync(csvPath, "utf-8");
  const rows = parseCSV(content);
  if (rows.length < 2) throw new Error(`${csvPath}: too few rows`);

  const headers = rows[0];
  const colIndex: Record<string, number> = {};
  for (let i = 0; i < headers.length; i++) {
    colIndex[headers[i].replace(/\s/g, "")] = i;
  }

  const year = inferYear(basename(csvPath));
  const positions: Position[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const get = (col: string) => row[colIndex[col]] ?? "";

    const id = get("职位代码");
    if (!id) continue;

    positions.push({
      id, year, exam,
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

  console.log(`  ${csvPath}: ${positions.length} positions (${year})`);
  return positions;
}

function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.log("Usage: npx tsx src/ingest.ts raw/guokao-2026.csv [...]");
    console.log("Pre-convert: libreoffice --headless --convert-to csv raw/file.xlsx --outdir raw/");
    process.exit(1);
  }

  const allPositions: Position[] = [];
  const years = new Set<number>();

  for (const f of files) {
    const positions = ingestCSV(f, "guokao");
    allPositions.push(...positions);
    for (const p of positions) years.add(p.year);
  }

  const index: PositionIndex = {
    meta: {
      built_at: new Date().toISOString(),
      version: "0.1.0",
      exams: ["guokao"],
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
