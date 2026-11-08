import { useRef } from "react";
import { Heading, Section } from "../components/Section.jsx";
import { Shot } from "../components/Shot.jsx";
import { useI18n } from "../i18n/index.jsx";
import { Icon } from "../icons/Icon.jsx";
import { fillText } from "../lib/text.js";

/** 首次引导的四步截图和最后弹出的推荐组合（README 那批），和文案里 setup.steps 一一对应 */
const SHOTS = ["onboarding-features", "onboarding-keys", "onboarding-permissions", "onboarding-engine", "presets"];
/** 推荐组合是引导走完以后在主窗口弹出来的，不算引导的一步：不编号，写"引导之后"（标题说的是四步） */
const AFTER = "presets";

/** 这一段内容的左边离屏幕边多远：内容最宽 72rem（max-w-6xl），两边留 1.25rem，宽屏 2rem */
const GUTTER = "max(1.25rem, calc((100vw - 72rem) / 2 + 2rem))";

/**
 * 首次引导：几步截图横着排，左右滑（触控板、手指）或点箭头一张一张翻，每张停在左边对齐。
 * 这里的序号是真的先后，所以标出来
 */
export function Setup() {
  const { m } = useI18n();
  const track = useRef(null);
  const page = (direction) => {
    const element = track.current;
    const item = element?.querySelector("li");
    if (!element || !item) return;
    const gap = Number.parseFloat(getComputedStyle(element).columnGap) || 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollBy({ left: direction * (item.offsetWidth + gap), behavior: reduced ? "auto" : "smooth" });
  };
  // 底色和上面的隐私一段（surface）错开：整页靠深浅交替分段，连着两段同色中间没有分界
  return (
    <Section id="setup" labelledBy="setup-title">
      <Heading id="setup-title" title={m.setup.title} />

      <div className="reveal mt-flow-2">
        {/* 这一排撑满整个页面宽：左边和这一段的内容对齐，右边一直延伸到屏幕边上，看得出还能往右滑 */}
        <ol
          ref={track}
          // token-exempt: 撑满整个页面宽：从内容栏伸到屏幕两边
          className="no-scrollbar mx-[calc(50%-50vw)] flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4"
          style={{ paddingInline: GUTTER, scrollPaddingInline: GUTTER }}
        >
          {SHOTS.map((name, index) => {
            const step = m.setup.steps[index];
            const after = name === AFTER;
            return (
              <li key={name} className="w-[min(82vw,34rem)] shrink-0 snap-start">
                <Shot
                  name={name}
                  alt={after ? fillText(m.setup.afterAlt, { step }) : fillText(m.setup.alt, { n: index + 1, step })}
                />
                <p className="mt-3 flex items-baseline gap-3">
                  <span className="font-rounded text-label font-semibold text-ink-2 tabular-nums">
                    {after ? m.setup.after : String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="font-medium text-ink">{step}</span>
                </p>
              </li>
            );
          })}
        </ol>
        <div className="mt-6 flex justify-end gap-2">
          {[
            { direction: -1, icon: "arrowLeft", label: m.setup.previous },
            { direction: 1, icon: "arrowRight", label: m.setup.next },
          ].map(({ direction, icon, label }) => (
            <button
              key={icon}
              type="button"
              onClick={() => page(direction)}
              aria-label={label}
              className="grid size-11 cursor-pointer place-items-center rounded-full text-ink shadow-inset-line transition-colors duration-150 hover:bg-surface"
            >
              <Icon name={icon} className="size-5" />
            </button>
          ))}
        </div>
      </div>
    </Section>
  );
}
