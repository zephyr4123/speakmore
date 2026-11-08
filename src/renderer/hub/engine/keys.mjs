import { $, brand, h, platformName, svg } from "../../shared/dom.mjs";
import { t } from "../../shared/i18n.mjs";
import { roleName } from "./plaza-view.mjs";

// 引擎页的密钥面板：配置项不进树，标题行右边"密钥 n/m"点开，从窗口右边滑出（hub.html 的 #keys-sheet）。
// 每家一行：覆盖哪些环节、密钥在哪（已配置、环境变量、未配置），右边配置或更换；展开后是输入框、保存、获取密钥，
// 已配置的还能删除、检测。自定义服务另有地址、模型名、额外参数三格。存密钥交给主进程，先验证再存。

/**
 * @param {object} ctx 引擎页（page.mjs）
 */
export function createKeys(ctx) {
  const { ui, checks } = ctx;
  const sheet = $("keys-sheet");
  /** 从详情里点"配置密钥"来的：存好就收起面板，回到详情接着启用 */
  let back = false;

  /** 存了这把密钥之后能用的模型有几个（三个环节上这个平台卖的；划词那一排和整理是同一份，不重复数） */
  const newlyUsable = ({ coverage: { native, transcribe, polish } }) => native + transcribe + polish;

  function coverage(platform) {
    // 这一行的自定义服务是语音那边整理用的；划词的自定义服务在引擎页"划词"那一段自己填
    if (platform.id === "custom") return `${roleName("polish")} · ${t("plaza.custom.desc")}`;
    const parts = ["native", "transcribe", "polish"]
      .filter((role) => platform.coverage[role] > 0)
      .map((role) => `${roleName(role)} ${platform.coverage[role]}`);
    if (platform.coverage.lookup > 0) parts.push(`${t("plaza.segments.lookup")} ${platform.coverage.lookup}`);
    return `${t("plaza.keys.coverage")} ${parts.join(" · ")}`;
  }

  /** 检测一把密钥：拿这个平台的默认模型走它能走的那条路 */
  function checkCall(platform) {
    const { view } = ctx;
    if (platform.id === "custom") {
      const choice = view.customChoice();
      return () => window.speakmore.checkModel("local", { polish: choice, ...view.customExtra() });
    }
    if (platform.coverage.polish > 0) return () => window.speakmore.checkModel("local", { polish: platform.id });
    if (platform.coverage.native > 0) return () => window.speakmore.checkModel("native", { model: platform.id });
    return () => window.speakmore.checkModel("local", { transcriber: platform.id });
  }

  /** 润色正在交给自定义服务 */
  const customInUse = () => ctx.setup.plaza.mode === "local" && ctx.setup.plaza.chosen.polish.startsWith("custom/");

  /**
   * 自定义服务已经有密钥时改它的地址、模型名、额外参数：正在用它就当场换上（同启用，密钥在后台验），
   * 没在用就拿现有的密钥检测一下；填的留成草稿，启用时一起交
   */
  function updateCustom(changes, inUse) {
    const { polish, ...extra } = changes;
    if (inUse) return window.speakmore.setPolish(polish, extra);
    return window.speakmore.checkModel("local", changes);
  }

  /** 存好了：从详情来的收起面板回去 */
  function saved() {
    ui.openKey = null;
    if (back && sheet.open) sheet.close();
  }

  function keyForm(platform) {
    const { view } = ctx;
    const custom = platform.id === "custom";
    const name = platformName(platform);
    const key = `key:${platform.id}`;
    const filled = Boolean(platform.key);
    // 自定义服务那几格先填上：上次没交上去的，否则是要启用的草稿或设置里存的
    const shown = custom ? (ui.custom.form ?? view.customNow()) : null;
    const field = (id, props) => h("input", { class: "input", id, autocomplete: "off", spellcheck: "false", ...props });
    const checkable = filled && (!custom || (view.customChoice() && view.customNow().url));

    function submit(event) {
      event.preventDefault();
      const value = $(`plaza-key-${platform.id}`).value.trim();
      const typed = custom
        ? {
            url: $("plaza-custom-url").value.trim(),
            model: $("plaza-custom-model").value.trim(),
            params: $("plaza-custom-params").value.trim(),
          }
        : null;
      if (custom) ui.custom.form = typed;
      const changes =
        custom && typed.model
          ? { polish: `custom/${typed.model}`, customUrl: typed.url, customParams: typed.params }
          : undefined;
      /** 验证过了：和设置里存的不一样就记成草稿，等启用；一样就没有要换的 */
      const accept = () => {
        const stored = view.storedCustom();
        const same = typed.model === stored.model && typed.url === stored.url && typed.params === stored.params;
        ui.custom = { form: null, draft: same ? null : typed };
      };
      // 自定义服务已经有密钥、这次没填：只改地址、模型名或额外参数，不用再贴一遍密钥
      if (custom && value === "" && filled) {
        if (!changes) {
          ctx.failed(key, t("plaza.custom.modelMissing"));
          ctx.draw();
          return;
        }
        const inUse = customInUse();
        ctx.act(key, () => updateCustom(changes, inUse), {
          done: () => {
            // 正在用就已经换上了，往后照设置里存的
            if (inUse) ui.custom = { form: null, draft: null };
            else accept();
            saved();
            ctx.toast(t(inUse ? "plaza.toast.customUpdated" : "plaza.toast.customChecked"));
          },
        });
        return;
      }
      ctx.act(key, () => window.speakmore.saveKey(value, platform.id, changes), {
        done: () => {
          if (changes) accept();
          delete checks.results[key];
          saved();
          const count = newlyUsable(platform);
          ctx.toast(count > 0 ? t("plaza.toast.keySaved", { count }) : t("plaza.toast.keySavedOnly"));
        },
      });
    }

    return h(
      "form",
      // 地址写得不对由主进程按界面语言说（挂在这一行下面），不用浏览器自带的气泡：它跟着系统语言、样子也不一样
      { class: "key-entry", novalidate: true, onsubmit: submit },
      custom &&
        field("plaza-custom-url", {
          type: "url",
          value: shown.url,
          placeholder: t("plaza.custom.urlPlaceholder"),
          "aria-label": t("plaza.custom.url"),
        }),
      custom &&
        field("plaza-custom-model", {
          value: shown.model,
          placeholder: t("plaza.custom.modelPlaceholder"),
          "aria-label": t("plaza.custom.model"),
        }),
      field(`plaza-key-${platform.id}`, {
        type: "password",
        class: "input key-input",
        placeholder: custom && filled ? t("plaza.custom.keyKept") : t("plaza.keys.placeholder", { platform: name }),
        "aria-label": t("plaza.keys.label", { platform: name }),
      }),
      // 选填，放在密钥后面：多数服务用不上
      custom &&
        field("plaza-custom-params", {
          value: shown.params,
          placeholder: t("plaza.custom.paramsPlaceholder"),
          "aria-label": t("plaza.custom.params"),
          title: t("plaza.custom.paramsTip"),
        }),
      h(
        "div",
        { class: "key-entry-actions" },
        h("button", {
          type: "submit",
          class: "button primary",
          disabled: ctx.waiting(),
          text: t("plaza.keys.save"),
        }),
        platform.key === "stored" &&
          h("button", {
            type: "button",
            class: "button ghost",
            disabled: ctx.waiting(),
            text: t("plaza.keys.remove"),
            onclick: () =>
              ctx.act(key, () => window.speakmore.forgetKey(platform.id), {
                done: () => {
                  ui.openKey = null;
                  ctx.toast(t("plaza.toast.keyRemoved", { platform: name }));
                },
              }),
          }),
        h("span", { class: "key-entry-gap" }),
        platform.hasKeyPage &&
          h(
            "button",
            { type: "button", class: "key-link", onclick: () => window.speakmore.openKeyPage(platform.id) },
            t("plaza.keys.get"),
            svg("i-external-link"),
          ),
        checkable && checks.control(key, t("plaza.check.keyTip"), checkCall(platform)),
      ),
    );
  }

  function row(platform) {
    const open = ui.openKey === platform.id;
    const filled = Boolean(platform.key);
    const state = t(platform.key === "env" ? "plaza.keys.env" : filled ? "plaza.keys.stored" : "plaza.keys.none");
    return h(
      "div",
      { class: "key-row", "data-platform": platform.id, "data-open": open ? "" : null },
      h("span", { class: "logo-tile" }, brand(platform.id)),
      // 状态跟在名字后面，说明独占下面一整行：抽屉只有 30rem 宽，状态单占一列的话说明被挤到一个词一折
      h(
        "div",
        { class: "key-text" },
        h(
          "span",
          { class: "key-name-line" },
          h("span", { class: "key-name", text: platformName(platform) }),
          h(
            "span",
            {
              class: "key-state",
              "data-tone": filled ? "ok" : null,
              title: platform.key === "env" ? t("plaza.keys.envTip", { variable: platform.keyEnv }) : null,
            },
            h("i", { class: "dot", "data-tone": filled ? "ok" : "none" }),
            state,
          ),
        ),
        h("span", { class: "key-cover", text: coverage(platform) }),
      ),
      h("button", {
        type: "button",
        class: open ? "button ghost" : "button",
        disabled: !ctx.setup.switchable,
        "aria-expanded": String(open),
        text: t(open ? "plaza.keys.collapse" : filled ? "plaza.keys.replace" : "plaza.actions.configure"),
        onclick: () => {
          ui.openKey = open ? null : platform.id;
          // 自己点开、收起的：存好以后留在面板里
          back = false;
          ctx.draw();
          if (!open) focusForm(platform.id);
        },
      }),
      checks.note(`key:${platform.id}`),
      open && keyForm(platform),
    );
  }

  /** 刚展开的表单：光标放进第一个框（自定义服务是地址，别家是密钥） */
  function focusForm(id) {
    requestAnimationFrame(() => {
      const form = $(`plaza-key-${id}`)?.closest(".key-entry");
      form?.closest(".key-row")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      form?.querySelector(".input")?.focus({ preventScroll: true });
    });
  }

  function render() {
    const { platforms } = ctx.setup.plaza;
    const keyed = platforms.filter(({ key }) => key).length;
    $("keys-trigger").replaceChildren(
      svg("i-key-round"),
      h("span", { text: t("plaza.keys.title") }),
      h("span", { class: "count", text: `${keyed}/${platforms.length}` }),
    );
    $("keys-meta").textContent = t("plaza.keys.meta", { done: keyed, total: platforms.length });
    $("keys-home").textContent = t("plaza.keys.local", { home: ctx.setup.home });
    $("keys-list").replaceChildren(...platforms.map(row));
  }

  /**
   * 打开面板；给了平台就展开那一家的表单
   * @param {string | null} platform
   * @param {{ back?: boolean }} [options] back：从详情来的，存好就收起面板
   */
  function open(platform = null, options = {}) {
    back = Boolean(options.back && platform);
    ui.openKey = platform;
    ctx.draw();
    if (!sheet.open) sheet.showModal();
    if (platform) focusForm(platform);
  }

  $("keys-trigger").addEventListener("click", () => open(null));
  $("keys-close").addEventListener("click", () => sheet.close());
  // 点面板外面的暗处收起
  sheet.addEventListener("click", (event) => {
    if (event.target === sheet) sheet.close();
  });
  sheet.addEventListener("close", () => {
    const returning = back;
    // 表单里没交上去的不要了，验证过的草稿还留着
    ui.openKey = null;
    ui.custom.form = null;
    back = false;
    ctx.draw();
    // 从详情来的回详情，否则回到"密钥"按钮。按下的那个按钮在面板打开前就随详情重画换掉了，对话框自己记不住它
    if (returning) ctx.focusDetail();
    else $("keys-trigger").focus({ preventScroll: true });
  });

  return { render, open };
}
