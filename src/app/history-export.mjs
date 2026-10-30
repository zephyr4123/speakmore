import { dayKey } from "../usage/insights.mjs";

// 历史的导出：Markdown（给人看）、JSON（备份、再处理）、CSV（表格）。按存成的扩展名挑格式，保存窗口里选。
// 这里是纯函数：行从 history.list 来，写文件、弹保存窗口由 main 做。
// Markdown 用本机日历上的日子和钟点（和界面上看历史一致），JSON、CSV 保留原来的 ISO 时间。

const timeOf = (iso) => new Date(iso).toTimeString().slice(0, 5);

/** 正文：失败的写原因，没听到声音的写那句，其余写成品 */
function bodyOf(row, t) {
  if (row.status === "failed") return `${t("history.failed")}${row.error ?? ""}`;
  if (row.refinedText === "") return t("history.silent");
  return row.refinedText;
}

/** Markdown：按天分节，一条一段，标题是时间和功能（翻译的带上目标语言）；翻译的下面附原文 */
function renderMarkdown(rows, t) {
  const lines = [`# ${t("history.title")}`];
  let day = null;
  for (const row of rows) {
    const rowDay = dayKey(new Date(row.createdAt));
    if (rowDay !== day) lines.push("", `## ${rowDay}`);
    day = rowDay;
    const title = [timeOf(row.createdAt), t(`actions.${row.kind}.name`)];
    if (row.outputLanguage) title.push(t(`languages.${row.outputLanguage}`));
    lines.push("", `**${title.join(" · ")}**`, "", bodyOf(row, t));
    if (row.sourceText) lines.push("", t("history.original", { text: row.sourceText }));
  }
  return `${lines.join("\n")}\n`;
}

/** CSV 的一个字段：一律加引号，里面的引号翻倍；换行留在引号里（Excel 认）。= + - @ 开头的不改：要的是原话 */
const csvField = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

/** CSV：一行一条，表头固定英文（给脚本、表格认，不随界面语言变）。钱不知道价时是空的（不是 0），时长按秒 */
function renderCsv(rows) {
  const header = [
    "created_at",
    "kind",
    "status",
    "duration_seconds",
    "output_language",
    "input_tokens",
    "output_tokens",
    "cost_usd",
    "text",
    "source_text",
    "rerun_of",
  ];
  const line = (row) => [
    row.createdAt,
    row.kind,
    row.status,
    row.duration,
    row.outputLanguage,
    row.usage?.inputTokens,
    row.usage?.outputTokens,
    row.usage?.costUsd,
    row.status === "failed" ? row.error : row.refinedText,
    row.sourceText,
    row.rerunOf,
  ];
  // Excel 打开中文 CSV 要先看到 BOM 才不乱码
  return `﻿${[header, ...rows.map(line)].map((fields) => fields.map(csvField).join(",")).join("\r\n")}\r\n`;
}

/**
 * 能导出的格式，键是扩展名。保存窗口里的文件类型按这张表列；render(rows, t) 的 rows 是 history.list 的形状
 * @type {Record<string, { name: string, render: (rows: object[], t: Function) => string }>}
 */
export const EXPORTS = Object.freeze({
  md: { name: "Markdown", render: renderMarkdown },
  json: { name: "JSON", render: (rows) => `${JSON.stringify(rows, null, 2)}\n` },
  csv: { name: "CSV", render: renderCsv },
});
