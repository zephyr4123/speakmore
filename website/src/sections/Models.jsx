import { LogoLoop } from "../components/LogoLoop.jsx";
import { Heading, Section } from "../components/Section.jsx";
import { PHOTO_PAD, Shot } from "../components/Shot.jsx";
import { useI18n } from "../i18n/index.jsx";
import { Cost } from "./Cost.jsx";

/** 轮播里的各家，按这个顺序走；名字在文案里（models.vendors） */
const VENDORS = [
  "gemini",
  "openai",
  "qwen",
  "bailian",
  "deepseek",
  "kimi",
  "zhipu",
  "minimax",
  "funaudiollm",
  "custom",
];

/** 模型自由：一排各家的标志从页面一头走到另一头；下面是模型页的截图，旁边三句要点；最后一条是费用（钱直接付给模型厂商） */
export function Models() {
  const { m } = useI18n();
  const items = VENDORS.map((id) => ({ id, name: m.models.vendors[id] }));
  return (
    <Section id="models" labelledBy="models-title">
      <Heading id="models-title" title={m.models.title} />

      {/* 标志那一排撑满整个页面宽：从屏幕边上走进来、走出去 */}
      {/* token-exempt: 撑满整个页面宽：从内容栏伸到屏幕两边 */}
      <div className="reveal mx-[calc(50%-50vw)] mt-flow-4">
        <LogoLoop items={items} label={m.models.loopLabel} />
      </div>

      <div className="mt-flow-6 grid items-center gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16">
        {/* 引擎页裁出来的一条：厂商 → 型号 → 详情卡；窄屏只要详情卡 */}
        <Shot name="polish-crop" small="polish-card" pad={PHOTO_PAD} alt={m.models.shotAlt} className="reveal" />
        <ul className="reveal divide-y divide-line border-y border-line">
          {m.models.points.map((point) => (
            <li key={point.title} className="py-6">
              <h3 className="text-heading font-semibold text-ink">{point.title}</h3>
              <p className="mt-1.5 text-ink-2">{point.text}</p>
            </li>
          ))}
        </ul>
      </div>

      <Cost />
    </Section>
  );
}
