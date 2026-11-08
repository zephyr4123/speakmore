import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { test } from "node:test";
import { THEME_CSS_VARIABLES } from "../../src/themes/contract.mjs";

// 页面的样式和主题之间的约定，机器查得了的都在这里查：颜色只从主题来，用到的变量都有出处。

const rendererDir = resolve(import.meta.dirname, "../../src/renderer");
const read = (name) => readFileSync(join(rendererDir, name), "utf8");
// 每个窗口一个子目录，共用的样式在 shared/ 里：要连子目录一起找，漏掉一处这里的检查就形同虚设
const files = readdirSync(rendererDir, { recursive: true });
const sheets = files.filter((name) => name.endsWith(".css")).map((name) => ({ name, css: read(name) }));
const pages = files.filter((name) => name.endsWith(".html")).map((name) => ({ name, html: read(name) }));

const definedIn = (css) => new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1]));
const usedIn = (css) => new Set([...css.matchAll(/var\(\s*(--[a-z0-9-]+)/g)].map((match) => match[1]));
const themed = new Set(THEME_CSS_VARIABLES);

test("主题给的变量，样式文件里一个都不自己定义：颜色只有主题这一个出处", () => {
  for (const { name, css } of sheets) {
    const redefined = [...definedIn(css)].filter((variable) => themed.has(variable));
    assert.deepEqual(redefined, [], name);
  }
});

test("样式里用到的每个变量都有出处：主题给的，或者样式文件自己定义的", () => {
  const local = new Set(sheets.flatMap(({ css }) => [...definedIn(css)]));
  for (const { name, css } of sheets) {
    const unknown = [...usedIn(css)].filter((variable) => !themed.has(variable) && !local.has(variable));
    assert.deepEqual(unknown, [], name);
  }
});

test("主题给的每个变量都有地方用：没有白定义的", () => {
  const used = new Set(sheets.flatMap(({ css }) => [...usedIn(css)]));
  assert.deepEqual(
    THEME_CSS_VARIABLES.filter((variable) => !used.has(variable)),
    [],
  );
});

test("样式里不写死颜色：阴影、压暗用的半透明黑也只在 tokens.css 里（src/design/app.mjs 生成），用的地方引用 --shadow-*、--lift、--scrim", () => {
  for (const { name, css } of sheets) {
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const literals =
      withoutComments.match(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^)]*\)/gi) ?? [];
    const allowed = name === join("shared", "tokens.css") ? /^oklch\(0 0 0 \/ [\d.]+\)$/ : /$^/;
    assert.deepEqual(
      literals.filter((literal) => !allowed.test(literal)),
      [],
      name,
    );
  }
});

test("每个页面都引入共用的 token，而且排在别的样式前面", () => {
  // 悬浮条、主窗口、首次引导三个页面，少了说明目录没扫全。首次引导演示用的页面在再下一层（onboarding/demo/）
  assert.ok(pages.length >= 3);
  for (const { name, html } of pages) {
    const links = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(links[0], relative(dirname(name), "shared/tokens.css").replaceAll("\\", "/"), name);
  }
});
