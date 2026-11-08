import { Icon } from "../icons/Icon.jsx";
import { useCopy } from "../lib/copy.js";

/** 终端里装的那一行，带一个复制按钮。剪贴板用不了时（老浏览器、非 https）按钮不出来，命令照样能选中复制 */
export function CopyCommand({ command, copyLabel, copiedLabel }) {
  const { copied, canCopy, copy } = useCopy(command);

  return (
    <div className="flex items-center gap-2 rounded-card bg-surface p-1.5 pl-4 shadow-inset-line">
      <Icon name="terminal" className="size-4 shrink-0 text-ink-2" />
      <code className="min-w-0 flex-1 overflow-x-auto py-2 font-mono text-code whitespace-nowrap text-ink [scrollbar-width:none]">
        {command}
      </code>
      {canCopy ? (
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-block bg-raised px-3 text-label font-medium text-ink shadow-inset-line transition-colors duration-150 hover:bg-canvas active:scale-[0.98]"
        >
          <Icon name={copied ? "check" : "copy"} className="size-4" />
          <span aria-live="polite">{copied ? copiedLabel : copyLabel}</span>
        </button>
      ) : null}
    </div>
  );
}
