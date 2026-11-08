import { Heading, Section } from "../components/Section.jsx";
import { PHOTO_PAD, Shot } from "../components/Shot.jsx";
import { readme } from "../config.js";
import { useI18n } from "../i18n/index.jsx";

/**
 * 划词翻译：真截图说话（README 那批，在 Mac 上截的；中英文各截了自己语言的三张，名单在文案 lookup.shots）。
 * 一张网页的大图，下面两张小的（PDF、终端或备忘录），各配一个名字；最后一行三条要点，之间一道细线。
 * 小的两张用裁到选区和卡片的那块（<名字>-crop），两栏等宽：同一种语言的两张裁成一样的宽高比，并排一样高、说明对齐。
 * 窄屏三张都换成选区加卡片的那块（<名字>-card）：整张缩到手机宽，卡片上的字太小
 */
export function Lookup() {
  const { m, locale } = useI18n();
  const text = m.lookup;
  const [main, ...rest] = text.shots;
  // 大图不放大到比原图宽：英文那张网页截得窄，撑满一栏会比屏幕还高
  const mainWidth = readme(main.name, locale).width - PHOTO_PAD * 2;
  return (
    <Section id="lookup" labelledBy="lookup-title">
      <Heading id="lookup-title" title={text.title} />

      <div className="reveal mx-auto mt-flow-2" style={{ maxWidth: `${mainWidth}px` }}>
        <Shot name={main.name} small={`${main.name}-card`} alt={main.alt} pad={PHOTO_PAD} />
      </div>

      <ul className="reveal mt-flow-1 grid gap-x-8 gap-y-10 md:grid-cols-2">
        {rest.map((shot) => (
          <li key={shot.name}>
            <Shot name={`${shot.name}-crop`} small={`${shot.name}-card`} alt={shot.alt} pad={PHOTO_PAD} flush />
            <p className="mt-3 text-center text-label font-medium text-ink-2">{shot.caption}</p>
          </li>
        ))}
      </ul>

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
