import { Chord } from "../components/Chord.jsx";
import { useI18n } from "../i18n/index.jsx";

/**
 * 首屏下面紧跟的一排：三项功能各一格，键帽、名字、一句话，点了跳到那一段。
 * 三个组合都从右 ⌥ 出发，键帽并排一眼看得出来。不套卡片，之间一道细线
 */
export function Trio() {
  const { m } = useI18n();
  return (
    <section id="trio" aria-labelledby="trio-title" className="bg-canvas text-ink">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <h2 id="trio-title" className="sr-only">
          {m.trio.label}
        </h2>
        <ul className="reveal grid gap-y-10 border-t border-line pt-10 md:grid-cols-3 md:divide-x md:divide-line">
          {m.trio.items.map((item) => (
            <li key={item.id} className="md:px-8 md:first:pl-0 md:last:pr-0">
              <a href={`#${item.id}`} className="group block">
                <Chord keys={item.chord} />
                <h3 className="mt-5 text-card-title font-semibold tracking-card-title text-ink transition-colors duration-150 group-hover:text-link">
                  {item.name}
                </h3>
                <p className="mt-1.5 text-body text-ink-2">{item.text}</p>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
