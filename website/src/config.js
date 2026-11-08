// 站点配置：域名、下载地址、图片地址都在 site.config.json；版本号是构建时从仓库根的 package.json 读的（vite.config.js）。
import readmeMedia from "../../docs/media.json";
import site from "../site.config.json";
import planCosts from "./costs.json";
import { siteLinks } from "./lib/site.js";
import media from "./media.json";

/* global __SPEAKMORE_VERSION__ */
export const links = siteLinks(site, __SPEAKMORE_VERSION__);

/**
 * 一张截图：名字是 scripts/screenshots.mjs 起的（home-light-ink），按语言取对应的那一份
 * @returns {{ src: string, width: number, height: number }}
 */
export function shot(name, locale) {
  const entry = media[`${name}.${locale}`];
  if (!entry) throw new Error(`src/media.json 里没有 ${name}.${locale}：先截图再上传`);
  return { src: links.media(entry.path), width: entry.width, height: entry.height };
}

/**
 * 一张 README 用的图（图片桶的 readme/ 下，清单是仓库的 docs/media.json）：真窗口截图带着 Mac 窗口的外框和阴影，
 * 四周留了 40 像素给阴影；截图裁出来的局部、划词的实拍四周留 28；也有下载速度对比图。宽高是 CSS 像素，文件是两倍图
 * @returns {{ src: string, width: number, height: number }}
 */
export function readme(name, locale) {
  const entry = readmeMedia[`${name}.${locale}`];
  if (!entry)
    throw new Error(`docs/media.json 里没有 ${name}.${locale}：照 docs/development.md 的"README 的图"出图再上传`);
  return { src: links.media(entry.path), width: entry.width, height: entry.height };
}

/** 费用一段两个方案每月多少（每天 100 次），和 App 模型页的推荐组合同一套算法（src/usage/plan-costs.mjs 算好写进 costs.json） */
export const costs = planCosts;
