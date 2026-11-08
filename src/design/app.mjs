// App（悬浮条、主窗口、引导、划词卡片、搬家窗口）不随主题变的 token：字、间距、控件尺寸、圆角、阴影、动效。
// 颜色不在这里：那是主题的事（src/themes），由预加载脚本赶在页面画出来之前注入。
// 生成 src/renderer/shared/tokens.css（npm run tokens）。一组一段注释，照原样写进生成的文件。

import { BAR_DROP, RADIUS, SPACE_UNIT } from "./base.mjs";

const unit = Number.parseFloat(SPACE_UNIT);
const space = (n) => `${n * unit}rem`;

/** @type {{ comment: string, tokens: [string, string][] }[]} */
export const APP_TOKENS = [
  {
    comment: "",
    tokens: [
      [
        "font",
        '-apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI Variable Text", "Segoe UI", "Microsoft YaHei UI", system-ui, sans-serif',
      ],
      ["font-mono", 'ui-monospace, "SF Mono", Menlo, "Cascadia Mono", Consolas, monospace'],
    ],
  },
  {
    comment: "大号的数字用系统的圆体（SF Pro Rounded），和正文的直角字拉开一点",
    tokens: [
      [
        "font-rounded",
        'ui-rounded, -apple-system, "PingFang SC", "Segoe UI Variable Display", "Segoe UI", "Microsoft YaHei UI", system-ui, sans-serif',
      ],
    ],
  },
  {
    comment: `字的层级：一种字体，靠字号、字重、颜色三样一起拉开。各处只用这七档字号、四档字重，样式里不写别的数：
     12、14 这种夹在两档中间的字号会让名字、说明、标签看起来一样大，层级就糊了。
     40 页面大标题 · 28 首页的大数字 · 22 对话框每页的标题、次一级的大数字 · 18 区块标题
     15 正文：列表里的名字、设置项、导航 · 13 说明、状态、按钮、输入框、表格 · 11 标签、单位、刻度、脚注、键名`,
    tokens: [
      ["text-display", "2.5rem"],
      ["text-figure", "1.75rem"],
      ["text-title", "1.375rem"],
      ["text-heading", "1.125rem"],
      ["text-body", "0.9375rem"],
      ["text-small", "0.8125rem"],
      ["text-micro", "0.6875rem"],
    ],
  },
  {
    comment: "正文 400；按钮、导航、标签 500；名字、区块标题、数值 600；页面和对话框的标题 700",
    tokens: [
      ["weight-regular", "400"],
      ["weight-medium", "500"],
      ["weight-semibold", "600"],
      ["weight-bold", "700"],
    ],
  },
  {
    comment: "间距：4、8、12、16、24、32、48",
    tokens: [1, 2, 3, 4, 6, 8, 12].map((n) => [`space-${n}`, space(n)]),
  },
  {
    comment: `控件高度三档（界面规范 v1）：28 胶囊、徽标、分段里的项 · 32 按钮、输入框、分段控件 · 40 搜索框、分类标签。
     同一行里的控件同一档，长短不一的字也不会把按钮撑得参差`,
    tokens: [
      ["control-sm", "1.75rem"],
      ["control-md", "2rem"],
      ["control-lg", "2.5rem"],
    ],
  },
  {
    comment: "圆角四档：控件 8 · 区块 12 · 卡片 16 · 胶囊",
    tokens: [
      ["radius-control", RADIUS.control],
      ["radius-block", RADIUS.block],
      ["radius-card", RADIUS.card],
      ["radius-full", "999px"],
    ],
  },
  {
    comment: `阴影，从低到高：control 键帽、品牌图标的底座 · selected 侧栏、分段控件里选中的那一项 · knob 开关的圆钮
     lift 浮在光上的卡片（深色另有一份，见下面的 :root 深色段）· popover 下拉、菜单 · dialog 对话框、设置
     card 划词卡片（窗口只比卡片大一圈，影子不能更长）· scene 引导里画的那扇窗 · bar、bar-menu 悬浮条和它的菜单。
     popover、dialog、card 只是投影：用的地方前面接 var(--edge)（细线加上沿亮边，跟主题走，在 window.css）`,
    tokens: [
      ["shadow-control", "0 1px 2px oklch(0 0 0 / 0.06)"],
      ["shadow-selected", "0 1px 3px oklch(0 0 0 / 0.08)"],
      ["shadow-knob", "0 1px 2px oklch(0 0 0 / 0.25)"],
      ["lift", "0 1px 2px oklch(0 0 0 / 0.04), 0 10px 30px -12px oklch(0 0 0 / 0.12)"],
      ["shadow-popover", "0 24px 60px -20px oklch(0 0 0 / 0.35)"],
      ["shadow-dialog", "0 30px 80px -24px oklch(0 0 0 / 0.4)"],
      ["shadow-card", "0 12px 28px -10px oklch(0 0 0 / 0.34)"],
      ["shadow-scene", "0 24px 48px -24px oklch(0 0 0 / 0.32)"],
      ["shadow-bar", `0 0 0 1px var(--bar-edge), ${BAR_DROP}`],
      ["shadow-bar-menu", "0 0 0 1px var(--bar-edge), 0 8px 24px oklch(0 0 0 / 0.28)"],
    ],
  },
  {
    comment: "对话框背后压暗的那一层：深浅色都是黑的（用 --ink 的话深色下成了一层白雾）",
    tokens: [["scrim", "oklch(0 0 0 / 0.18)"]],
  },
  {
    comment: "列表里定宽的两列：状态、操作。控件撑满列宽，各行的边缘才对得齐",
    tokens: [
      ["col-status", "6rem"],
      ["col-action", "6rem"],
    ],
  },
  {
    comment: "动效：按下和悬停这类小反馈、状态切换、出现和消失。先快后慢，不回弹",
    tokens: [
      ["dur-fast", "120ms"],
      ["dur-base", "200ms"],
      ["dur-slow", "320ms"],
    ],
  },
  {
    comment: "分类标签的下划线、分段控件的滑块从上一个位置滑过去",
    tokens: [
      ["dur-slide", "280ms"],
      ["ease-out", "cubic-bezier(0.25, 1, 0.5, 1)"],
    ],
  },
];

/** 深色下另给一份的：浮起来的卡片在深底上要更重的影子才看得出 */
export const APP_DARK = [
  {
    tokens: [["lift", "0 1px 2px oklch(0 0 0 / 0.3), 0 12px 32px -12px oklch(0 0 0 / 0.5)"]],
  },
];

export const APP_HEADER = `各页面共用、不随主题变的 token：字、间距、控件尺寸、圆角、阴影、动效。
   颜色不在这里：那是主题的事（src/themes），由预加载脚本赶在页面画出来之前注入。`;
