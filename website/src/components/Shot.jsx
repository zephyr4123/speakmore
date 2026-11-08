import { readme } from "../config.js";
import { useI18n } from "../i18n/index.jsx";

/** README 那批图四周给阴影留的边（CSS 像素）：窗口截图是 readme-media.mjs 的 40 */
const PAD = 40;
/** 截图的局部、划词的实拍四周留的边：readme-scenes.mjs 的 photo 加圆角和阴影时留的 28 */
export const PHOTO_PAD = 28;

/**
 * README 那批截图之一：真窗口截图（Mac 窗口的外框和阴影都画在图里），或者截图的一块局部（圆角和阴影也画在图里），这里不再套框。
 * 图四周留着给阴影的边：往外撑出去，让图本身的左右边和这一栏对齐（styles.css 的 .shot 按下面几个比例算）。
 * dark：系统是深色时换成的那一张（同样大小）；small：窄屏换成的那一张，裁得更紧，手机上字不至于太小；
 * pad：图四周留的边，默认窗口截图的 40；flush：上下留的边也往外撑（宽高比不同的两张并排，看得见的上下边会差几像素）。
 * dark 和 small 不能一起用：窄屏那张排在前面，窄屏加深色时拿到的会是浅色的窄图
 */
export function Shot({
  name,
  dark,
  small,
  alt,
  pad = PAD,
  flush = false,
  className = "",
  loading = "lazy",
  fetchPriority,
}) {
  const { locale } = useI18n();
  const light = readme(name, locale);
  const night = dark ? readme(dark, locale) : null;
  const narrow = small ? readme(small, locale) : null;
  // 整张图比图本身宽多少倍、每边留的边占图本身的多少
  const ratios = ({ width }) => ({ scale: width / (width - pad * 2), edge: pad / (width - pad * 2) });
  const wide = ratios(light);
  const tight = narrow ? ratios(narrow) : wide;
  return (
    <picture
      className={`shot block ${className}`}
      data-flush={flush ? "" : undefined}
      style={{
        "--shot-scale": wide.scale,
        "--shot-edge": wide.edge,
        "--shot-scale-sm": tight.scale,
        "--shot-edge-sm": tight.edge,
      }}
    >
      {/* 宽高写在 source 上：窄屏那张宽高比不同，图到之前占的位置也按它算，加载完不跳 */}
      {narrow ? (
        <source media="(width < 48rem)" srcSet={narrow.src} width={narrow.width} height={narrow.height} />
      ) : null}
      {night ? <source media="(prefers-color-scheme: dark)" srcSet={night.src} /> : null}
      <img
        src={light.src}
        width={light.width}
        height={light.height}
        alt={alt}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding="async"
        className="block h-auto w-full"
      />
    </picture>
  );
}
