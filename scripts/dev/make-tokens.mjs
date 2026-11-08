// 设计 token 的源在 src/design/（说明见 src/design/README.md），这里生成两份 CSS，提交进仓库：
//   src/renderer/shared/tokens.css   App 的 :root（渲染页没有构建这一步，要现成的文件）
//   website/src/tokens.css           官网的 @theme（styles.css 里 @import，Docker 构建不用拷 src/design）
// 改了 src/design/ 就运行 npm run tokens；忘了的话 test/design/tokens.test.mjs 会指出来。
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { APP_DARK, APP_HEADER, APP_TOKENS } from "../../src/design/app.mjs";
import { block, generatedNote } from "../../src/design/css.mjs";
import { SITE_DARK, SITE_THEME, SITE_TONE_INK } from "../../src/design/site.mjs";

const root = new URL("../../", import.meta.url);
export const APP_CSS = "src/renderer/shared/tokens.css";
export const SITE_CSS = "website/src/tokens.css";

/** 深色下覆盖的那一段：两份都有 */
const dark = (groups) =>
  `@media (prefers-color-scheme: dark) {\n${block(":root", groups)
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n")}\n}`;

/** App 的那份：一个 :root，深色下覆盖几项 */
export function appCss() {
  return [
    `/* ${APP_HEADER}\n   ${generatedNote("src/design/app.mjs")} */`,
    block(":root", APP_TOKENS),
    dark(APP_DARK),
    "",
  ].join("\n\n");
}

/** 官网的那份：@theme 生成工具类，深色和固定深色的那一段只换颜色 */
export function siteCss() {
  return [
    `/* 官网的设计 token。${generatedNote("src/design/site.mjs")} */`,
    block("@theme", SITE_THEME),
    dark(SITE_DARK),
    block(".tone-ink", SITE_TONE_INK),
    "",
  ].join("\n\n");
}

if (import.meta.main) {
  const files = [
    [APP_CSS, appCss()],
    [SITE_CSS, siteCss()],
  ];
  for (const [path, css] of files) writeFileSync(new URL(path, root), css);
  // 排版交给 biome：和仓库里别的样式一个样子，npm run check 不报
  execFileSync(
    fileURLToPath(new URL("node_modules/.bin/biome", root)),
    ["format", "--write", ...files.map(([p]) => p)],
    {
      cwd: fileURLToPath(root),
      stdio: "inherit",
    },
  );
  console.log(`生成了 ${files.map(([path]) => path).join("、")}`);
}
