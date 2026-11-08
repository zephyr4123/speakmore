// 官网和 App 共用的设计取值。只放两边现在值完全相同的：两边不同的记在 README.md 的差异清单里，
// 第二步裁决一项、挪进来一项，不为了"共用"硬塞两组值。纯数据，不依赖 Electron、浏览器或 Node。

/** 间距的基数：两边的间距都是它的整数倍（App 的 --space-*，官网 Tailwind 的 --spacing） */
export const SPACE_UNIT = "0.25rem";

/** 圆角三档：控件 8 · 区块 12 · 卡片 16。App 的 --radius-*；官网原来用 Tailwind 默认的 rounded-lg、xl、2xl，值相同 */
export const RADIUS = Object.freeze({
  control: "8px",
  block: "12px",
  card: "1rem",
});

/** 悬浮条浮起来的那两层投影。App 的悬浮条（--shadow-bar）和官网照着它画的演示条（shadow-bar）用同一组 */
export const BAR_DROP = "0 6px 18px oklch(0 0 0 / 0.3), 0 2px 5px oklch(0 0 0 / 0.2)";

// 字体：正文、标题各一份。Mac 上 -apple-system 自己按字号在 SF Pro Text 和 Display 之间切换，不用写名字
// （"SF Pro Text" 这类名字一般的 Mac 上没装）；Windows 上 Segoe UI Variable 的 Text 和 Display 是两个字体名，
// 大标题要点名 Display。中文：苹方，老的 macOS 退到冬青黑；Windows 用雅黑的 UI 版（行距按界面调过）
const CJK_MAC = '"PingFang SC", "Hiragino Sans GB"';
const CJK_WIN = '"Segoe UI", "Microsoft YaHei UI", system-ui, sans-serif';

/** 正文：段落、按钮、列表 */
export const FONT_TEXT = `-apple-system, BlinkMacSystemFont, ${CJK_MAC}, "Segoe UI Variable Text", ${CJK_WIN}`;

/** 标题：28px 以上的大字 */
export const FONT_DISPLAY = `-apple-system, BlinkMacSystemFont, ${CJK_MAC}, "Segoe UI Variable Display", ${CJK_WIN}`;

/** 大号的数字用系统的圆体（SF Pro Rounded），和正文的直角字拉开一点；没有圆体的系统照标题的来 */
export const FONT_ROUNDED = `ui-rounded, ${FONT_DISPLAY}`;

export const FONT_MONO = 'ui-monospace, "SF Mono", Menlo, "Cascadia Mono", Consolas, monospace';

/** 基础的缓动：先快后慢，不回弹。App 的 --ease-out、官网的 ease-out 同一条 */
export const EASE_OUT = "cubic-bezier(0.25, 1, 0.5, 1)";
