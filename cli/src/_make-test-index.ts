// cli/src/_make-test-index.ts — generates a tiny test index
import { writeFileSync, mkdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { PositionIndex } from "./codes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const index: PositionIndex = {
  meta: {
    built_at: new Date().toISOString(),
    version: "0.1.0",
    exams: ["guokao"],
    years: [2026],
    total_positions: 3,
  },
  positions: [
    {
      id: "300110001001", year: 2026, exam: "guokao",
      dept_code: "101", dept_name: "外交部", bureau: "翻译司",
      inst_type: "中央国家行政机关本级", inst_level: "中央",
      position_name: "英语翻译", position_attr: "普通职位", position_dist: "本部",
      position_desc: "从事外交翻译工作",
      exam_category: "综合", headcount: 2,
      education: "本科及以上", degree: "学士及以上",
      major: "英语;翻译", political: "中共党员",
      grassroots_years: "无限制", work_location: "北京",
      remarks: "限应届毕业生",
    },
    {
      id: "300110002001", year: 2026, exam: "guokao",
      dept_code: "102", dept_name: "国家税务总局", bureau: "北京市税务局",
      inst_type: "中央国家行政机关省级以下直属机构", inst_level: "市地级",
      position_name: "一级行政执法员", position_attr: "普通职位", position_dist: "派出机构",
      position_desc: "基层税务执法",
      exam_category: "行政执法", headcount: 5,
      education: "本科及以上", degree: "学士及以上",
      major: "财政学;税收学;会计学;经济学", political: "不限",
      grassroots_years: "无限制", work_location: "北京市朝阳区",
      remarks: "",
    },
    {
      id: "300110003001", year: 2026, exam: "guokao",
      dept_code: "103", dept_name: "海关总署", bureau: "深圳海关",
      inst_type: "中央国家行政机关省级以下直属机构", inst_level: "市地级",
      position_name: "海关监管", position_attr: "普通职位", position_dist: "派出机构",
      position_desc: "进出口商品监管",
      exam_category: "综合", headcount: 3,
      education: "仅限本科", degree: "学士",
      major: "不限", political: "不限",
      grassroots_years: "无限制", work_location: "广东省深圳市",
      remarks: "需服从二次分配",
    },
  ],
};

const dataDir = join(__dirname, "..", "data");
mkdirSync(dataDir, { recursive: true });
const out = join(dataDir, "positions-index.json.gz");
writeFileSync(out, gzipSync(JSON.stringify(index)));
console.log(`wrote ${out} (${index.positions.length} positions)`);
