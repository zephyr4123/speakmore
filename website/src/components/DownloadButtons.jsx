import { useEffect, useRef, useState } from "react";
import { links } from "../config.js";
import { useI18n } from "../i18n/index.jsx";
import { Icon } from "../icons/Icon.jsx";
import { onPhoneOrTablet } from "../lib/site.js";

const ON_PHONE = onPhoneOrTablet(navigator);

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
  if (ON_PHONE) return <CopyDownloadLink className={className} style={style} />;
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

/**
 * 手机、平板上：安装包装不了，点了只会下来一个打不开的文件。换成复制下载页的地址，到电脑上打开。
 * 剪贴板用不了时（老浏览器、非 https）把地址写出来，长按自己复制
 */
function CopyDownloadLink({ className, style }) {
  const { m } = useI18n();
  const [copied, setCopied] = useState(false);
  const [canCopy, setCanCopy] = useState(false);
  const timer = useRef(0);

  useEffect(() => {
    setCanCopy(Boolean(navigator.clipboard?.writeText));
    return () => clearTimeout(timer.current);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(links.downloadPage);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      // 浏览器拒绝了：换成把地址写出来
      console.warn("复制下载链接失败", error);
      setCanCopy(false);
    }
  }

  return (
    <div className={`grid w-full max-w-sm justify-items-center gap-3 ${className}`} style={style}>
      {canCopy ? (
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-ink px-7 font-semibold whitespace-nowrap text-canvas transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.98]"
        >
          <Icon name={copied ? "check" : "copy"} className="size-5 shrink-0" />
          <span aria-live="polite">{copied ? m.download.copied : m.download.phone.copy}</span>
        </button>
      ) : (
        <p className="font-mono text-code break-all text-ink select-all">{links.downloadPage}</p>
      )}
      <p className="text-label text-ink-2">{m.download.phone.hint}</p>
    </div>
  );
}
