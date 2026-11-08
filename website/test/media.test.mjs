import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import readmeMedia from "../../docs/media.json" with { type: "json" };
import { LOCALES } from "../src/lib/locale.js";
import media from "../src/media.json" with { type: "json" };

const dir = new URL("../src/", import.meta.url).pathname;
const sources = readdirSync(dir, { recursive: true })
  .filter((file) => file.endsWith(".jsx"))
  .map((file) => readFileSync(join(dir, file), "utf8"));

/**
 * 页面用到的 README 那批图（src/config.js 的 readme，清单是仓库的 docs/media.json）：
 * <Shot name="…" dark="…" small="…">、readme("…")，和首次引导那一段的 SHOTS 名单（Setup.jsx 拼成 setup-<步> 和窄屏的 setup-<步>-sm）
 */
function readmeNames() {
  const names = new Set();
  for (const source of sources) {
    for (const [, name] of source.matchAll(/<Shot\s+name="([\w-]+)"/g)) names.add(name);
    for (const [, name] of source.matchAll(/\b(?:dark|small)="([\w-]+)"/g)) names.add(name);
    for (const [, name] of source.matchAll(/\breadme\("([\w-]+)"/g)) names.add(name);
    const list = /const SHOTS = \[([^\]]+)\]/.exec(source);
    if (list)
      for (const [, step] of list[1].matchAll(/"([\w-]+)"/g)) names.add(`setup-${step}`).add(`setup-${step}-sm`);
  }
  return names;
}

test("页面用到的 README 那批图，每种语言都传过了、记着大小，在图片桶的 readme/ 下", () => {
  const names = readmeNames();
  assert.ok(names.size >= 10, `只找到 ${names.size} 张`);
  for (const locale of LOCALES) {
    for (const name of names) {
      const entry = readmeMedia[`${name}.${locale}`];
      assert.ok(entry, `docs/media.json 里缺 ${name}.${locale}`);
      assert.match(entry.path, /^readme\/[\w.-]+\.[0-9a-f]{8}\.webp$/);
      assert.ok(entry.width > 0 && entry.height > 0);
    }
  }
});

test("划词那几张实拍（名单在文案 lookup.shots）：每种语言用自己那几张，都有窄屏的 -card，小的两张还有裁出来的 -crop，都传过了", async () => {
  for (const locale of LOCALES) {
    const { default: messages } = await import(`../src/i18n/${locale}.js`);
    assert.equal(messages.lookup.shots.length, 3);
    const [main, ...rest] = messages.lookup.shots.map((shot) => shot.name);
    for (const name of [main, `${main}-card`, ...rest.flatMap((name) => [`${name}-crop`, `${name}-card`])]) {
      const entry = readmeMedia[`${name}.${locale}`];
      assert.ok(entry, `docs/media.json 里缺 ${name}.${locale}`);
      assert.match(entry.path, /^readme\/[\w.-]+\.[0-9a-f]{8}\.webp$/);
    }
  }
});

test("首屏的悬浮条每种语言都传过了，并且记着大小", () => {
  for (const locale of LOCALES) {
    const entry = media[`bar-indigo.${locale}`];
    assert.ok(entry, `缺 bar-indigo.${locale}`);
    assert.match(entry.path, /^shots\/[\w.-]+\.[0-9a-f]{8}\.webp$/);
    assert.ok(entry.width > 0 && entry.height > 0);
  }
});
