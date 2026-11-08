import { useEffect, useMemo, useRef, useState } from "react";
import { useOnScreen, useReducedMotion } from "../lib/usePageMotion.js";

/** 一拍多长：时间按拍往前走，不在屏幕上时不走，回来接着放 */
const TICK = 40;
/** 敲一个字、出一行输出、敲完到出结果、一条做完到下一条、一组放完到换下一组 */
const CHAR_MS = 26;
const LINE_MS = 90;
const RUN_MS = 260;
const NEXT_MS = 700;
const SWAP_MS = 1800;

/**
 * 一组命令排成时间线：每条先出注释，再一个字一个字敲出命令，停一下，输出一行接一行出来
 * @returns {{ steps: Array<{ entry: object, start: number, typeStart: number, outStart: number }>, end: number }}
 */
function timeline(entries) {
  const steps = [];
  let at = 400;
  for (const entry of entries) {
    const typeStart = at + 220;
    const outStart = typeStart + entry.command.length * CHAR_MS + RUN_MS;
    steps.push({ entry, start: at, typeStart, outStart });
    at = outStart + entry.output.length * LINE_MS + NEXT_MS;
  }
  return { steps, end: at + SWAP_MS };
}

/**
 * 会自己敲命令的终端：几组命令（tabs 的顺序），一组放完自动换下一组，点上面的标签直接换。
 * 不在屏幕上时停下；减弱动态效果时不敲，直接是整组敲完的样子。
 * 读屏读的是整组的文字（sr-only），会动的那一层对读屏隐藏
 * @param {{ sessions: Record<string, Array<{ comment: string, command: string, output: string[] }>>,
 *           tabs: Record<string, string>, label: string, fill?: (text: string) => string }} props
 *   fill：输出里的占位（比如 {version}）换成真的值
 */
export function Terminal({ sessions, tabs, label, fill = (text) => text }) {
  const ids = useMemo(() => Object.keys(tabs), [tabs]);
  const [tab, setTab] = useState(ids[0]);
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef(null);
  const visible = useOnScreen(ref);
  const reduced = useReducedMotion();
  const plan = useMemo(() => timeline(sessions[tab]), [sessions, tab]);
  const playing = visible && !reduced;
  const now = reduced ? plan.end : elapsed;

  useEffect(() => {
    if (!playing) return undefined;
    const timer = setInterval(() => setElapsed((value) => value + TICK), TICK);
    return () => clearInterval(timer);
  }, [playing]);

  // 一组放完：换下一组，从头敲
  useEffect(() => {
    if (reduced || elapsed < plan.end) return;
    setTab((current) => ids[(ids.indexOf(current) + 1) % ids.length]);
    setElapsed(0);
  }, [elapsed, plan.end, reduced, ids]);

  function choose(id) {
    setTab(id);
    setElapsed(0);
  }

  // 左右方向键在标签之间走（WAI-ARIA 的标签页）
  function onKeyDown(event) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = ids[(ids.indexOf(tab) + step + ids.length) % ids.length];
    choose(next);
    event.currentTarget.querySelector(`[data-tab="${next}"]`)?.focus();
  }

  // 正在敲的那条：光标跟着它；都敲完了，光标停在新的一行提示符后面
  const typing = plan.steps.findLast((step) => now >= step.typeStart && now < step.outStart);
  const done = now >= plan.steps.at(-1).outStart;
  const idle = now < plan.steps[0].start;

  return (
    <div ref={ref} className="terminal overflow-clip rounded-tile bg-terminal text-terminal-ink shadow-window">
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="relative flex gap-6 border-b border-white/10 px-5 text-label sm:px-6"
      >
        {ids.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            data-tab={id}
            id={`terminal-tab-${id}`}
            aria-selected={tab === id}
            aria-controls="terminal-panel"
            tabIndex={tab === id ? 0 : -1}
            onClick={() => choose(id)}
            className={`relative cursor-pointer py-3.5 font-medium transition-colors duration-150 ${
              tab === id ? "text-white" : "text-white/55 hover:text-white/80"
            }`}
          >
            {tabs[id]}
            {/* 选中的那个下面一道线，线里走的是这一组放到哪了 */}
            {tab === id ? (
              <span aria-hidden="true" className="absolute inset-x-0 -bottom-px h-0.5 overflow-clip bg-white/20">
                <span
                  className="block h-full origin-left bg-white"
                  style={{ transform: `scaleX(${Math.min(1, now / plan.end)})` }}
                />
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id="terminal-panel"
        aria-labelledby={`terminal-tab-${tab}`}
        className="h-[25rem] px-5 py-5 font-mono text-code leading-code sm:h-[22rem] sm:px-6 sm:text-code-wide"
      >
        <div className="sr-only">
          {sessions[tab].map((entry) => (
            <p key={entry.command}>
              {entry.comment}: {entry.command} → {entry.output.map(fill).join(" ")}
            </p>
          ))}
        </div>
        <div aria-hidden="true" className="grid gap-3.5">
          {plan.steps
            .filter((step) => now >= step.start)
            .map((step) => {
              const { entry } = step;
              const typed = entry.command.slice(0, Math.max(0, Math.floor((now - step.typeStart) / CHAR_MS)));
              const lines = entry.output.filter((_, index) => now >= step.outStart + index * LINE_MS);
              return (
                <div key={entry.command} className="[overflow-wrap:anywhere]">
                  <p className="text-white/45"># {entry.comment}</p>
                  <p className="text-white">
                    <span className="text-terminal-accent select-none">$ </span>
                    {typed}
                    {typing === step ? <Caret /> : null}
                  </p>
                  {lines.map((line) => (
                    <p key={line}>{fill(line)}</p>
                  ))}
                </div>
              );
            })}
          {done || idle ? (
            <p className="text-white">
              <span className="text-terminal-accent select-none">$ </span>
              <Caret />
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** 光标：一个方块，一闪一闪（styles.css 的 .terminal-caret；减弱动态效果时不闪） */
function Caret() {
  return <span className="terminal-caret ml-px inline-block h-[1.1em] w-[0.55em] translate-y-[0.18em] bg-white/85" />;
}
