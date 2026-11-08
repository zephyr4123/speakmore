import { ProviderIcon } from "./ProviderIcon.jsx";

/**
 * 一排厂商标志从右往左匀速走，首尾相接：同一排排两份，走完一份正好回到起点。两头淡出，鼠标停上去就停下，方便看清。
 * 照 React Bits 的 LogoLoop 的样子，只留这几样（它带拖拽、惯性那一整套，这里用不上）。
 * 减弱动态效果时不走，排成能换行的一排（styles.css 的 .logo-loop）
 * @param {{ items: Array<{ id: string, name: string }>, label: string }} props
 */
export function LogoLoop({ items, label }) {
  return (
    <div className="logo-loop">
      <div className="logo-loop-track">
        {[0, 1].map((copy) => (
          <ul
            key={copy}
            className="logo-loop-list"
            aria-label={copy === 0 ? label : undefined}
            aria-hidden={copy === 1 ? true : undefined}
          >
            {items.map(({ id, name }) => (
              <li key={id} className="flex shrink-0 items-center gap-3 text-ink">
                <ProviderIcon id={id} className="size-7" />
                <span className="text-lead font-semibold tracking-brand whitespace-nowrap">{name}</span>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
