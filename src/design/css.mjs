// 把 token 写成 CSS：一组一段注释、一行一个变量。App 的 :root、官网的 @theme 都用它，两边写法一致。
// 生成的文件由 scripts/dev/make-tokens.mjs 交给 biome 排版后落盘；测试拿同样的结果逐字比。

/** 流体的值：最小值是手机上的大小，最大值是宽屏上的大小，中间按视口宽度连续变 */
export const fluid = (min, vw, max) => `clamp(${min}, ${vw}vw, ${max})`;

/**
 * 一个选择器（或 @theme）包住一批声明，一组之间空一行
 * @param {string} selector
 * @param {{ comment?: string, tokens: [string, string][] }[]} groups
 */
export const block = (selector, groups) =>
  `${selector} {\n${groups
    .map(({ comment, tokens }) =>
      [...(comment ? [`/* ${comment} */`] : []), ...tokens.map(([name, value]) => `--${name}: ${value};`)].join("\n"),
    )
    .join("\n\n")}\n}`;

/** 生成文件的头一行：说清是生成的、从哪来、怎么改 */
export const generatedNote = (source) =>
  `由 scripts/dev/make-tokens.mjs 从 ${source} 生成，别手改：改了源再跑 npm run tokens`;
