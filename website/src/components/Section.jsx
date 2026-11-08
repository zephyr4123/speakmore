import { useI18n } from "../i18n/index.jsx";

/**
 * 一整段：底色、上下留白、内容的最大宽度。
 * tone：canvas（跟着系统深浅）、surface（跟着系统、比底色深一点）、ink（近黑，固定深色）
 * 超出的部分用 overflow: clip 裁掉，不用 hidden：hidden 会让这一段自己成了滚动容器，
 * 里面跟着滚动走的动画（.reveal、成本的数字）就去跟这个不会滚的盒子走，一直停在终点
 */
const TONES = {
  canvas: "bg-canvas",
  surface: "bg-surface",
  ink: "tone-ink",
};

export function Section({ id, tone = "canvas", className = "", children, labelledBy }) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={`${TONES[tone]} text-ink overflow-clip ${className}`}>
      <div className="mx-auto max-w-6xl px-5 py-section sm:px-8">{children}</div>
    </section>
  );
}

/**
 * 文案里的 \n 是标题换行的位置。muted：除了最后一行都用浅色，先铺垫、后落点（"口述随意"浅、"成文规整"深），
 * 两行一样大小时也分得出主次
 */
export function Lines({ text, muted = false }) {
  const lines = text.split("\n");
  return lines.map((line, index) => {
    const last = index === lines.length - 1;
    return (
      <span key={line} className={`block ${muted && !last ? "text-ink-2" : ""}`}>
        {line}
        {last ? null : " "}
      </span>
    );
  });
}

/**
 * 一行排开的标题：文案里 \n 前后两半，前半浅、后半深（"口述随意"浅、"成文规整"深），中文用逗号接上、英文用空格。
 * 不再两行大字往下摞：只占一行（窄屏才折，中文只在标点处折），右边不空出一大块
 */
function Inline({ text }) {
  const { locale } = useI18n();
  const joiner = locale === "zh-CN" ? "，" : " ";
  const parts = text.split("\n");
  return parts.map((part, index) => {
    const last = index === parts.length - 1;
    return (
      <span key={part} className={last ? "" : "text-ink-2"}>
        {part}
        {last ? null : joiner}
      </span>
    );
  });
}

/**
 * 每段的大标题，靠左一行（见 Inline）；给了 lead 时那句话放在右边一栏、和标题的底边对齐，窄屏上下排。
 * center：居中，给只有一行标题、没有那句话的段落
 */
export function Heading({ id, title, lead, align = "split" }) {
  if (align === "center") {
    return (
      <header className="reveal mx-auto max-w-3xl text-center">
        <h2 id={id} className="display text-section-center">
          <Lines text={title} />
        </h2>
      </header>
    );
  }
  const heading = (
    <h2 id={id} className="display text-section break-keep">
      <Inline text={title} />
    </h2>
  );
  if (!lead) return <header className="reveal mb-heading-gap">{heading}</header>;
  return (
    <header className="reveal grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:gap-16">
      {heading}
      {/* 中文只在标点和空格处换行，不把一个词拆到两行；几行尽量一样长，不剩一个短尾巴 */}
      {/* token-exempt: 底边和左边大标题的基线对齐，按字号算 */}
      <p className="max-w-[30rem] text-subhead leading-relaxed text-balance break-keep wrap-anywhere text-ink-2 lg:justify-self-end lg:pb-[0.3em]">
        {lead}
      </p>
    </header>
  );
}
