import { useI18n } from "../i18n/index.jsx";

/** 访客在 Windows 上：右侧那个键写"右 Alt"，别处写"右 ⌥"（App 里也是按系统写的） */
const ON_WINDOWS = /Windows/i.test(navigator.userAgent);

/**
 * 一个快捷键组合画成几个键帽，并排、不加"+"（同 App 设置里的写法）。
 * keys 是文案 keys 里的名字：alt、space、enter
 */
export function Chord({ keys, className = "" }) {
  const { m } = useI18n();
  const label = (key) => {
    const name = m.keys[key];
    return typeof name === "string" ? name : name[ON_WINDOWS ? "windows" : "mac"];
  };
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {keys.map((key) => (
        <kbd
          key={key}
          className="inline-flex h-8 min-w-8 items-center justify-center rounded-control bg-raised px-2.5 font-sans text-label font-medium text-ink shadow-key"
        >
          {label(key)}
        </kbd>
      ))}
    </span>
  );
}
