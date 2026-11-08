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
