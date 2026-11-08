import seal from "../../../assets/icon.svg";
import { DownloadButtons } from "../components/DownloadButtons.jsx";
import { Shot } from "../components/Shot.jsx";
import { shot } from "../config.js";
import { useI18n } from "../i18n/index.jsx";

/**
 * 首屏：图标、口号一行、副标题一行、下载，一张主窗口的图（跟着系统深浅换），说话时的悬浮条浮在窗口正下方。
 * 口号和副标题各只占一行（窄屏才折），不再两行大字压两行小字地往下摞
 */
export function Hero() {
  const { m, locale } = useI18n();
  // 主窗口的图是靛青主题（README 那批），悬浮条也用靛青的
  const bar = shot("bar-indigo", locale);

  return (
    <section id="top" className="overflow-clip bg-canvas text-ink" aria-labelledby="hero-title">
      <div className="mx-auto flex max-w-6xl flex-col items-center px-5 pt-hero-top text-center sm:px-8">
        <img src={seal} alt="" width="80" height="80" className="rise size-[clamp(4rem,7vw,5rem)]" />
        <h1 id="hero-title" className="display rise mt-8 text-hero break-keep" style={{ "--d": "80ms" }}>
          {m.hero.title}
        </h1>
        <p
          className="rise mt-5 text-subhead leading-snug font-medium text-balance break-keep text-ink-2"
          style={{ "--d": "160ms" }}
        >
          {m.hero.lead}
        </p>
        <DownloadButtons className="rise mt-10" style={{ "--d": "240ms" }} />
      </div>

      <div className="rise mx-auto mt-flow-3 max-w-5xl px-5 pb-hero-bottom sm:px-8" style={{ "--d": "420ms" }}>
        <div className="relative">
          <Shot name="home" dark="home-dark" alt={m.hero.shotAlt} loading="eager" fetchPriority="high" />
          {/* 说话时那条悬浮条：在窗口正下方，像说话时它浮在桌面上 */}
          <img
            src={bar.src}
            width={bar.width}
            height={bar.height}
            alt={m.hero.barAlt}
            className="absolute bottom-0 left-1/2 w-[clamp(10rem,24vw,14.5rem)] -translate-x-1/2 translate-y-[calc(100%-0.5rem)] drop-shadow-float"
          />
        </div>
      </div>
    </section>
  );
}
