import { useRef } from "react";
import { Rolling } from "../components/Rolling.jsx";
import { Heading, Section } from "../components/Section.jsx";
import { useI18n } from "../i18n/index.jsx";
import { Icon } from "../icons/Icon.jsx";
import { useEnterOnce, useOnScreen } from "../lib/usePageMotion.js";

/**
 * 性能：近黑的一段（和首屏、各段的白拉开）。上面一行：左边一个大数（主流硬件上松开到出字不到 2 秒），
 * 右边一张硬件表（处理器、显卡各三家，全都能跑）；下面一行：两个小数和一条近三分钟的录音波形。
 * 两行用同一套左右分栏，上下对齐。不只讲显卡：很多电脑只有处理器，照样能用。
 * 数字都是实测（README 的评测一节、bench/results/），页面上不写出处
 */
export function Speed() {
  const { m } = useI18n();
  const text = m.speed;
  const headline = useEnterOnce();
  // 这一行在段落下边，常停在屏幕下沿：露头就转，不然停在那儿的访客看到的是一排 0
  const stats = useEnterOnce("-8%");
  return (
    <Section id="speed" tone="ink" labelledBy="speed-title">
      <Heading id="speed-title" title={text.title} />

      <div className="reveal mt-flow-2 grid gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center">
        <dl ref={headline.ref} data-roll={headline.stage}>
          <dt className="text-subhead font-semibold text-ink">{text.headline.label}</dt>
          <dd className="mt-3 font-rounded text-stat leading-none font-semibold tracking-stat text-ink">
            {/* token-exempt: 单位、符号按旁边大数字的字号成比例缩小 */}
            <span className="mr-1 text-[0.55em] font-medium text-ink-2">{text.headline.prefix}</span>
            <Rolling value={text.headline.value} />
            {/* token-exempt: 单位、符号按旁边大数字的字号成比例缩小 */}
            <span className="ml-2 text-[0.32em] font-medium tracking-normal text-ink-2">{text.headline.unit}</span>
          </dd>
          <dd className="mt-2 text-heading text-ink-2">{text.headline.text}</dd>
        </dl>
        <Hardware text={text.hardware} />
      </div>

      <div className="reveal mt-flow-2 grid gap-x-16 gap-y-12 border-t border-line pt-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <dl ref={stats.ref} data-roll={stats.stage} className="grid grid-cols-2 gap-x-8">
          {text.stats.map((stat) => (
            // 数字在上、说明在下（dt 得写在前面，所以倒过来排）；在哪类硬件上测的另起一行
            <div key={stat.label} className="flex flex-col-reverse justify-end gap-2">
              <dt className="text-secondary leading-snug text-ink-2">
                {stat.label}
                {stat.note ? <span className="block">{stat.note}</span> : null}
              </dt>
              <dd className="font-rounded text-stat-sm leading-figure font-semibold tracking-figure whitespace-nowrap text-ink">
                <Rolling value={stat.value} />
                {/* token-exempt: 单位、符号按旁边大数字的字号成比例缩小 */}
                <span className="ml-1.5 text-[0.45em] font-medium tracking-normal text-ink-2">{stat.unit}</span>
              </dd>
            </div>
          ))}
        </dl>
        <LongTake text={text.long} />
      </div>
    </Section>
  );
}

/** 各家标志按高度排：字标扁、图形标高，各给一个高度，看起来一样重（宽度跟着裁好的图标比例走） */
const MARK = {
  apple: "h-[1.875rem]",
  nvidia: "h-[1.625rem]",
  amd: "h-[0.8rem] sm:h-[0.875rem]",
  intel: "h-[1.3rem]",
};

/**
 * 支持的硬件：处理器、显卡两行，每家一格（标志和型号系列），每格右上角一个勾。
 * 滚到时一格接一格亮起来、打上勾，像在逐个认出这台电脑的硬件
 */
function Hardware({ text }) {
  const { ref, stage } = useEnterOnce();
  return (
    <section ref={ref} data-stage={stage} className="hardware overflow-clip rounded-panel border border-line">
      <h3 className="sr-only">{text.label}</h3>
      {text.groups.map((group, row) => (
        <div key={group.id} className="grid border-line sm:grid-cols-[8rem_minmax(0,1fr)] [&+&]:border-t">
          <div className="flex items-baseline justify-between gap-3 px-4 pt-5 pb-1 sm:flex-col sm:justify-center sm:gap-1 sm:border-r sm:border-line sm:p-6">
            <h4 className="font-semibold text-ink">{group.name}</h4>
            <p className="text-label text-ink-2">{group.note}</p>
          </div>
          <ul className="grid grid-cols-3">
            {group.items.map((item, column) => (
              <li
                key={item.icon}
                className="hardware-cell relative flex h-[7rem] flex-col justify-between border-line p-4 sm:h-[8rem] sm:p-6 [&+&]:border-l"
                style={{ "--i": row * group.items.length + column }}
              >
                <span className="flex h-7 items-center">
                  <Icon name={item.icon} className={`w-auto ${MARK[item.icon]}`} />
                </span>
                <p className="text-secondary leading-snug text-ink">
                  <span className="sr-only">{item.brand} </span>
                  {item.series}
                </p>
                <span className="hardware-check absolute top-3.5 right-3 grid size-4 place-items-center rounded-full bg-seal text-canvas sm:top-5 sm:right-5 sm:size-5">
                  <Icon name="check" className="size-3 sm:size-3.5" />
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/** 一段近三分钟的口述画成波形：有起伏、有停顿。固定的一串，每次都一样（不用随机数，免得每次构建不同） */
const BARS = Array.from({ length: 132 }, (_, i) => {
  const phrase = Math.sin(i * 0.19) * 0.5 + Math.sin(i * 0.071 + 1.3) * 0.35;
  const syllable = Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.83));
  const pause = i % 29 > 25 ? 0.15 : 1;
  return Math.max(0.08, Math.min(1, (0.35 + phrase * 0.3 + syllable * 0.55) * pause));
});

/** 长录音：波形从左往右亮起来，走到头说完整成文。不在屏幕上时不走；减弱动态效果时直接是亮的 */
function LongTake({ text }) {
  const ref = useRef(null);
  const seen = useOnScreen(ref);
  return (
    <div ref={ref}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h3 className="text-lead font-semibold text-ink">{text.title}</h3>
        <p className="text-secondary text-ink-2">{text.text}</p>
      </div>
      <div aria-hidden="true" className="mt-5">
        <div className="long-take" data-play={seen ? "" : undefined}>
          {[0, 1].map((layer) => (
            <div key={layer} className="long-take-bars">
              {BARS.map((height, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: 波形是固定的一串
                <i key={index} style={{ height: `${height * 100}%` }} />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-2.5 flex justify-between font-rounded text-label text-ink-2 tabular-nums">
          <span>{text.start}</span>
          <span>{text.end}</span>
        </div>
      </div>
    </div>
  );
}
