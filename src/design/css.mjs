// 把 token 写成 CSS：一组一段注释、一行一个变量。App 的 :root、官网的 @theme 都用它，两边写法一致。
// 生成的文件由 scripts/dev/make-tokens.mjs 落盘（再交给 biome 排版）；测试只比变量名和值，不比排版。

/** 流体的值：最小值是手机上的大小，最大值是宽屏上的大小，中间按视口宽度连续变 */
export const fluid = (min, vw, max) => `clamp(${min}, ${vw}vw, ${max})`;

/**
 * @param {{ comment?: string, tokens: [string, string][] }[]} groups
 * @returns {string} 不带外层选择器的声明
 */
export function declarations(groups, indent = "  ") {
  return groups
    .map(({ comment, tokens }) =>
      [
        ...(comment ? [`${indent}/* ${comment} */`] : []),
        ...tokens.map(([name, value]) => `${indent}--${name}: ${value};`),
      ].join("\n"),
    )
    .join("\n\n");
}

/** 一个选择器（或 @theme）包住一批声明 */
export const block = (selector, groups) => `${selector} {\n${declarations(groups)}\n}`;

/** 生成文件的头一行：说清是生成的、从哪来、怎么改 */
export const generatedNote = (source) =>
  `由 scripts/dev/make-tokens.mjs 从 ${source} 生成，别手改：改了源再跑 npm run tokens`;

/**
 * 一段 CSS 里定义的变量：选择器（@theme、:root、.tone-ink……）→ 变量名 → 值。空白规整成一个空格，注释去掉。
 * 测试用它核对生成物和源一致，排版怎么变都不影响
 */
export function definedVariables(css) {
  const result = new Map();
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of plain.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].trim().replace(/\s+/g, " ");
    const variables = result.get(selector) ?? new Map();
    for (const declaration of match[2].matchAll(/(--[\w*-]+)\s*:\s*([^;]+);/g)) {
      variables.set(declaration[1], declaration[2].trim().replace(/\s+/g, " "));
    }
    result.set(selector, variables);
  }
  return result;
}
