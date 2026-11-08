import { links } from "../config.js";
import { useI18n } from "../i18n/index.jsx";
import { Icon } from "../icons/Icon.jsx";

// 每个安装包配它自己的标志，都是单色、跟着字的颜色
const MAIN = [
  { id: "arm64", icon: "apple", size: "size-5 -translate-y-px" },
  { id: "windows", icon: "windows", size: "size-[1.125rem]" },
];

/**
 * 下载：Apple 芯片的 Mac 和 Windows 两个主按钮，样式、大小一样，并排放；Intel 芯片的 Mac 是 Apple 芯片下面一行字。
 * 窄屏上下排：两个主按钮在前，Intel 那行在最后，不夹在两个按钮中间
 */
export function DownloadButtons({ className = "", style }) {
  const { m } = useI18n();
  return (
    <div
      className={`grid w-full max-w-sm gap-3 sm:w-auto sm:max-w-none sm:grid-cols-[repeat(2,minmax(14.5rem,auto))] sm:justify-center ${className}`}
      style={style}
    >
      {MAIN.map(({ id, icon, size }) => (
        <a
          key={id}
          href={links.downloads[id]}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink px-7 font-semibold whitespace-nowrap text-canvas transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.98] sm:row-start-1"
        >
          <Icon name={icon} className={`shrink-0 ${size}`} />
          {m.download.buttons[id]}
        </a>
      ))}
      <a
        href={links.downloads.x64}
        className="group inline-flex items-center justify-self-center gap-1 pt-1 text-label text-ink-2 transition-colors duration-150 hover:text-ink sm:col-start-1 sm:row-start-2"
      >
        {m.download.intel}
        <Icon
          name="arrowRight"
          className="size-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
        />
      </a>
    </div>
  );
}
