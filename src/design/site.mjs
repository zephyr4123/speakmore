// 官网的 token：生成 website/src/tokens.css（npm run tokens），styles.css 里 @import。
// 名字按用途起（lead、section、price……），不按大小：第二步改值时组件一行都不用动。
// 桌面和手机是同一套：流体的值写成 clamp(手机, 视口宽度, 宽屏)，少数特例在组件里按断点覆盖。
// 第一步只收纳、不改观感：值照搬原来写在 JSX 和 styles.css 里的，只并了肉眼看不出的几处（README.md 的合并记录）。

import cinnabar from "../themes/cinnabar.mjs";
import { RADIUS } from "./base.mjs";
import { fluid } from "./css.mjs";

/** @type {{ comment?: string, tokens: [string, string][] }[]} 写进 @theme：Tailwind 按名字生成 text-lead、rounded-tile 这类工具类 */
export const SITE_THEME = [
  {
    comment:
      "清掉 Tailwind 默认的颜色、字号、圆角、阴影：只认下面列的，gray-500、text-sm、rounded-lg 这类写了也不出样式（测试会拦）",
    tokens: [
      ["color-*", "initial"],
      ["text-*", "initial"],
      ["radius-*", "initial"],
      ["shadow-*", "initial"],
    ],
  },
  {
    tokens: [
      [
        "font-sans",
        '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif',
      ],
      [
        "font-display",
        '-apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif',
      ],
    ],
  },
  {
    comment: "大号的数字用系统的圆体，和 App 首页一样",
    tokens: [
      ["font-rounded", 'ui-rounded, "SF Pro Rounded", -apple-system, "PingFang SC", system-ui, sans-serif'],
      ["font-mono", 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'],
    ],
  },
  {
    comment: `颜色从 App 的图标那方印来：靛青的印底、朱砂和赭石两道、浅色的刻痕（assets/icon.svg）。
     大块的底色都是纯色、不铺渐变光晕：跟着系统深浅变，隐私一段固定是近黑（.tone-ink 在下面重新给一遍颜色）。
     用 OKLCH，浅色的底往靛青偏一点点，不往暖色偏。`,
    tokens: [
      ["color-canvas", "oklch(0.99 0.002 255)"],
      ["color-surface", "oklch(0.962 0.006 255)"],
      ["color-raised", "oklch(1 0 0)"],
      ["color-ink", "oklch(0.21 0.02 255)"],
      ["color-ink-2", "oklch(0.45 0.02 255)"],
      ["color-line", "oklch(0.9 0.008 255)"],
      ["color-link", "oklch(0.47 0.11 255)"],
      ["color-seal", "oklch(0.4 0.075 255)"],
      ["color-cinnabar", "oklch(0.55 0.17 33)"],
      ["color-cinnabar-glow", "oklch(0.74 0.17 32)"],
      ["color-ochre", "oklch(0.74 0.12 75)"],
    ],
  },
  {
    comment: "纯白：深色插画（终端）里的字和半透明的刻线、语音方式徽标上的字",
    tokens: [["color-white", "#fff"]],
  },
  {
    comment: "演示用的悬浮条照 App 的朱砂主题画：颜色从 src/themes/cinnabar.mjs 取，App 改色这里跟着变",
    tokens: ["surface", "edge", "ghost", "live", "ink", "muted"].map((name) => [
      `color-bar-${name}`,
      cinnabar.bar[name],
    ]),
  },
  {
    comment: "插画里的终端窗口：近黑的底、浅灰的字、提亮的靛青",
    tokens: [
      ["color-terminal", "oklch(0.17 0.012 255)"],
      ["color-terminal-ink", "oklch(0.86 0.01 255)"],
      ["color-terminal-accent", "oklch(0.8 0.07 255)"],
    ],
  },
  {
    comment: "吸顶导航在深色段上的半透明底 · 演示里亮着的绿点 · 选中文字的底",
    tokens: [
      ["color-nav-glass", "oklch(0.13 0.008 255 / 0.72)"],
      ["color-signal", "oklch(0.72 0.17 150)"],
      ["color-selection", "oklch(0.74 0.17 32 / 0.3)"],
    ],
  },
  {
    comment: "先快后慢，不回弹 · 长镜头的声波来回扫",
    tokens: [
      ["ease-out-quint", "cubic-bezier(0.22, 1, 0.36, 1)"],
      ["ease-out-expo", "cubic-bezier(0.16, 1, 0.3, 1)"],
      ["ease-sweep", "cubic-bezier(0.45, 0, 0.25, 1)"],
    ],
  },
  {
    comment: `字号，按用途起名。固定的七档：没写字号的正文继承 body 的 16px（body）
     lead 17 区块和卡片的引导说明、对话气泡 · secondary 15 次要说明、列表、数据标签 · label 14 小标签、导航、图注
     code 13 命令行 · fine 12 页脚、小徽标 · micro 11 · heading 18 卡片标题
     label、fine、heading 原来是 Tailwind 的 text-sm、xs、lg，行高照它们原来的带上；其余原来是任意值、不带行高`,
    tokens: [
      ["text-body", "1rem"],
      ["text-lead", "1.0625rem"],
      ["text-secondary", "0.9375rem"],
      ["text-label", "0.875rem"],
      ["text-label--line-height", "calc(1.25 / 0.875)"],
      ["text-code", "0.8125rem"],
      ["text-code-wide", "0.875rem"],
      ["text-fine", "0.75rem"],
      ["text-fine--line-height", "calc(1 / 0.75)"],
      ["text-micro", "11px"],
      ["text-heading", "1.125rem"],
      ["text-heading--line-height", "calc(1.75 / 1.125)"],
    ],
  },
  {
    comment: `流体的字号：clamp(手机, 视口宽度, 宽屏)。
     hero 首屏标题 · closing 收尾的下载标题 · section 区块标题（Section.jsx 的 Heading）· section-center 居中的区块标题
     statement 隐私一段的大字 · title 卡片里的大标题 · card-title 三项功能卡的标题 · subhead 标题下面那句话
     price 费用 · stat 速度的大数字 · stat-sm 速度的次一级数字`,
    tokens: [
      ["text-hero", fluid("2.5rem", 6.5, "4.75rem")],
      ["text-closing", fluid("2.75rem", 7, "5rem")],
      ["text-section", fluid("2.125rem", 4.6, "3.75rem")],
      ["text-section-center", fluid("2.4rem", 6, "4.5rem")],
      ["text-statement", fluid("2rem", 4, "3rem")],
      ["text-title", fluid("1.5rem", 2.6, "2rem")],
      ["text-card-title", fluid("1.25rem", 2, "1.5rem")],
      ["text-subhead", fluid("1.125rem", 1.9, "1.375rem")],
      ["text-price", fluid("2.5rem", 5, "3.5rem")],
      ["text-stat", fluid("5rem", 12, "8.5rem")],
      ["text-stat-sm", fluid("2.25rem", 4.4, "3.25rem")],
    ],
  },
  {
    comment: "大标题的字重：苹方最粗到 Semibold，英文的 SF Pro 是可变字体、650 介于 Semibold 和 Bold 之间",
    tokens: [["font-weight-display", "650"]],
  },
  {
    comment: "字距：大标题英文收紧、中文只收一点（中文字距本来就匀）；数字和标题各一档",
    tokens: [
      ["tracking-display", "-0.035em"],
      ["tracking-display-zh", "-0.01em"],
      ["tracking-stat", "-0.03em"],
      ["tracking-figure", "-0.025em"],
      ["tracking-title", "-0.02em"],
      ["tracking-card-title", "-0.015em"],
      ["tracking-brand", "-0.01em"],
    ],
  },
  {
    comment: "行高：大标题英文、中文各一档 · 大数字 · 终端里的代码",
    tokens: [
      ["leading-display", "1.04"],
      ["leading-display-zh", "1.12"],
      ["leading-figure", "1.25"],
      ["leading-code", "1.7"],
    ],
  },
  {
    comment: `圆角：control 8 · block 12 · card 16 和 App 同一套（src/design/base.mjs）；
     small 6 对话气泡的尖角、焦点框 · tile 20 卡片、对话气泡、终端窗口、演示的悬浮条 · panel 24 · stage 28 演示的大面板`,
    tokens: [
      ["radius-small", "6px"],
      ["radius-control", RADIUS.control],
      ["radius-block", RADIUS.block],
      ["radius-card", RADIUS.card],
      ["radius-tile", "1.25rem"],
      ["radius-panel", "1.5rem"],
      ["radius-stage", "1.75rem"],
    ],
  },
  {
    comment: `阴影：line 一圈细线 · inset-line 往里的一圈细线 · underline 底下一道细线 · key 键帽（细线加底边）
     card 浮起的卡片 · window 截图的窗口 · bar-edge、bar 演示的悬浮条（照 App 的悬浮条）· drop-shadow-float 首屏图标`,
    tokens: [
      ["shadow-line", "0 0 0 1px var(--color-line)"],
      ["shadow-inset-line", "inset 0 0 0 1px var(--color-line)"],
      ["shadow-underline", "0 1px 0 var(--color-line)"],
      ["shadow-key", "0 0 0 1px var(--color-line), 0 1.5px 0 var(--color-line)"],
      ["shadow-card", "0 0 0 1px var(--color-line), 0 24px 60px -28px oklch(0 0 0 / 0.35)"],
      ["shadow-window", "0 0 0 1px oklch(0 0 0 / 0.06), 0 40px 80px -40px oklch(0.2 0.03 255 / 0.55)"],
      ["shadow-bar-edge", "0 0 0 1px var(--color-bar-edge)"],
      ["shadow-bar", "0 0 0 1px var(--color-bar-edge), 0 6px 18px oklch(0 0 0 / 0.3), 0 2px 5px oklch(0 0 0 / 0.2)"],
      ["drop-shadow-float", "0 14px 24px oklch(0 0 0 / 0.28)"],
    ],
  },
  {
    comment: `间距的基数照 Tailwind 默认的 0.25rem（和 App 的 4px 一致）。下面是流体的留白，clamp(手机, 视口宽度, 宽屏)：
     section 区块上下 · hero-top、hero-bottom 首屏上下 · heading-gap 区块标题和内容之间 · intro-gap 功能一段的底边
     card-y 语音方式卡片的上下内边距 · logo-gap 厂商标志之间
     flow-1 到 flow-8 是各段里块与块之间的间隔，由小到大（第二步再并档）`,
    tokens: [
      ["spacing-section", fluid("7rem", 17, "13rem")],
      ["spacing-hero-top", fluid("7rem", 13, "9.5rem")],
      ["spacing-hero-bottom", fluid("8rem", 15, "11rem")],
      ["spacing-heading-gap", fluid("0.75rem", 2, "1.75rem")],
      ["spacing-intro-gap", fluid("2rem", 6, "4rem")],
      ["spacing-card-y", fluid("2.5rem", 5, "3.5rem")],
      ["spacing-logo-gap", fluid("2.5rem", 5, "4.5rem")],
      ["spacing-flow-1", fluid("2rem", 5, "3.5rem")],
      ["spacing-flow-2", fluid("3rem", 7, "5rem")],
      ["spacing-flow-3", fluid("3.5rem", 8, "5.5rem")],
      ["spacing-flow-4", fluid("3.5rem", 8, "6rem")],
      ["spacing-flow-5", fluid("4rem", 9, "6.5rem")],
      ["spacing-flow-6", fluid("4rem", 9, "7rem")],
      ["spacing-flow-7", fluid("4.5rem", 10, "7.5rem")],
      ["spacing-flow-8", fluid("5rem", 12, "9rem")],
    ],
  },
];

/** 深色：只换颜色。写在 @theme 外面（@theme 里不能套媒体查询） */
export const SITE_DARK = [
  {
    tokens: [
      ["color-canvas", "oklch(0.15 0.012 255)"],
      ["color-surface", "oklch(0.19 0.014 255)"],
      ["color-raised", "oklch(0.22 0.015 255)"],
      ["color-ink", "oklch(0.96 0.005 255)"],
      ["color-ink-2", "oklch(0.74 0.015 255)"],
      ["color-line", "oklch(0.3 0.015 255)"],
      ["color-link", "oklch(0.8 0.09 255)"],
    ],
  },
];

/** 固定深色的那一段（隐私）：里面的组件照样用 text-ink 这些，颜色在这里换掉 */
export const SITE_TONE_INK = [
  {
    tokens: [
      ["color-canvas", "oklch(0.13 0.008 255)"],
      ["color-surface", "oklch(1 0 0 / 0.06)"],
      ["color-raised", "oklch(1 0 0 / 0.08)"],
      ["color-ink", "oklch(0.97 0.004 255)"],
      ["color-ink-2", "oklch(0.78 0.02 255)"],
      ["color-line", "oklch(1 0 0 / 0.14)"],
      ["color-link", "oklch(0.82 0.09 230)"],
    ],
  },
  {
    comment: "印章色在近黑上要提亮，不然勾看不见",
    tokens: [["color-seal", "oklch(0.8 0.07 255)"]],
  },
];

/** 对比度检查用的配对（src/themes/contract.mjs 的 groupProblems）：字 4.5，只查不透明的颜色 */
export const SITE_LEGIBILITY = [
  ["ink", "canvas", 4.5],
  ["ink", "surface", 4.5],
  ["ink", "raised", 4.5],
  ["ink2", "canvas", 4.5],
  ["ink2", "surface", 4.5],
  ["link", "canvas", 4.5],
];
