import { useI18n } from "../i18n/index.jsx";
import { Icon } from "../icons/Icon.jsx";

/** 一句话就讲得完的几样排一行：图标、名字、一句话。不套卡片，之间一道细线；中等宽度三列、窄屏两列 */
export function Features() {
  const { m } = useI18n();
  return (
    <section aria-label={m.features.label} className="bg-canvas text-ink">
      <ul className="reveal mx-auto grid max-w-6xl grid-cols-2 gap-y-10 border-t border-line px-5 pt-12 pb-intro-gap sm:px-8 md:grid-cols-3 lg:grid-cols-5 lg:divide-x lg:divide-line">
        {m.features.items.map((feature) => (
          <li key={feature.title} className="flex flex-col gap-3 pr-4 lg:px-6 lg:first:pl-0">
            <Icon name={feature.icon} className="size-6 text-ink" />
            <div>
              <h3 className="font-semibold text-ink">{feature.title}</h3>
              <p className="mt-0.5 text-label text-balance break-keep text-ink-2">{feature.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
