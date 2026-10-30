import assert from "node:assert/strict";
import { test } from "node:test";
import { EXPORTS } from "../../src/app/history-export.mjs";
import { createTranslator } from "../../src/i18n/index.mjs";

const zh = createTranslator("zh-CN");

const rows = [
  {
    id: "b",
    kind: "translate",
    status: "completed",
    refinedText: "Let's ship it.",
    sourceText: "我们发布吧",
    outputLanguage: "en",
    error: null,
    duration: 5.5,
    audioFile: "b.webm",
    rerunOf: null,
    createdAt: "2026-10-29T09:30:00.000Z",
    usage: { calls: 1, inputTokens: 12, outputTokens: 34, costUsd: 0.0012, latencyMs: 900, models: ["deepseek-flash"] },
  },
  {
    id: "a",
    kind: "dictate",
    status: "failed",
    refinedText: "",
    sourceText: null,
    outputLanguage: null,
    error: '服务端 "没有" 回应\n第二行',
    duration: 2,
    audioFile: "a.webm",
    rerunOf: null,
    createdAt: "2026-10-28T23:05:00.000Z",
    usage: null,
  },
  {
    id: "c",
    kind: "dictate",
    status: "completed",
    refinedText: "",
    sourceText: null,
    outputLanguage: null,
    error: null,
    duration: 1,
    audioFile: "c.webm",
    rerunOf: "x",
    createdAt: "2026-10-27T22:00:00.000Z",
    usage: null,
  },
];

/** Markdown 按本机日历分天：固定在东八区比整段 */
function inShanghai(run) {
  const before = process.env.TZ;
  process.env.TZ = "Asia/Shanghai";
  try {
    return run();
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
}

test("能导出的格式按扩展名列：保存窗口里的文件类型照这个顺序", () => {
  assert.deepEqual(
    Object.entries(EXPORTS).map(([extension, { name }]) => [extension, name]),
    [
      ["md", "Markdown"],
      ["json", "JSON"],
      ["csv", "CSV"],
    ],
  );
});

test("Markdown：按本机日历分天，一条一段；翻译的带功能、目标语言和原文，失败写原因，没声音写那句", () => {
  assert.equal(
    inShanghai(() => EXPORTS.md.render(rows, zh)),
    [
      "# 历史",
      "",
      "## 2026-10-29",
      "",
      "**17:30 · 语音翻译 · 英文**",
      "",
      "Let's ship it.",
      "",
      "原文：我们发布吧",
      "",
      "**07:05 · 语音输入**",
      "",
      '失败 · 服务端 "没有" 回应\n第二行',
      "",
      "## 2026-10-28",
      "",
      "**06:00 · 语音输入**",
      "",
      "音频无声",
      "",
    ].join("\n"),
  );
});

test("JSON：原样一串，字段和 history.list 一样，可以再读回来", () => {
  assert.deepEqual(JSON.parse(EXPORTS.json.render(rows)), rows);
});

test("CSV：带 BOM，表头固定英文，引号和换行按 CSV 的规矩转义；不知道的空着；重跑的写原记录", () => {
  assert.equal(
    EXPORTS.csv.render(rows),
    "﻿" +
      [
        '"created_at","kind","status","duration_seconds","output_language","input_tokens","output_tokens","cost_usd","text","source_text","rerun_of"',
        '"2026-10-29T09:30:00.000Z","translate","completed","5.5","en","12","34","0.0012","Let\'s ship it.","我们发布吧",""',
        '"2026-10-28T23:05:00.000Z","dictate","failed","2","","","","","服务端 ""没有"" 回应\n第二行","",""',
        '"2026-10-27T22:00:00.000Z","dictate","completed","1","","","","","","","x"',
      ].join("\r\n") +
      "\r\n",
  );
});
