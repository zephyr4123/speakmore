import { Heading, Lines, Section } from "../components/Section.jsx";
import { readme } from "../config.js";
import { useI18n } from "../i18n/index.jsx";
import { Icon } from "../icons/Icon.jsx";

/**
 * 隐私：离线方式的四样（不上传、无需账号、密钥加密、记录本机）排一行，不套卡片、之间一道细线；
 * 下面是国内源：一句话加下载速度对比图（README 的那张，跟着系统深浅换）
 */
export function Privacy() {
  const { m, locale } = useI18n();
  const text = m.privacy;
  const light = readme("download-speed-light", locale);
  const dark = readme("download-speed-dark", locale);
  return (
    <Section id="privacy" tone="surface" labelledBy="privacy-title">
      <Heading id="privacy-title" title={text.title} />

      <ul className="reveal mt-flow-4 grid grid-cols-2 gap-y-12 lg:grid-cols-4 lg:divide-x lg:divide-line">
        {text.items.map((item) => (
          <li key={item.title} className="flex flex-col gap-4 pr-6 lg:px-8 lg:first:pl-0">
            <Icon name={item.icon} className="size-8 text-seal" />
            <div>
              <h3 className="text-heading font-semibold text-ink">{item.title}</h3>
              <p className="mt-1 text-secondary text-ink-2">{item.text}</p>
            </div>
          </li>
        ))}
      </ul>

      {/* 速度对比图自己带着白底和细边，外面不再套一层 */}
      <div className="reveal mt-flow-7 grid items-center gap-10 border-t border-line pt-flow-2 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div>
          <h3 className="display text-statement">
            <Lines text={text.mirror.title} muted />
          </h3>
          <p className="mt-5 max-w-sm text-ink-2">{text.mirror.text}</p>
        </div>
        <picture className="block">
          <source media="(prefers-color-scheme: dark)" srcSet={dark.src} />
          <img
            src={light.src}
            width={light.width}
            height={light.height}
            alt={text.mirror.alt}
            loading="lazy"
            decoding="async"
            className="block h-auto w-full"
          />
        </picture>
      </div>
    </Section>
  );
}
