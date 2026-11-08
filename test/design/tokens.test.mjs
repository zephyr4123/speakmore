import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { APP_CSS, appCss, SITE_CSS, siteCss } from "../../scripts/dev/make-tokens.mjs";
import { definedVariables } from "../../src/design/css.mjs";
import { SITE_DARK, SITE_LEGIBILITY, SITE_THEME, SITE_TONE_INK } from "../../src/design/site.mjs";
import { groupProblems } from "../../src/themes/contract.mjs";

// 设计 token 只有 src/design/ 一个出处（说明见 src/design/README.md）。机器查得了的都在这里查：
// 生成的两份 CSS 和源一致、官网不绕过 token 写死值、官网的颜色读得清。App 样式的同类检查在 test/renderer/shared/ 下。

const ROOT = join(import.meta.dirname, "../..");
const read = (path) => readFileSync(join(ROOT, path), "utf8");

test("生成的两份 CSS 和 src/design/ 一致：改了源忘了跑 npm run tokens 会在这里报", () => {
  for (const [path, css] of [
    [APP_CSS, appCss()],
    [SITE_CSS, siteCss()],
  ]) {
    const want = definedVariables(css);
    const got = definedVariables(read(path));
    assert.deepEqual([...got.keys()], [...want.keys()], `${path} 的选择器对不上`);
    for (const [selector, variables] of want) {
      assert.deepEqual(Object.fromEntries(got.get(selector)), Object.fromEntries(variables), `${path} 的 ${selector}`);
    }
  }
});

// ---------- 官网不绕过 token ----------

const SITE_SRC = join(ROOT, "website/src");
const sources = readdirSync(SITE_SRC, { recursive: true })
  .filter((name) => /\.(jsx|js)$/.test(name) && !name.endsWith("icons/data.js"))
  .map((name) => ({ name, lines: readFileSync(join(SITE_SRC, name), "utf8").split("\n") }));

/** 这一行或上一行写了 token-exempt 和理由：特例就近标注，不进集中的名单 */
const exempt = (lines, index) => [lines[index], lines[index - 1] ?? ""].some((line) => /token-exempt:\s*\S/.test(line));

/** 文件:行号 和那一行，给报错看 */
const at = (name, index, line) => `${relative(ROOT, join(SITE_SRC, name))}:${index + 1}  ${line.trim()}`;

// 颜色、字号、字距、行高、圆角、阴影、间距、动效这几类工具类，写成任意值（-[...]）就是绕过了 token
const ARBITRARY =
  /(?<![\w-])(?:[\w-]+:)*-?(?:text|bg|border(?:-[trblxy])?|ring|outline|fill|stroke|from|via|to|decoration|caret|accent|rounded(?:-[trbl]{1,2})?|shadow|drop-shadow|tracking|leading|font|m[trblxy]?|p[trblxy]?|gap(?:-[xy])?|space-[xy]|animate|duration|delay|ease)-\[[^\]]+\]/g;

test("官网的颜色、字号、字距、行高、圆角、阴影、间距、动效都取 token，特例就近写 token-exempt 和理由", () => {
  assert.ok(sources.length >= 20, "没找到官网的源码，路径可能变了");
  const found = sources.flatMap(({ name, lines }) =>
    lines.flatMap((line, index) => (line.match(ARBITRARY) && !exempt(lines, index) ? [at(name, index, line)] : [])),
  );
  assert.deepEqual(found, []);
});

test("官网的脚本里不写颜色值：颜色都是 token（悬浮条那组从 App 的朱砂主题生成）", () => {
  const found = sources.flatMap(({ name, lines }) =>
    lines.flatMap((line, index) =>
      /oklch\(|#[0-9a-f]{3,8}\b|rgba?\(/i.test(line) && !exempt(lines, index) ? [at(name, index, line)] : [],
    ),
  );
  assert.deepEqual(found, []);
});

// @theme 里清掉了 Tailwind 默认的颜色、字号、圆角、阴影：写了不存在的名字不报错、只是不出样式，所以逐个核对名字
const defined = new Set(SITE_THEME.flatMap(({ tokens }) => tokens.map(([name]) => name)));
const has = (namespace, value) => defined.has(`${namespace}-${value}`);
/** 这些工具类后面跟的不是颜色、字号这类 token，是 Tailwind 自带的固定写法 */
const FIXED = {
  text: /^(left|center|right|justify|start|end|balance|pretty|wrap|nowrap|ellipsis|clip|transparent|current|inherit)$/,
  bg: /^(transparent|current|inherit|none|fixed|local|scroll|cover|contain|auto|center|top|bottom|left|right|repeat|no-repeat|(clip|origin|linear|radial|conic|blend)-.+)$/,
  border:
    /^(\d+|[trblxyse](-\d+)?|solid|dashed|dotted|double|hidden|none|transparent|current|collapse|separate|spacing-.+)$/,
  ring: /^(\d+|inset|transparent|current|offset-.+)$/,
  outline: /^(\d+|none|hidden|solid|dashed|dotted|double|offset-.+)$/,
  fill: /^(none|current|transparent)$/,
  stroke: /^(\d+|none|current|transparent)$/,
  from: /^\d+%$/,
  via: /^\d+%$/,
  to: /^\d+%$/,
  decoration: /^(\d+|solid|double|dotted|dashed|wavy|auto|from-font|clone|slice)$/,
};
const CLASS = /(?<![\w-])(?:[\w-]+:)*(-?)([a-z]+(?:-[a-z]+)*?)-([a-z0-9][\w.-]*?)(?:\/[\w.]+)?(?=["'`\s}]|$)/g;

test("官网用到的颜色、字号、圆角、阴影的名字都在 token 里", () => {
  const unknown = new Set();
  for (const { name, lines } of sources) {
    for (const line of lines) {
      for (const [, , utility, value] of line.matchAll(CLASS)) {
        let ok = true;
        if (utility === "rounded") {
          // rounded-bl-small 这类只圆一个角的：去掉角的那一段再查
          const radius = value.replace(/^[trbl]{1,2}-/, "");
          ok = radius === "full" || radius === "none" || has("radius", radius);
        } else if (utility === "shadow") ok = value === "none" || has("shadow", value);
        else if (utility === "drop-shadow") ok = value === "none" || has("drop-shadow", value);
        else if (utility === "text") ok = FIXED.text.test(value) || has("text", value) || has("color", value);
        else if (Object.hasOwn(FIXED, utility)) ok = FIXED[utility].test(value) || has("color", value);
        if (!ok) unknown.add(`${name}  ${utility}-${value}`);
      }
    }
  }
  assert.deepEqual([...unknown], []);
});

// ---------- 官网的颜色读得清 ----------

const colors = (groups) =>
  Object.fromEntries(
    groups.flatMap(({ tokens }) =>
      tokens
        .filter(([name]) => name.startsWith("color-"))
        .map(([name, value]) => [name.slice("color-".length).replace("-2", "2"), value]),
    ),
  );
const light = colors(SITE_THEME);

test("官网浅色、深色、固定深色那一段，字叠在底上都读得清（同 App 主题的对比度检查）", () => {
  // 固定深色那一段的 surface、raised 是半透明的，叠在什么上不一定，只查不透明的
  for (const [where, values] of [
    ["官网（浅色）", light],
    ["官网（深色）", { ...light, ...colors(SITE_DARK) }],
    ["官网（固定深色）", { ...light, ...colors(SITE_TONE_INK) }],
  ]) {
    const opaque = Object.fromEntries(Object.entries(values).filter(([, value]) => !value.includes("/")));
    const pairs = SITE_LEGIBILITY.filter(([front, back]) => front in opaque && back in opaque);
    const names = Object.fromEntries(
      [...new Set(pairs.flat().filter((x) => typeof x === "string"))].map((n) => [n, n]),
    );
    const picked = Object.fromEntries(Object.keys(names).map((n) => [n, opaque[n]]));
    assert.deepEqual(groupProblems(where, picked, names, pairs), [], where);
  }
});
