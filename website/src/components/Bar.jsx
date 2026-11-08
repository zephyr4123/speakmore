/**
 * 说话时屏幕底部的那条悬浮条，照 App 里的样子（src/renderer/bar/bar.css）用朱砂主题的颜色画出来，会动。
 * state：recording（声波跟着说话起伏）、finishing（整理中，一道匀速滚过的波）、done（打一个勾）
 * chip：语音翻译时这一次译成哪种语言，画在提示行左边的小胶囊里（同 App 的 bar-ui.mjs 的 drawChip）
 * 颜色是 bar-* 那组 token，生成时从 App 的朱砂主题（src/themes/cinnabar.mjs）取；竖条的粗细、间距、动画照 App 的悬浮条，不进 token
 */

// 每根竖条说话时最高到多高：中间高、两头低
const PEAKS = [0.3, 0.42, 0.55, 0.7, 0.82, 0.92, 1, 0.95, 1, 0.9, 0.8, 0.66, 0.52, 0.4, 0.28];

export function Bar({ state = "recording", hint, chip, className = "" }) {
  const recording = state === "recording";
  return (
    <div className={`flex flex-col items-center gap-1.5 ${className}`} aria-hidden="true">
      {hint || chip ? (
        <div className="flex items-center gap-1.5">
          {chip ? (
            <p className="flex items-center gap-1 rounded-full bg-bar-surface px-2.5 py-0.5 text-micro leading-normal font-semibold whitespace-nowrap text-bar-ink shadow-bar-edge">
              {chip}
              <svg aria-hidden="true" viewBox="0 0 10 10" className="size-2 opacity-70" fill="none">
                <path d="M2.5 4l2.5 2.5L7.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </p>
          ) : null}
          {hint ? (
            <p className="rounded-full bg-bar-surface px-2.5 py-0.5 text-micro leading-normal whitespace-nowrap text-bar-muted shadow-bar-edge">
              {hint}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="flex h-10 items-center gap-2 rounded-tile bg-bar-surface p-1.5 shadow-bar">
        <span
          className="grid size-7 place-items-center rounded-full bg-bar-ghost text-bar-ink transition-[opacity,transform] duration-200 ease-out-quint"
          style={{ opacity: recording ? 1 : 0, transform: recording ? "none" : "scale(0.6)" }}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 14 14"
            className="size-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <path d="M3 3l8 8M11 3l-8 8" />
          </svg>
        </span>

        <span className="relative h-[22px] w-[76px]">
          {/* 声波 */}
          <span
            // token-exempt: 竖条的间距照 App 的悬浮条
            className="absolute inset-0 flex items-center justify-center gap-[2px] transition-opacity duration-200"
            style={{ opacity: recording ? 1 : 0 }}
          >
            {PEAKS.map((peak, index) => (
              <i
                // biome-ignore lint/suspicious/noArrayIndexKey: 竖条的个数和顺序是固定的
                key={index}
                // token-exempt: 竖条的圆角和说话的起伏动画照 App 的悬浮条
                className="block h-full w-[2px] rounded-[1px] bg-bar-live motion-safe:animate-[talk_1.1s_ease-in-out_infinite]"
                style={{
                  transform: `scaleY(${peak * 0.6})`,
                  // 离中间越远起得越晚，看起来是从中间往两边传开
                  animationDelay: `${Math.abs(index - 7) * 70}ms`,
                  animationDuration: `${900 + (index % 4) * 120}ms`,
                  scale: `1 ${peak}`,
                }}
              />
            ))}
          </span>
          {/* 整理中 */}
          <span
            // token-exempt: 竖条的间距照 App 的悬浮条
            className="absolute inset-0 flex items-center justify-center gap-[3px] transition-opacity duration-200"
            style={{ opacity: state === "finishing" ? 1 : 0 }}
          >
            {Array.from({ length: 9 }, (_, index) => (
              <i
                // biome-ignore lint/suspicious/noArrayIndexKey: 竖条的个数和顺序是固定的
                key={index}
                // token-exempt: 竖条的圆角和整理中的波动画照 App 的悬浮条
                className="block h-full w-[3px] rounded-[2px] bg-bar-live motion-safe:animate-[think_1.15s_ease-in-out_infinite]"
                style={{ transform: "scaleY(0.2)", animationDelay: `${index * -90}ms` }}
              />
            ))}
          </span>
          {/* 完成 */}
          <svg
            aria-hidden="true"
            viewBox="0 0 76 22"
            className="absolute inset-0 transition-opacity duration-200"
            style={{ opacity: state === "done" ? 1 : 0 }}
          >
            <path
              key={state}
              d="M30 11.5l5.5 5.5L47 5.5"
              fill="none"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="24"
              strokeDashoffset={state === "done" ? 24 : 0}
              className={
                state === "done"
                  ? // token-exempt: 打勾的描线动画照 App 的悬浮条
                    "stroke-bar-live motion-safe:animate-[draw_380ms_var(--ease-out-quint)_forwards] motion-reduce:[stroke-dashoffset:0]"
                  : "stroke-bar-live"
              }
            />
          </svg>
        </span>

        <span
          className="grid size-7 place-items-center rounded-full bg-bar-live text-bar-surface transition-[opacity,transform] duration-200 ease-out-quint"
          style={{
            opacity: recording ? 1 : 0,
            transform: recording ? "none" : "scale(0.6)",
          }}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 14 14"
            className="size-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2.5 7.5l3 3 6-7" />
          </svg>
        </span>
      </div>
    </div>
  );
}
