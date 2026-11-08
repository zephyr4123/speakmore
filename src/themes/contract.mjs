// 一套主题要交出来的东西。界面（悬浮条、主窗口）只认这里列的 token，不知道现在用的是哪一套：
// 换主题就是换一组值。这一层不依赖 Electron，也不依赖 Node，命令行、现在的窗口、以后的桌面端用的是同一份。
//
// 加一套主题：照着 ink.mjs 写一个文件，在 index.mjs 里登记一行。合不合格由 themeProblems 说了算。

import { contrast } from "./color.mjs";

/** 悬浮条用的颜色。它浮在任意应用和壁纸上，所以只有一组，不分浅色深色 */
export const BAR_TOKENS = {
  surface: "条的底",
  edge: "条的描边：浮在深色背景上时把它和背景分开",
  ink: "条上的字和图标",
  muted: "次要的字：上方那行提示",
  ghost: "取消按钮的底",
  live: "正在听：声波",
  working: "整理中：滚动的波",
  go: "完成按钮的底，和完成时打的勾",
  onGo: "完成按钮上的图标",
  problem: "出错时的图标",
};

/** 主窗口用的颜色。窗口跟随系统的浅色深色，所以要浅、深两组 */
export const WINDOW_TOKENS = {
  bg: "窗口的底",
  raised: "比底高一层：输入框、鼠标停在上面的按钮",
  border: "分隔线和边框",
  ink: "正文",
  ink2: "次要的字",
  primary: "主按钮的底、链接、焦点框",
  onPrimary: "主按钮上的字",
  ok: "成功、已授权",
  problem: "出错、还差什么",
  glow: "渐变的另一头：和 primary 一起铺在主按钮、口述卡、进度上",
  aura: "窗口背后左上角晕开的光：侧栏的玻璃透出它",
  aura2: "窗口背后另一角的光，和 aura 错开一点色相",
};

/** 哪个叠在哪个上面、对比度至少多少。字要 4.5，图标和色块要 3（WCAG 2 的 AA） */
const BAR_LEGIBILITY = [
  ["ink", "surface", 4.5],
  ["muted", "surface", 4.5],
  ["ink", "ghost", 3],
  ["onGo", "go", 3],
  ["live", "surface", 3],
  ["working", "surface", 3],
  ["go", "surface", 3],
  ["problem", "surface", 3],
];
const WINDOW_LEGIBILITY = [
  ["ink", "bg", 4.5],
  ["ink", "raised", 4.5],
  ["ink2", "bg", 4.5],
  ["ink2", "raised", 4.5],
  ["primary", "bg", 4.5],
  ["primary", "raised", 4.5],
  ["onPrimary", "primary", 4.5],
  // 渐变从 primary 走到 glow，字在哪一头都要读得清
  ["onPrimary", "glow", 4.5],
  // 光晕在字的后面：正文、次要的字叠在最浓的地方也要读得清
  ["ink", "aura", 4.5],
  ["ink2", "aura", 4.5],
  ["ink", "aura2", 4.5],
  ["ink2", "aura2", 4.5],
  ["ok", "bg", 4.5],
  ["problem", "bg", 4.5],
];

const WINDOW_SCHEMES = { light: "浅色", dark: "深色" };

/** token 名 → CSS 变量名：onGo → --bar-on-go，ink2 → --ink-2 */
const cssName = (prefix, name) => `--${prefix}${name.replace(/[A-Z0-9]/g, (char) => `-${char.toLowerCase()}`)}`;

/** 一组 token 的毛病。官网的颜色也用它查对比度（test/design/tokens.test.mjs） */
export function groupProblems(where, values, tokens, legibility) {
  if (values === null || typeof values !== "object") return [`少了${where}这一组`];
  const problems = [];
  const usable = new Set();
  for (const name of Object.keys(tokens)) {
    if (!Object.hasOwn(values, name)) {
      problems.push(`${where}少了 ${name}`);
      continue;
    }
    try {
      contrast(values[name], values[name]);
      usable.add(name);
    } catch {
      problems.push(`${where}的 ${name} 要写成 oklch(亮度 彩度 色相)，现在是 ${JSON.stringify(values[name])}`);
    }
  }
  for (const name of Object.keys(values)) {
    if (!Object.hasOwn(tokens, name)) problems.push(`${where}多了不认识的 ${name}`);
  }
  for (const [front, back, least] of legibility) {
    if (!usable.has(front) || !usable.has(back)) continue;
    const ratio = contrast(values[front], values[back]);
    if (ratio < least) {
      problems.push(`${where}的 ${front} 叠在 ${back} 上看不清：对比度 ${ratio.toFixed(2)}，至少要 ${least}`);
    }
  }
  return problems;
}

/**
 * 一套主题哪里不合格。
 * @returns {string[]} 一条一个毛病；合格时是空的
 */
export function themeProblems(theme) {
  if (theme === null || typeof theme !== "object") return ["主题要是一组数据"];
  const problems = [];
  // id 会出现在命令和设置文件里
  if (typeof theme.id !== "string" || !/^[a-z][a-z0-9-]*$/.test(theme.id)) {
    problems.push("id 要是小写字母开头，只含小写字母、数字和连字符");
  }
  problems.push(...groupProblems("悬浮条", theme.bar, BAR_TOKENS, BAR_LEGIBILITY));
  for (const [scheme, label] of Object.entries(WINDOW_SCHEMES)) {
    problems.push(
      ...groupProblems(`窗口（${label}）`, theme.window?.[scheme] ?? null, WINDOW_TOKENS, WINDOW_LEGIBILITY),
    );
  }
  return problems;
}

/**
 * 把一套主题写成一段 CSS：给 :root 定义全部 token。页面里的样式只用 var(--…) 引用它们。
 * @returns {string}
 */
export function themeCss(theme) {
  const declare = (prefix, values, tokens) =>
    Object.keys(tokens)
      .map((name) => `${cssName(prefix, name)}: ${values[name]};`)
      .join(" ");
  return [
    `:root { ${declare("bar-", theme.bar, BAR_TOKENS)} ${declare("", theme.window.light, WINDOW_TOKENS)} }`,
    `@media (prefers-color-scheme: dark) { :root { ${declare("", theme.window.dark, WINDOW_TOKENS)} } }`,
  ].join("\n");
}

/** 主题一共定义了哪些 CSS 变量。页面的样式里用到的颜色变量都应该在这里面 */
export const THEME_CSS_VARIABLES = [
  ...Object.keys(BAR_TOKENS).map((name) => cssName("bar-", name)),
  ...Object.keys(WINDOW_TOKENS).map((name) => cssName("", name)),
];
