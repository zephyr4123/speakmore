import { h, svg } from "../shared/dom.mjs";
import { t } from "../shared/i18n.mjs";
import { describeError } from "../shared/setup-text.mjs";

// 设置 › 翻译 › 语音翻译：译成哪几种（设置里的 translate.to），一行一种，第一行是默认。
// 别的行悬停时出现"设为默认"和 ×；底下一个"添加"，点开是还没加的语言。悬浮条上的语言胶囊列的就是这几种。

const $ = (id) => document.getElementById(id);
const languageName = (id) => t(`languages.${id}`);

/**
 * @param {{ refresh: () => Promise<object> }} options 改完重读一遍设置
 */
export function createTranslatePane({ refresh }) {
  const list = $("translate-targets");

  function showNote(id, message, tone = "") {
    $(id).textContent = message ? t.text(message) : "";
    $(id).dataset.tone = tone;
    $(id).hidden = !message;
  }

  async function save(next) {
    showNote("voice-translate-problem", null);
    showNote("translate-note", null);
    try {
      const result = await window.speakmore.setTranslateTo(next);
      showNote("translate-note", result.note ?? null);
    } catch (error) {
      showNote(
        "voice-translate-problem",
        t("preferences.translateFailed", { reason: describeError(error) }),
        "problem",
      );
    }
    await refresh();
  }

  /** 一行：语言名；第一行写"默认"，别的行悬停出现"设为默认"和 × */
  function row(id, index, targets) {
    const name = languageName(id);
    const side =
      index === 0
        ? h("span", { class: "language-default", text: t("preferences.translateDefault") })
        : h(
            "span",
            { class: "language-actions" },
            h("button", {
              type: "button",
              class: "button small ghost",
              text: t("preferences.translateMakeDefault"),
              onclick: () => save([id, ...targets.filter((other) => other !== id)]),
            }),
            h(
              "button",
              {
                type: "button",
                class: "icon-button",
                "aria-label": t("preferences.translateRemove", { language: name }),
                title: t("preferences.translateRemove", { language: name }),
                onclick: () => save(targets.filter((other) => other !== id)),
              },
              svg("i-close"),
            ),
          );
    return h("li", { class: "language-row" }, h("span", { class: "language-name", text: name }), side);
  }

  /** 添加：一个胶囊按钮样子的下拉框，选项是还没加的语言，选了就加在最后 */
  function addRow(targets, { choices, max }) {
    if (targets.length >= max) return null;
    const rest = choices.filter((id) => !targets.includes(id));
    const select = h(
      "select",
      { class: "select add-language", "aria-label": t("preferences.translateAdd") },
      h("button", { type: "button" }, svg("i-plus"), h("span", { text: t("preferences.translateAdd") })),
      // 不选任何一项时显示的那个（不在单子里）
      h("option", { value: "", hidden: true, selected: true }),
      ...rest.map((id) => new Option(languageName(id), id)),
    );
    select.addEventListener("change", () => {
      if (select.value) save([...targets, select.value]);
    });
    return h("li", { class: "language-add" }, select);
  }

  return {
    /** @param {{ translate: { to: string[], choices: string[], max: number } }} setup */
    render({ translate }) {
      list.replaceChildren(
        ...translate.to.map((id, index) => row(id, index, translate.to)),
        ...[addRow(translate.to, translate)].filter(Boolean),
      );
    },
  };
}
