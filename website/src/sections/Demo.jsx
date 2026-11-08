import { useRef, useState } from "react";
import { Bar } from "../components/Bar.jsx";
import { Heading, Section } from "../components/Section.jsx";
import { Spoken } from "../components/Spoken.jsx";
import { useI18n } from "../i18n/index.jsx";
import { useDictation } from "../lib/useDictation.js";
import { useOnScreen, useReducedMotion } from "../lib/usePageMotion.js";

/**
 * 语音输入：左边是口述（边说边出现），右边是写出来的成品。口头禅、重复、改口在口述里一段接一段淡出、虚掉，不划线。
 * 例子都是 App 的真实输出（合成语音口述给 Gemini 3.6 Flash）
 */
export function Demo() {
  const { m } = useI18n();
  const examples = m.demo.examples;
  const [index, setIndex] = useState(0);
  const root = useRef(null);
  const onScreen = useOnScreen(root);
  const reduced = useReducedMotion();
  const { progress, bar, written, phase } = useDictation(onScreen && !reduced, index, () =>
    setIndex((i) => (i + 1) % examples.length),
  );
  const example = examples[index];

  return (
    <Section id="demo" labelledBy="demo-title">
      <Heading id="demo-title" title={m.demo.title} />

      <div ref={root} className="reveal mt-flow-2">
        <div className="mb-6 flex gap-1.5" role="tablist">
          {examples.map((item, i) => (
            <button
              key={item.label}
              type="button"
              role="tab"
              aria-selected={i === index}
              onClick={() => setIndex(i)}
              className={`h-8 cursor-pointer rounded-full px-4 text-label font-medium transition-colors duration-200 ${
                i === index ? "bg-ink text-canvas" : "text-ink-2 hover:bg-surface hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid items-stretch gap-4 md:grid-cols-2 md:gap-6">
          <div className="relative flex min-h-[17rem] flex-col rounded-stage bg-surface p-7 sm:p-9">
            <p className="text-label font-medium text-ink-2">{m.demo.said}</p>
            <Spoken
              text={example.said}
              reserve={examples.map((item) => item.said)}
              progress={progress}
              written={written}
              talking={phase === "talk"}
              className="mt-4 text-subhead leading-relaxed text-ink-2"
            />
            <div className="mt-auto flex justify-center pt-8">
              <Bar state={bar} />
            </div>
          </div>

          <div className="relative flex min-h-[17rem] flex-col rounded-stage bg-raised p-7 shadow-card sm:p-9">
            <p className="text-label font-medium text-ink-2">{m.demo.written}</p>
            {/* 几个例子的成品叠在同一格里占位，按最高的那个撑开：换例子、成品出来时都不把整页往下推 */}
            <div className="mt-4 grid text-subhead leading-relaxed whitespace-pre-line">
              {examples.map((item) => (
                <p key={item.label} className="invisible col-start-1 row-start-1" aria-hidden="true">
                  {item.written}
                </p>
              ))}
              <p
                key={`${index}-${written}`}
                className={`col-start-1 row-start-1 text-ink ${
                  // token-exempt: 演示里新写出来的字淡入，这段编排只这里用
                  written ? "motion-safe:animate-[fade-in_600ms_var(--ease-out)]" : "opacity-0"
                }`}
              >
                {example.written}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
