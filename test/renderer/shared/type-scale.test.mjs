import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

// 字的层级全靠 shared/tokens.css 里那几档字号、字重撑着。哪个样式里顺手写一个 14px、590，
// 名字、说明、标签就又开始一样大，所以由测试守着：字号、字重只能用 token。

const RENDERER = join(import.meta.dirname, "../../../src/renderer");
const TOKENS = join(RENDERER, "shared/tokens.css");

function cssFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(path);
    return entry.name.endsWith(".css") ? [path] : [];
  });
}

/** 一个样式文件里写死的字号、字重：文件:行号 和那一行 */
function hardcoded(path) {
  return readFileSync(path, "utf8")
    .split("\n")
    .map((line, index) => ({ line: line.trim(), at: `${relative(RENDERER, path)}:${index + 1}` }))
    .filter(({ line }) => /^font-(size|weight):\s*[\d.]/.test(line) || /^font:\s*[\d.]/.test(line))
    .map(({ line, at }) => `${at}  ${line}`);
}

test("样式里的字号、字重都用 tokens.css 的那几档，不写数", () => {
  const files = cssFiles(RENDERER).filter((path) => path !== TOKENS);
  assert.ok(files.length >= 5, "没找到样式文件，路径可能变了");
  assert.deepEqual(files.flatMap(hardcoded), []);
});

test("token 里的字号是六档、字重是三档", () => {
  const tokens = readFileSync(TOKENS, "utf8");
  assert.equal(tokens.match(/^\s*--text-[a-z]+:/gm)?.length, 6);
  assert.equal(tokens.match(/^\s*--weight-[a-z]+:/gm)?.length, 3);
});
