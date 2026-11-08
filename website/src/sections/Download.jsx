import seal from "../../../assets/icon.svg";
import { CopyCommand } from "../components/CopyCommand.jsx";
import { DownloadButtons } from "../components/DownloadButtons.jsx";
import { Lines } from "../components/Section.jsx";
import { links } from "../config.js";
import { useI18n } from "../i18n/index.jsx";
import { Icon } from "../icons/Icon.jsx";

/** 最后一屏：下载（Apple 芯片、Windows，Intel 在下面一行），下面是终端里装的一行（macOS、Windows 各一行）；页脚也在这里 */
export function Download() {
  const { m, switchLocale } = useI18n();
  return (
    <section id="download" className="bg-canvas text-ink" aria-labelledby="download-title">
      <div className="mx-auto flex max-w-6xl flex-col items-center px-5 pt-section text-center sm:px-8">
        <img src={seal} alt="" width="80" height="80" className="reveal size-20" />
        <h2 id="download-title" className="display reveal mt-8 text-closing">
          <Lines text={m.download.title} />
        </h2>
        <p className="reveal mt-4 text-subhead font-medium text-ink-2">{m.download.lead}</p>

        <DownloadButtons className="reveal mt-12" />
        <div className="reveal mt-6 grid w-full max-w-2xl gap-4 text-left">
          {["mac", "windows"].map((system) => (
            // 网格里的一格默认不比内容窄：不放开的话，长命令会把整页撑宽（窄屏上命令自己横着滑）
            <div key={system} className="min-w-0">
              <p className="mb-2 pl-1 text-fine font-medium text-ink-2">{m.download.terminal[system]}</p>
              <CopyCommand
                command={links.install[system]}
                copyLabel={m.download.copy}
                copiedLabel={m.download.copied}
              />
            </div>
          ))}
        </div>
      </div>

      <footer className="mx-auto mt-flow-8 flex max-w-6xl flex-col items-center justify-between gap-4 border-t border-line px-5 py-8 text-fine text-ink-2 sm:flex-row sm:px-8">
        <p className="flex items-center gap-2">
          <img src={seal} alt="" width="16" height="16" className="size-4" />
          SpeakMore {links.version}
        </p>
        <p className="flex items-center gap-5">
          <a href={links.license} className="hover:text-ink">
            {m.footer.license}
          </a>
          <a href={links.repository} className="hover:text-ink">
            {m.footer.source}
          </a>
          {/* 换语言放在页脚最后：进来时已按浏览器的语言选好，只有少数人要换 */}
          <button
            type="button"
            onClick={switchLocale}
            aria-label={m.footer.switchLabel}
            className="inline-flex cursor-pointer items-center gap-1.5 transition-colors duration-150 hover:text-ink"
          >
            <Icon name="globe" className="size-3.5" />
            {m.footer.switchTo}
          </button>
        </p>
      </footer>
    </section>
  );
}
