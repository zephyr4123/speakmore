import { Heading, Section } from "../components/Section.jsx";
import { useI18n } from "../i18n/index.jsx";
import { Icon } from "../icons/Icon.jsx";
import { useEnterOnce } from "../lib/usePageMotion.js";

/**
 * 每种识别方式一路经过的几站：图标，和这一站在本机（device）还是云端（cloud）。和文案里 ways.items[].steps 一一对应。
 * 本机转写那一站用印章色；离开本机的那一站和那一跳用朱砂色：一眼看出什么出了本机、离线一道朱砂都没有
 */
const ROUTES = {
  native: [
    { icon: "mic", lane: "device" },
    { icon: "sparkle", lane: "cloud" },
    { icon: "text", lane: "device" },
  ],
  local: [
    { icon: "mic", lane: "device" },
    { icon: "chip", lane: "device" },
    { icon: "magic", lane: "cloud" },
    { icon: "text", lane: "device" },
  ],
  private: [
    { icon: "mic", lane: "device" },
    { icon: "chip", lane: "device" },
    { icon: "text", lane: "device" },
  ],
};

/** 图里的坐标（百分比）：左边留给两条泳道的名字，几站在剩下的宽度里均分；两条泳道的中线 */
const LEFT = 15;
const LANE_Y = { cloud: 27, device: 73 };
const stopX = (index, count) => LEFT + ((100 - LEFT) * (index + 0.5)) / count;

/**
 * 识别方式：三种方式一行一种。左边是名字、一句话、上传什么、要不要密钥；右边是一张路线图：
 * 上面一条是云端、下面一条是本机，录音从本机出发，一站一站走到成稿，出了本机的那一跳标出带走的是音频还是文字。
 * 滚到时路线从头画到尾、各站依次亮起来
 */
export function Ways() {
  const { m } = useI18n();
  return (
    <Section id="ways" tone="surface" labelledBy="ways-title">
      <Heading id="ways-title" title={m.ways.title} />

      <ol className="mt-flow-4 grid">
        {m.ways.items.map((way) => (
          <li
            key={way.id}
            className="reveal grid gap-8 border-t border-line py-card-y last:pb-0 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:items-center lg:gap-16"
          >
            <div>
              <h3 className="text-title font-semibold tracking-title text-ink">{way.name}</h3>
              <p className="mt-2 text-body text-ink-2">{way.text}</p>
              <ul className="mt-6 grid gap-2.5 text-label">
                {way.facts.map((fact, index) => (
                  <li key={fact} className="flex items-center gap-2.5 text-ink">
                    <span
                      className={`size-1.5 rounded-full ${
                        index === 0 && way.id !== "private" ? "bg-cinnabar" : "bg-seal"
                      }`}
                    />
                    {fact}
                  </li>
                ))}
              </ul>
            </div>
            <RouteMap way={way} lanes={m.ways.lanes} />
          </li>
        ))}
      </ol>
    </Section>
  );
}

/** 一种方式的路线图：两条泳道、一条走线、几站，出了本机的那一跳写着带走了什么 */
function RouteMap({ way, lanes }) {
  const { ref, stage } = useEnterOnce();
  const stops = ROUTES[way.id];
  const points = stops.map((stop, index) => ({ x: stopX(index, stops.length), y: LANE_Y[stop.lane] }));
  // 走线拆成一段一段横竖的直线：同一条泳道上直走；换泳道时在两站正中拐上去（或下来），像地铁线路图。
  // 出了本机的几段（拐上去、在云端走、拐下来）用朱砂色
  const segments = [];
  let carry = null;
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    if (from.y === to.y) {
      segments.push({ from, to, out: from.y === LANE_Y.cloud });
      continue;
    }
    const mid = (from.x + to.x) / 2;
    const up = to.y < from.y;
    segments.push({ from, to: { x: mid, y: from.y }, out: !up });
    segments.push({ from: { x: mid, y: from.y }, to: { x: mid, y: to.y }, out: true });
    segments.push({ from: { x: mid, y: to.y }, to, out: up });
    if (up) carry = mid;
  }
  const offline = stops.every((stop) => stop.lane === "device");

  return (
    <div
      ref={ref}
      data-stage={stage}
      className="route-map relative h-[13.5rem] select-none"
      role="img"
      aria-label={`${way.name}：${way.steps.join(" → ")}`}
    >
      {/* 两条泳道：云端是虚线框，本机是实底 */}
      <div className="absolute inset-x-0 top-0 h-[46%] rounded-tile border border-dashed border-ink-2/35" />
      <div className="absolute inset-x-0 bottom-0 h-[46%] rounded-tile bg-raised shadow-line" />
      {[
        { lane: "cloud", icon: "cloud", top: "top-0" },
        { lane: "device", icon: "laptop", top: "top-[54%]" },
      ].map(({ lane, icon, top }) => (
        <div
          key={lane}
          className={`absolute left-0 ${top} flex h-[46%] w-[15%] flex-col items-center justify-center gap-1 text-ink-2`}
          aria-hidden="true"
        >
          <Icon name={icon} className="size-5" />
          <span className="text-fine font-medium">{lanes[lane]}</span>
        </div>
      ))}
      {offline ? (
        <p
          className="absolute top-[23%] left-[57.5%] flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 text-label text-ink-2"
          aria-hidden="true"
        >
          <Icon name="offline" className="size-4" />
          {lanes.offline}
        </p>
      ) : null}

      {segments.map(({ from, to, out }, index) => {
        const horizontal = from.y === to.y;
        const style = horizontal
          ? { left: `${Math.min(from.x, to.x)}%`, width: `${Math.abs(to.x - from.x)}%`, top: `${from.y}%` }
          : { left: `${from.x}%`, top: `${Math.min(from.y, to.y)}%`, height: `${Math.abs(to.y - from.y)}%` };
        // 从哪头长出来：往右走从左头，往上走从下头
        const origin = horizontal ? (to.x > from.x ? "left" : "right") : to.y < from.y ? "bottom" : "top";
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: 一种方式的走线是固定的
            key={index}
            className={`route-segment absolute ${horizontal ? "h-0.5 -translate-y-1/2" : "w-0.5 -translate-x-1/2"} ${
              out ? "bg-cinnabar" : "bg-ink-2/45"
            }`}
            style={{ ...style, "--i": index, "--origin": origin }}
            data-axis={horizontal ? "x" : "y"}
            aria-hidden="true"
          />
        );
      })}

      {carry !== null ? (
        <span
          className="route-carry absolute top-1/2 flex -translate-y-1/2 items-center gap-1 pl-2.5 text-fine font-semibold whitespace-nowrap text-cinnabar"
          style={{ left: `${carry}%` }}
          aria-hidden="true"
        >
          <Icon name="upload" className="size-3.5" />
          {way.carry}
        </span>
      ) : null}

      {stops.map((stop, index) => {
        const tone =
          stop.lane === "cloud"
            ? "bg-cinnabar text-white"
            : stop.icon === "chip"
              ? "bg-seal text-white"
              : "bg-canvas text-ink shadow-line";
        return (
          <div
            key={stop.icon}
            className="route-stop absolute flex flex-col items-center"
            style={{ left: `${points[index].x}%`, top: `${points[index].y}%`, "--i": index }}
            aria-hidden="true"
          >
            <span className={`grid size-11 place-items-center rounded-full ${tone}`}>
              <Icon name={stop.icon} className="size-5" />
            </span>
            {/* 名字挂在圆外侧：云端的在上面、本机的在下面，不压着两条泳道的边 */}
            <span
              className={`absolute text-fine font-medium whitespace-nowrap text-ink sm:text-code ${
                stop.lane === "cloud" ? "bottom-full mb-1.5" : "top-full mt-1.5"
              }`}
            >
              {way.steps[index]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
