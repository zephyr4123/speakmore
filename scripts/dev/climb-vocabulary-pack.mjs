#!/usr/bin/env node
// 爬山每轮交给分析的子 agent 的材料：只拷训练集的结果和输出，测试集的一行都不拷。
// 分析的人只读这个目录，测试集从结构上就够不着（不靠嘱咐"别看"）。
//
//   node scripts/dev/climb-vocabulary-pack.mjs --flow native --variant v1 --out bench/_work/hillclimb/analyzer/r2
//
// 拷出来：<out>/<flow>/rows.jsonl（训练集各格各遍的分数、参照、漏了和硬塞了什么）、traces/（训练集的输出）、
// artifact.txt（这一处写法现在的全文）、history.tsv（训练集每格在各轮的分数，看哪些一直卡着）。

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

const ROOT = resolve(import.meta.dirname, "../..");
const { values } = parseArgs({
  options: { flow: { type: "string" }, variant: { type: "string" }, out: { type: "string" } },
});
if (!values.flow || !values.variant || !values.out) {
  console.error("用法：--flow <native|polish|context> --variant <baseline|vN> --out <目录>");
  process.exit(2);
}
const dir = join(ROOT, "bench/_work/hillclimb", `vocabulary-${values.flow}`);
const state = JSON.parse(readFileSync(join(dir, "_state.json"), "utf8"));
const train = new Set(state.train_ids);
const readRows = (path) =>
  existsSync(path)
    ? readFileSync(path, "utf8")
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line))
    : [];

const out = join(resolve(values.out), values.flow);
mkdirSync(join(out, "traces"), { recursive: true });
const rows = readRows(join(dir, values.variant, "results.jsonl")).filter((row) => train.has(row.prompt_id));
writeFileSync(join(out, "rows.jsonl"), `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
for (const row of rows) {
  const name = `${row.prompt_id}_rep${row.rep}.json`;
  copyFileSync(join(dir, values.variant, "traces", name), join(out, "traces", name));
}
copyFileSync(join(ROOT, state.artifact), join(out, "artifact.txt"));

// 训练集每格在各轮的"全对"（各遍平均）
const variants = ["baseline", ...Array.from({ length: 50 }, (_, i) => `v${i + 1}`)].filter((v) =>
  existsSync(join(dir, v, "results.jsonl")),
);
const table = new Map();
for (const v of variants)
  for (const row of readRows(join(dir, v, "results.jsonl")).filter((r) => train.has(r.prompt_id))) {
    const cell = table.get(row.prompt_id) ?? {};
    cell[v] = [...(cell[v] ?? []), row.grade.pass];
    table.set(row.prompt_id, cell);
  }
const mean = (xs) => (xs ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : "");
writeFileSync(
  join(out, "history.tsv"),
  `${[
    ["case", ...variants].join("\t"),
    ...[...table].map(([id, cell]) => [id, ...variants.map((v) => mean(cell[v]))].join("\t")),
  ].join("\n")}\n`,
);
const failing = rows.filter((row) => row.grade.pass === 0).length;
console.log(`${values.flow}/${values.variant}：训练集 ${rows.length} 行（没全对 ${failing} 行）→ ${out}`);
