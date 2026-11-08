import { cutMarks } from "../lib/text.js";

/**
 * 口述的原话，边说边出现（progress 0 到 1）。~~ 括起来的口头禅、重复、改口在成品出来（written）时
 * 一段接一段淡出、虚掉，不划线。读屏读完整的一句，逐字出现的那些只是画面。
 * 高度一开始就按说完的样子占好（reserve 里每一句都垫一层看不见的，取最高的）：字往下换行时不把整页往下推
 */
export function Spoken({ text, progress, written, talking, reserve = [text], className = "" }) {
  const parts = cutMarks(text);
  const total = parts.reduce((sum, part) => sum + part.text.length, 0);
  let shown = Math.round(total * progress);
  let cuts = 0;
  return (
    <div className={`grid ${className}`}>
      {reserve.map((line) => (
        <p key={line} className="invisible col-start-1 row-start-1" aria-hidden="true">
          {line.replaceAll("~~", "")}
          {/* 说话时末尾那道光标也算进去 */}
          <span className="ml-0.5 inline-block w-0.5" />
        </p>
      ))}
      <p className="col-start-1 row-start-1">
        <span className="sr-only">{text.replaceAll("~~", "")}</span>
        {parts.map((part, i) => {
          const visible = part.text.slice(0, Math.max(0, shown));
          shown -= part.text.length;
          if (part.cut) cuts += 1;
          if (!visible) return null;
          return (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: 片段的顺序是固定的
              key={i}
              aria-hidden="true"
              // 删掉的部分从前往后依次淡下去，像被拿走了；留下的字不动
              style={part.cut ? { transitionDelay: written ? `${cuts * 110}ms` : "0ms" } : undefined}
              className={`transition-[color,filter] duration-700 ease-out motion-reduce:transition-none ${
                part.cut && written ? "text-ink/28 blur-[1px]" : "text-ink"
              }`}
            >
              {visible}
            </span>
          );
        })}
        {talking ? (
          <span className="ml-0.5 inline-block h-5 w-0.5 translate-y-1 animate-pulse bg-cinnabar" aria-hidden="true" />
        ) : null}
      </p>
    </div>
  );
}
