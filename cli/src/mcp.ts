// cli/src/mcp.ts
import { createInterface } from "node:readline";
import { loadIndex, filterPositions } from "./index-loader.js";
import { recommend } from "./recommend.js";
import { matchPositions } from "./match.js";
import { loadMemory, setPrefs, addWatched, clearMemory } from "./memory.js";
import { resolveProvince, PROVINCES } from "./codes.js";

const SERVER_INFO = { name: "kaogong-pro", version: "0.1.0" };
const PROTOCOL_VERSION = "2025-06-18";

type Tool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

const TOOLS: Tool[] = [
  {
    name: "search",
    description: "搜索国考岗位。按学历/专业/省份/部门/政治面貌/关键词过滤。",
    inputSchema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "职位名称/部门关键词" },
        education: { type: "string", description: "学历: 本科/硕士/博士" },
        major: { type: "string", description: "你的专业" },
        province: { type: "string", description: "工作地点省份" },
        political: { type: "string", description: "政治面貌" },
        dept: { type: "string", description: "部门名称关键词" },
        year: { type: "number", description: "年份，默认最新" },
        limit: { type: "number", description: "返回条数，默认 50" },
      },
    },
  },
  {
    name: "detail",
    description: "查询单个岗位的完整信息。",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "职位代码" },
        year: { type: "number", description: "年份" },
      },
      required: ["id"],
    },
  },
  {
    name: "recommend",
    description: "根据模考成绩，输出冲/稳/保三档岗位推荐。",
    inputSchema: {
      type: "object",
      properties: {
        score: { type: "number", description: "模考成绩 (行测+申论总分)" },
        education: { type: "string" },
        major: { type: "string" },
        province: { type: "string" },
        political: { type: "string" },
        exam_category: { type: "string", description: "综合/行政执法" },
        year: { type: "number" },
      },
      required: ["score"],
    },
  },
  {
    name: "compare",
    description: "对比 2-5 个岗位，side-by-side 输出。",
    inputSchema: {
      type: "object",
      properties: {
        ids: { type: "string", description: "逗号分隔的职位代码" },
        year: { type: "number" },
      },
      required: ["ids"],
    },
  },
  {
    name: "stats",
    description: "某年国考统计概览。",
    inputSchema: {
      type: "object",
      properties: { year: { type: "number" } },
    },
  },
  {
    name: "match",
    description: "基于完整 profile 的智能岗位匹配。",
    inputSchema: {
      type: "object",
      properties: {
        education: { type: "string" },
        major: { type: "string" },
        province: { type: "string" },
        political: { type: "string" },
        grassroots: { type: "string" },
        keywords: { type: "string", description: "逗号分隔的兴趣关键词" },
        year: { type: "number" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "memory_list",
    description: "查看已保存的偏好和关注列表。",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "memory_set",
    description: "设置用户偏好。",
    inputSchema: {
      type: "object",
      properties: {
        score: { type: "number" },
        education: { type: "string" },
        major: { type: "string" },
        province: { type: "string" },
        political: { type: "string" },
        exam_category: { type: "string" },
      },
    },
  },
  {
    name: "memory_watch",
    description: "关注某个岗位。",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" }, year: { type: "number" }, note: { type: "string" },
      },
      required: ["id", "year"],
    },
  },
  {
    name: "provinces",
    description: "列出 31 个省份。",
    inputSchema: { type: "object", properties: {} },
  },
];

function getStr(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === "string" ? v : undefined;
}
function getNum(args: Record<string, unknown>, key: string): number | undefined {
  const v = args[key];
  return typeof v === "number" ? v : (typeof v === "string" ? Number(v) : undefined);
}
function resolveProvinceArg(p?: string): string | undefined {
  if (!p) return undefined;
  const id = resolveProvince(p);
  return id ? PROVINCES[id]?.name : p;
}

async function dispatch(name: string, args: Record<string, unknown>): Promise<unknown> {
  const idx = loadIndex();
  const latestYear = Math.max(...idx.meta.years);

  switch (name) {
    case "search": {
      const year = getNum(args, "year") ?? latestYear;
      let results = filterPositions(idx.positions, {
        year,
        education: getStr(args, "education"),
        major: getStr(args, "major"),
        political: getStr(args, "political"),
        province: resolveProvinceArg(getStr(args, "province")),
        dept: getStr(args, "dept"),
      });
      const kw = getStr(args, "keyword")?.toLowerCase();
      if (kw) {
        results = results.filter((p) =>
          p.dept_name.includes(kw) || p.bureau.includes(kw) ||
          p.position_name.includes(kw) || p.position_desc.includes(kw));
      }
      const limit = getNum(args, "limit") ?? 50;
      return { total: results.length, positions: results.slice(0, limit) };
    }
    case "detail": {
      const id = getStr(args, "id")!;
      const year = getNum(args, "year") ?? latestYear;
      return idx.positions.find((p) => p.id === id && p.year === year)
        ?? { ok: false, error: `position ${id} not found in ${year}` };
    }
    case "recommend":
      return recommend({
        score: getNum(args, "score")!,
        education: getStr(args, "education"),
        major: getStr(args, "major"),
        province: resolveProvinceArg(getStr(args, "province")),
        political: getStr(args, "political"),
        exam_category: getStr(args, "exam_category"),
        year: getNum(args, "year"),
      });
    case "compare": {
      const ids = getStr(args, "ids")!.split(",");
      const year = getNum(args, "year") ?? latestYear;
      return ids.map((id) => idx.positions.find((p) => p.id === id.trim() && p.year === year)).filter(Boolean);
    }
    case "stats": {
      const year = getNum(args, "year") ?? latestYear;
      const yp = idx.positions.filter((p) => p.year === year);
      return { year, total_positions: yp.length, total_headcount: yp.reduce((s, p) => s + p.headcount, 0) };
    }
    case "match": {
      const results = matchPositions({
        education: getStr(args, "education"),
        major: getStr(args, "major"),
        political: getStr(args, "political"),
        province: resolveProvinceArg(getStr(args, "province")),
        grassroots: getStr(args, "grassroots"),
        keywords: getStr(args, "keywords")?.split(","),
        year: getNum(args, "year"),
      });
      return { total: results.length, positions: results.slice(0, getNum(args, "limit") ?? 30) };
    }
    case "memory_list": return loadMemory();
    case "memory_set": return setPrefs(args as Record<string, string>);
    case "memory_watch": return addWatched(getStr(args, "id")!, getNum(args, "year")!, getStr(args, "id")!, getStr(args, "note"));
    case "provinces": return Object.entries(PROVINCES).map(([id, p]) => ({ id, ...p }));
    default: throw new Error(`unknown tool: ${name}`);
  }
}

function rpcOk(id: unknown, result: unknown) {
  return JSON.stringify({ jsonrpc: "2.0", id, result });
}
function rpcErr(id: unknown, code: number, message: string) {
  return JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } });
}

export async function runMcpServer() {
  const rl = createInterface({ input: process.stdin, terminal: false });

  for await (const line of rl) {
    let req: { id?: unknown; method?: string; params?: Record<string, unknown> };
    try { req = JSON.parse(line); } catch {
      process.stdout.write(rpcErr(null, -32700, "parse error") + "\n");
      continue;
    }

    const { id, method, params } = req;
    try {
      if (method === "initialize") {
        process.stdout.write(rpcOk(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        }) + "\n");
      } else if (method === "initialized") {
        // no-op
      } else if (method === "tools/list") {
        process.stdout.write(rpcOk(id, { tools: TOOLS }) + "\n");
      } else if (method === "tools/call") {
        const name = (params as any)?.name as string;
        const toolArgs = (params as any)?.arguments ?? {};
        const result = await dispatch(name, toolArgs);
        process.stdout.write(rpcOk(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        }) + "\n");
      } else if (method === "ping") {
        process.stdout.write(rpcOk(id, {}) + "\n");
      } else {
        process.stdout.write(rpcErr(id, -32601, `method not found: ${method}`) + "\n");
      }
    } catch (e: any) {
      process.stdout.write(rpcErr(id, -32000, e.message) + "\n");
    }
  }
}

// When run directly, start the server
const isMain = process.argv[1] && (
  process.argv[1].endsWith("/mcp.ts") || process.argv[1].endsWith("/mcp.js")
);
if (isMain) runMcpServer();
