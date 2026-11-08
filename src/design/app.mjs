// App（悬浮条、主窗口、引导、划词卡片、搬家窗口）不随主题变的 token：字、间距、控件尺寸、圆角、阴影、动效。
// 颜色不在这里：那是主题的事（src/themes），由预加载脚本赶在页面画出来之前注入。
// 生成 src/renderer/shared/tokens.css（npm run tokens）。一组一段注释，照原样写进生成的文件。

import { RADIUS, SPACE_UNIT } from "./base.mjs";

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

export const APP_HEADER = `三个页面共用、不随主题变的 token：字、间距、控件尺寸、圆角、动效。
   颜色不在这里：那是主题的事（src/themes），由预加载脚本赶在页面画出来之前注入。`;
