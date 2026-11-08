import { useEffect, useRef, useState } from "react";
import seal from "../../../assets/icon.svg";
import { links } from "../config.js";
import { useI18n } from "../i18n/index.jsx";
import { Icon } from "../icons/Icon.jsx";

/**
 * 吸顶导航。停在页面顶上时是透明的；往下滚了换成半透明的毛玻璃，经过深色的段落时玻璃也是深色。
 * 窄屏：标志、GitHub 和下载一行，各段的锚点另起一行、横着滑（整页十几屏，没有锚点只能一直往下滚）。换语言在页脚
 */
export function Nav() {
  const { m } = useI18n();
  // 三种样子：停在页面顶上是透明的；滚到深色的段落（性能）上是深色毛玻璃；别处是跟着系统的毛玻璃
  const [look, setLook] = useState("clear");
  const header = useRef(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      if (window.scrollY <= 24) return setLook("clear");
      // 导航正下方是哪一段：窄屏多一行锚点，导航有多高按实际量
      const bottom = header.current?.getBoundingClientRect().bottom ?? 0;
      const below = document.elementFromPoint(window.innerWidth / 2, bottom + 8)?.closest("section");
      setLook(below?.matches(".tone-ink") ? "dark" : "glass");
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  // 和页面上的先后一样。识别方式和模型隔开放：英文的 Modes、Models 长得像，挨着容易看错
  const items = [
    ["trio", m.nav.trio],
    ["ways", m.nav.ways],
    ["speed", m.nav.speed],
    ["models", m.nav.models],
    ["privacy", m.nav.privacy],
    ["developers", m.nav.developers],
  ];
  const anchors = items.map(([id, label]) => (
    <li key={id} className="shrink-0">
      <a
        href={`#${id}`}
        className="inline-flex h-nav-anchors items-center transition-colors duration-150 hover:text-ink"
      >
        {label}
      </a>
    </li>
  ));

  return (
    <header
      ref={header}
      className={`fixed inset-x-0 top-0 z-30 text-ink transition-[background-color,box-shadow] duration-300 ${
        {
          clear: "bg-transparent",
          dark: "tone-ink bg-nav-glass! shadow-underline backdrop-blur-xl backdrop-saturate-150",
          glass: "bg-canvas/72 shadow-underline backdrop-blur-xl backdrop-saturate-150",
        }[look]
      }`}
    >
      <nav className="mx-auto flex h-nav max-w-6xl items-center gap-6 px-5 sm:px-8">
        <a
          href="#top"
          className="flex items-center gap-2.5 font-display text-body font-semibold tracking-brand"
          aria-label={m.nav.home}
        >
          <img src={seal} alt="" width="28" height="28" className="size-7" />
          SpeakMore
        </a>
        <ul className="ml-auto hidden items-center gap-7 text-label text-ink-2 md:flex">{anchors}</ul>
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <a
            href={links.repository}
            aria-label={m.nav.github}
            className="grid size-9 place-items-center rounded-full text-ink-2 transition-colors duration-150 hover:bg-surface hover:text-ink"
          >
            <Icon name="github" className="size-5" />
          </a>
          <a
            href="#download"
            className="ml-1.5 inline-flex h-8 items-center rounded-full bg-ink px-3.5 text-label font-semibold text-canvas transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.97]"
          >
            {m.nav.download}
          </a>
        </div>
      </nav>
      <ul className="no-scrollbar flex h-nav-anchors gap-6 overflow-x-auto px-5 text-label whitespace-nowrap text-ink-2 sm:px-8 md:hidden">
        {anchors}
      </ul>
    </header>
  );
}
