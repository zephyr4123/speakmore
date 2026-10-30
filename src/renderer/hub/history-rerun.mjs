import { fillSelect, h, platformName } from "../shared/dom.mjs";
import { t } from "../shared/i18n.mjs";
import { describeError } from "../shared/setup-text.mjs";
import { modeName, roleName } from "./engine/plaza-view.mjs";
import { slidingIndicators } from "./indicators.mjs";
import { needText } from "./route-view.mjs";
import { toast } from "./toast.mjs";

// 重跑对话框：拿这条记录的录音换个模型再跑一次（app/rerun.mjs）。能选什么由主进程给（history:rerun-options）：
// 上面是三种识别方式（做不了这个功能的灰着，悬停说原因），下面一行一项能换的模型；名字和"还差什么"照引擎页的写法，
// 还差东西时不让跑。点了重跑就关上，跑完成没成都用一句提示说，结果另存一条，列表随主进程的"历史变了"重读。

const $ = (id) => document.getElementById(id);

/**
 * @param {{ getSetup: () => object | null }} deps 最近一次拿到的状态（平台的名字在 plaza.platforms 里）
 */
export function createRerunDialog({ getSetup }) {
  const dialog = $("history-rerun");
  const modes = $("history-rerun-modes");
  const needs = $("history-rerun-needs");
  const indicators = slidingIndicators(dialog);
  /** 开着的这一次：{ id, options, mode, picked: { 设置名: 选的值 } } */
  let current = null;

  const platformOf = (id) => getSetup()?.plaza.platforms.find((platform) => platform.id === id) ?? { id, name: id };

  /** 一项模型的名字：本机的写模型名，云端的写"平台 · 模型" */
  function labelOf({ hop }) {
    if (hop.platform === "local") return hop.name;
    const where = hop.platform === "custom" ? t("plaza.custom.name") : platformName(platformOf(hop.platform));
    return `${where} · ${hop.name}`;
  }

  /** 选中的那种方式：一行一项设置，下面说还差什么 */
  function draw() {
    for (const segment of modes.querySelectorAll(".segment")) {
      segment.setAttribute("aria-checked", String(segment.dataset.mode === current.mode));
    }
    indicators.place();
    const settings = current.options.modes[current.mode].settings;
    $("history-rerun-settings").replaceChildren(
      ...settings.map(({ name, role, choices }) => {
        const select = h("select", {
          class: "select",
          onchange: () => {
            current.picked[name] = select.value;
            drawNeeds();
          },
        });
        fillSelect(
          select,
          choices.map((choice) => [choice.value, labelOf(choice)]),
          current.picked[name],
        );
        return h("label", { class: "setting" }, h("span", { class: "setting-title", text: roleName(role) }), select);
      }),
    );
    drawNeeds();
  }

  function drawNeeds() {
    const picked = current.options.modes[current.mode].settings.map(({ name, choices }) =>
      choices.find(({ value }) => value === current.picked[name]),
    );
    const hops = picked.map(({ hop }) => hop);
    const missing = picked.flatMap((choice) => choice.needs).map((need) => needText(need, { hops, platformOf }));
    needs.textContent = missing.join(" · ");
    needs.hidden = missing.length === 0;
    $("history-rerun-run").disabled = missing.length > 0;
  }

  $("history-rerun-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const { id, mode, picked, options } = current;
    const settings = Object.fromEntries(options.modes[mode].settings.map(({ name }) => [name, picked[name]]));
    dialog.close();
    toast(t("rerun.running"));
    try {
      const result = await window.speakmore.rerunHistory({ id, mode, settings });
      toast(result.ok ? t("rerun.done") : t("rerun.failed", { reason: t.text(result.problem) }));
    } catch (error) {
      toast(t("rerun.failed", { reason: describeError(error) }));
    }
  });
  $("history-rerun-cancel").addEventListener("click", () => dialog.close());

  return {
    /** 打开某一条的重跑对话框；读不出能选什么（记录、录音不在了）时说一声，不弹一个空的 */
    async open(id) {
      let options;
      try {
        options = await window.speakmore.rerunOptions(id);
      } catch (error) {
        toast(t("rerun.optionsFailed", { reason: describeError(error) }));
        return;
      }
      const usable = (mode) => options.modes[mode].problem === null;
      current = {
        id,
        options,
        // 默认现在用的那种方式；它做不了这个功能时（离线做不了翻译）换成第一种做得了的
        mode: usable(options.mode) ? options.mode : Object.keys(options.modes).find(usable),
        picked: Object.fromEntries(
          Object.values(options.modes).flatMap(({ settings }) =>
            settings.map(({ name, current: value }) => [name, value]),
          ),
        ),
      };
      modes.replaceChildren(
        modes.querySelector(".indicator"),
        ...Object.entries(options.modes).map(([mode, { problem }]) =>
          h("button", {
            type: "button",
            class: "segment",
            role: "radio",
            "data-mode": mode,
            disabled: problem !== null,
            title: problem && t.text(problem),
            text: modeName(mode),
            onclick: () => {
              current.mode = mode;
              draw();
            },
          }),
        ),
      );
      dialog.showModal();
      // 打开以后才量得出分段的宽度，滑块要在这之后放；焦点放在选中的那种方式上
      indicators.reset();
      draw();
      modes.querySelector('[aria-checked="true"]')?.focus();
    },
  };
}
