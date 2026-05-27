// cli/src/codes.ts

export const PROVINCES: Record<string, { name: string; pinyin: string }> = {
  "11": { name: "北京", pinyin: "beijing" },
  "12": { name: "天津", pinyin: "tianjin" },
  "13": { name: "河北", pinyin: "hebei" },
  "14": { name: "山西", pinyin: "shanxi" },
  "15": { name: "内蒙古", pinyin: "neimenggu" },
  "21": { name: "辽宁", pinyin: "liaoning" },
  "22": { name: "吉林", pinyin: "jilin" },
  "23": { name: "黑龙江", pinyin: "heilongjiang" },
  "31": { name: "上海", pinyin: "shanghai" },
  "32": { name: "江苏", pinyin: "jiangsu" },
  "33": { name: "浙江", pinyin: "zhejiang" },
  "34": { name: "安徽", pinyin: "anhui" },
  "35": { name: "福建", pinyin: "fujian" },
  "36": { name: "江西", pinyin: "jiangxi" },
  "37": { name: "山东", pinyin: "shandong" },
  "41": { name: "河南", pinyin: "henan" },
  "42": { name: "湖北", pinyin: "hubei" },
  "43": { name: "湖南", pinyin: "hunan" },
  "44": { name: "广东", pinyin: "guangdong" },
  "45": { name: "广西", pinyin: "guangxi" },
  "46": { name: "海南", pinyin: "hainan" },
  "50": { name: "重庆", pinyin: "chongqing" },
  "51": { name: "四川", pinyin: "sichuan" },
  "52": { name: "贵州", pinyin: "guizhou" },
  "53": { name: "云南", pinyin: "yunnan" },
  "54": { name: "西藏", pinyin: "xizang" },
  "61": { name: "陕西", pinyin: "shaanxi" },
  "62": { name: "甘肃", pinyin: "gansu" },
  "63": { name: "青海", pinyin: "qinghai" },
  "64": { name: "宁夏", pinyin: "ningxia" },
  "65": { name: "新疆", pinyin: "xinjiang" },
};

export function resolveProvince(input: string): string | null {
  if (PROVINCES[input]) return input;
  const lower = input.toLowerCase();
  for (const [id, p] of Object.entries(PROVINCES)) {
    if (p.name === input || p.pinyin === lower) return id;
  }
  return null;
}

export const EXAM_TYPES = {
  guokao: "国家公务员考试",
} as const;

export type ExamType = keyof typeof EXAM_TYPES;

export const EDUCATION_LEVELS = [
  "本科", "硕士研究生", "博士研究生",
  "大专", "本科及以上", "硕士研究生及以上", "博士研究生及以上",
  "仅限本科", "仅限硕士研究生", "仅限博士研究生",
] as const;

export const POLITICAL_STATUS = [
  "中共党员", "中共党员或共青团员", "不限",
] as const;

export const INST_TYPES = [
  "中央党群机关", "中央国家行政机关本级",
  "中央国家行政机关省级以下直属机构",
  "中央国家行政机关参照公务员法管理事业单位",
] as const;

export type Position = {
  id: string;
  year: number;
  exam: ExamType;
  dept_code: string;
  dept_name: string;
  bureau: string;
  inst_type: string;
  inst_level: string;
  position_name: string;
  position_attr: string;
  position_dist: string;
  position_desc: string;
  exam_category: string;
  headcount: number;
  education: string;
  degree: string;
  major: string;
  political: string;
  grassroots_years: string;
  work_location: string;
  remarks: string;
};

export type Cutoff = {
  year: number;
  exam: ExamType;
  national_lines: {
    central: { total: number; xingce: number };
    provincial: { total: number; xingce: number };
    western: { total: number; xingce: number };
    special: { total: number; xingce: number };
  };
  positions?: Array<{
    position_id: string;
    min_score: number;
    avg_score?: number;
    max_score?: number;
  }>;
};

export type PositionIndex = {
  meta: {
    built_at: string;
    version: string;
    exams: ExamType[];
    years: number[];
    total_positions: number;
  };
  positions: Position[];
};
