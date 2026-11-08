import { Heading, Section } from "../components/Section.jsx";
import { Terminal } from "../components/Terminal.jsx";
import { links } from "../config.js";
import { useI18n } from "../i18n/index.jsx";
import { Icon } from "../icons/Icon.jsx";

/**
 * 开发者：左边四条要点和去 GitHub 的链接，右边一个会自己敲命令的终端（命令行一组、在 Mac 上开发 Windows 版一组）。
 * 命令和输出都照实写，见文案里 developers.sessions 的说明
 */
export function Developers() {
  const { m } = useI18n();
  const text = m.developers;
  return (
    <Section id="developers" tone="surface" labelledBy="developers-title">
      <Heading id="developers-title" title={text.title} />

      <div className="mt-flow-2 grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-16">
        <div className="reveal">
          <ul className="divide-y divide-line border-y border-line">
            {text.points.map((point) => (
              <li key={point.title} className="py-5">
                <h3 className="font-semibold text-ink">{point.title}</h3>
                <p className="mt-1 text-body text-ink-2">{point.text}</p>
              </li>
            ))}
          </ul>
          <a
            href={links.repository}
            className="group mt-7 inline-flex items-center gap-2 font-medium text-link transition-colors duration-150 hover:text-ink"
          >
            <Icon name="github" className="size-5" />
            {text.source}
            <Icon
              name="arrowRight"
              className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
            />
          </a>
        </div>
        <div className="reveal min-w-0">
          <Terminal
            sessions={text.sessions}
            tabs={text.terminal.tabs}
            label={text.terminal.label}
            fill={(line) => line.replace("{version}", links.version)}
          />
        </div>
      </div>
    </Section>
  );
}
