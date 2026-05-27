# kaogong-pro

用 Claude Code 规划你的考公选岗。
[kaogong.ha7ch.com](https://kaogong.ha7ch.com)

把下面这段 prompt 粘进 Claude Code / Codex / Cursor：

```
跑 `npx @ha7ch/kaogong-pro@latest help` 把命令摸清楚，然后帮我选 2026 年国考岗位。

先问我：学历、专业、政治面貌、意向省份/城市、是否有基层经验、模考成绩（行测+申论总分）。
每条推荐都用 CLI 拉真实数据支撑——查历年竞争比、进面分数线、岗位限制条件。
```

## Install

```bash
npx @ha7ch/kaogong-pro@latest help
```

## How it works

`kaogong-pro` is a CLI + MCP server that grounds an AI conversation in
official Chinese civil service exam data. Claude drives the flow; the
CLI is the data spine.

Data sources:
- **国家公务员局** (`bm.scs.gov.cn`) — official position tables (Excel)
- **华图镜像** (`ah.huatu.com/zt/gkzwbxz/`) — historical archives 2010-2026
- **中公/华图** — aggregated competition ratios and interview cutoff scores
