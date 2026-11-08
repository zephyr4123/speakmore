import { useRef, useState } from "react";
import { Bar } from "../components/Bar.jsx";
import { Heading, Section } from "../components/Section.jsx";
import { Spoken } from "../components/Spoken.jsx";
import { useI18n } from "../i18n/index.jsx";
import { DICTATION_MS, useDictation } from "../lib/useDictation.js";
import { useOnScreen, useReducedMotion } from "../lib/usePageMotion.js";

/** 这一句比语音输入的例子长，说得慢一点；译文落进输入框后多停一会儿 */
const MS = { ...DICTATION_MS, type: 2200, hold: 3400 };

/**
 * 语音翻译：左边是用中文回的那句口述（边说边出现，悬浮条上写着这次译成哪种语言），右边一个群聊窗口，
 * 外国同事发来一句，说完译文直接落进输入框；两块等高、上下边对齐。下面三条要点排一行。
 * 口述和译文是 App 的真实输出，见文案的 translate.chat
 */
export function Translate() {
  const { m } = useI18n();
  const text = m.translate;
  const chat = text.chat;
  const [round, setRound] = useState(0);
  const root = useRef(null);
  const onScreen = useOnScreen(root);
  const reduced = useReducedMotion();
  const { progress, bar, written, phase } = useDictation(onScreen && !reduced, round, () => setRound((r) => r + 1), MS);

  return (
    <Section id="translate" tone="surface" labelledBy="translate-title">
      <Heading id="translate-title" title={text.title} />

      {/* 两块等高、上下边对齐：左边是口述（说的那句和悬浮条，悬浮条贴在底边），右边是群聊窗口。三条要点在下面排一行 */}
      <div
        ref={root}
        className="reveal mt-flow-2 grid items-stretch gap-4 md:gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
      >
        <div className="flex flex-col rounded-stage bg-canvas p-7 sm:p-9">
          <p className="text-label font-medium text-ink-2">{chat.saidLabel}</p>
          <Spoken
            text={chat.said}
            progress={progress}
            written={written}
            talking={phase === "talk"}
            className="mt-4 text-subhead leading-relaxed text-ink-2"
          />
          <div className="mt-auto flex justify-center pt-8">
            <Bar state={bar} chip={chat.chip} />
          </div>
        </div>

        {/* 群聊窗口：名字一行、对方的一句、输入框。不画头像，一个在线的绿点就够 */}
        <div
          role="img"
          aria-label={chat.alt}
          className="flex min-w-0 flex-col overflow-clip rounded-stage bg-raised shadow-card"
        >
          <div className="flex items-center gap-2.5 border-b border-line px-6 py-4">
            <span className="size-2 rounded-full bg-signal" aria-hidden="true" />
            <span className="font-semibold text-ink">{chat.contact}</span>
          </div>
          <div className="flex flex-1 flex-col justify-end px-6 pt-6 pb-4">
            <p className="max-w-[85%] self-start rounded-tile rounded-bl-small bg-surface px-4 py-2.5 text-body leading-relaxed text-ink">
              {chat.incoming}
            </p>
          </div>
          <div className="px-4 pb-4">
            {/* 输入框一开始就按译文写进去的高度占好（垫一层看不见的译文），字落进来时窗口不变高 */}
            <div className="grid rounded-tile px-5 py-3 text-body leading-relaxed shadow-inset-line">
              <p className="invisible col-start-1 row-start-1" aria-hidden="true">
                {chat.written}
                <span className="ml-0.5 inline-block w-0.5" />
              </p>
              {written ? (
                <p
                  key={round}
                  // token-exempt: 演示里新写出来的字淡入，这段编排只这里用
                  className="col-start-1 row-start-1 text-ink motion-safe:animate-[fade-in_600ms_var(--ease-out)]"
                >
                  {chat.written}
                  <span
                    // token-exempt: 演示里输入光标的闪烁
                    className="ml-0.5 inline-block h-[1.1em] w-0.5 translate-y-[0.2em] bg-link motion-safe:animate-[caret-blink_1s_steps(1)_infinite]"
                    aria-hidden="true"
                  />
                </p>
              ) : (
                <p className="col-start-1 row-start-1 self-center text-ink-2/70">{chat.placeholder}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <ul className="reveal mt-flow-5 grid gap-y-8 border-t border-line pt-10 md:grid-cols-3 md:divide-x md:divide-line">
        {text.points.map((point) => (
          <li key={point.title} className="md:px-8 md:first:pl-0 md:last:pr-0">
            <h3 className="text-heading font-semibold text-ink">{point.title}</h3>
            <p className="mt-1.5 text-balance break-keep text-ink-2">{point.text}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
