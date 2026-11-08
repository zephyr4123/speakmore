# 设计 token

官网的字号、颜色、圆角、阴影、字距、行高、间距、动效，App 的字体、字号、字重、间距、控件高度、圆角、阴影、动效，都只在这个目录里写一次，再生成两份 CSS 提交进仓库。App 的字距、行高还写在各个样式里，第二步再定。

| 生成的文件 | 来自 | 谁用 |
|---|---|---|
| `src/renderer/shared/tokens.css` | `app.mjs` | App 的每个页面，排在别的样式前面 |
| `website/src/tokens.css` | `site.mjs` | 官网的 `styles.css` 里 `@import`，Tailwind 按名字生成 `text-lead`、`rounded-tile` 这类工具类 |

`base.mjs` 放两边值完全相同的（间距基数、三档圆角、悬浮条的投影、字体、基础缓动），`css.mjs` 负责把 token 写成 CSS。App 的颜色不在这里，那是主题的事（`src/themes`，由预加载脚本注入）；官网演示用的悬浮条从朱砂主题取色。

## 怎么改

1. 改这里的源，运行 `npm run tokens`。
2. 样式里只引用 token 的名字。官网确实要写死的值，在那一行或上一行写 `token-exempt:` 和理由。

改了源忘了生成、官网绕过 token 写死值、用了不存在的名字、颜色对比度不够，`test/design/tokens.test.mjs` 都会报。App 那边由 `test/renderer/shared/` 和 `test/themes/css-tokens.test.mjs` 把关：字号、字重、控件高度、圆角只能用 token，阴影和压暗用的半透明黑只能出现在 `tokens.css` 里。

## 第一步：只收纳，不改观感

把原来散在官网 JSX、`styles.css` 和 App 样式里的写死值换成按用途起名的 token。只合并肉眼看不出的近似值：同一个界面里，375 和 1280 两种宽度下相差都不超过 2px（阴影的透明度差不超过 0.05），取用得最多的那个值。其余全部照原值搬过来，等第二步再并档。

合并记录（原值 → 新值）：

| 哪里 | 原值 | 新值 | 看得出的变化 |
|---|---|---|---|
| 官网标题下面那句话（`text-subhead`）：首屏、收尾的下载段、演示、速度、翻译 | `clamp(1.0625rem, 1.9vw, 1.375rem)`（首屏）、`clamp(1.0625rem, 1.8vw, 1.375rem)`（下载段）、`clamp(1.125rem, 1.8vw, 1.375rem)`（速度） | `clamp(1.125rem, 1.9vw, 1.375rem)`（原来三处用的就是它） | 手机上首屏和下载段那句话 17 → 18px，页面高出约 6px；宽屏没有变化 |
| 官网翻译段的输入框圆角 | `1.375rem`（22px） | `rounded-tile`（`1.25rem`，20px） | 圆角小 2px |
| 官网悬浮条演示的圆角 | `20px` | `rounded-tile`（`1.25rem`） | 同值，无变化 |
| 官网的一处字距 | `-0.025em` | `tracking-figure` | 同值，无变化 |
| 官网终端里的字 | `0.875rem` | `text-code-wide` | 同值，无变化 |
| App 分段控件里选中的那一项 | `0 1px 3px oklch(0 0 0 / 0.1)` | `--shadow-selected`（`0 1px 3px oklch(0 0 0 / 0.08)`，同侧栏选中项） | 影子淡 0.02 |

顺手删掉的：官网 `Section.jsx` 的 `Heading` 里，给了 `lead` 时右边放一句话的两栏写法，和 `align="center"` 的居中写法，一处都没用到（9 处 `<Heading>` 都只传了 `id`、`title`）；只给居中写法用的 `text-section-center` 也一起删了。原来合并记录里列的区块标题旁那句话 17 → 18px 因此不存在。

验收：官网由另一个会话把分支和 main 各构建一份，浅色、深色 × 1280、375 四组，逐个比对 1377 个元素的 28 项计算样式和盒子尺寸，另加 60 张截图的像素比对。变化只有上表列的两处，其余是内容下移带来的抗锯齿差异。App 用同一台机器、同样的主题和语言，改前改后各拍一套截图比对。

## 第二步：按裁决改观感（2026-11-08 用户选定）

两边不一样的品牌取值，裁决一项、挪进 `base.mjs` 一项：

| 项 | 裁决 | 落在哪 |
|---|---|---|
| 字体栈 | 正文、标题各一份：`-apple-system`、苹方、冬青黑，Windows 上 Segoe UI Variable Text / Display、Microsoft YaHei UI；去掉一般的 Mac 上没装的 SF Pro Text / Display。圆体、等宽也合成一份 | `base.mjs` 的 `FONT_*`；App 的页面标题、引导标题改用标题那份 |
| 缓动 | 基础的一条统一成 `cubic-bezier(0.25, 1, 0.5, 1)`；官网的 expo、sweep 两条留给官网自己的特效 | `base.mjs` 的 `EASE_OUT`；官网的 `ease-out-quint` 改名 `ease-out`，Tailwind 默认的缓动清掉 |
| 朱砂色 | 取 App 朱砂主题的主色：浅色 `oklch(0.56 0.19 32)`，亮的一档是深色的主色 | 官网从 `src/themes/cinnabar.mjs` 读；白字叠朱砂进了对比度检查 |
| 标题字重 | 统一 600：苹方 600 以上渲染都一样，雅黑 600 以上都落到粗体。英文标题会细一点 | App 删掉 `--weight-bold`，字重三档；官网 `font-weight-display` 650 → 600 |
| App 字号 | 12、14、18、22、28、40 六档：11 → 12（Windows 11 常规字重的下限），13 和 15 合成 14，名字靠字重、说明靠颜色分主次 | `--text-small` 并进 `--text-body`；`--text-figure` 改名 `--text-page` |
| 页面标题 | 主窗口四个页面的标题 40 → 28，首页的标题就叫「首页」（和侧栏一样）；引导保持 40 | `.page-title` 用 `--text-page` |
| 中性色 | 不统一：App 的中性色跟着三套主题走，官网偏冷、贴近系统灰 | |

还没定、留着的：

| 项 | 官网 | App |
|---|---|---|
| 大标题 | 流体 11 档（hero、closing、section、statement……） | 固定的 40、28、22 |
| 区块间距 | `flow-1` 到 `flow-8` 八档，相邻的几档只差半个 rem | 4、8、12、16、24、32、48 |
| 圆角 | small 6、control 8、block 12、card 16、tile 20、panel 24、stage 28 | 8、12、16、全圆（前三档已共用） |
| 字距 | 7 档 token（display -0.035em 到 brand -0.01em） | 写在样式里：-0.01em 三处、-0.02em、-0.025em 各一处，还没收进 token |
| 阴影 | 卡片、截图窗口各一档 | control 到 dialog 共 10 档（悬浮条的投影已共用） |
