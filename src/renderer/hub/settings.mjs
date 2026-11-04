import { LOCALES, SYSTEM_LOCALE } from "../../i18n/index.mjs";
import { fillSelect } from "../shared/dom.mjs";
import { createHotkeyEditor, recordBlocker } from "../shared/hotkey-editor.mjs";
import { t } from "../shared/i18n.mjs";
import { describeError, keyMissing, permissionDenied, permissionText } from "../shared/setup-text.mjs";
import { createTranslatePane } from "./translate-pane.mjs";

// 设置对话框：原版的"设置中心"，左边一列菜单，按功能分栏：通用（主题、界面语言、开机启动、存储位置、软件更新）、
// 快捷键（动作目录里的每个动作、悬浮条上的按键提示）、语音翻译（译成哪几种，translate-pane.mjs）、划词翻译（译成哪一种）、
// 本机模型（下载源、加速、内存）、权限、关于。
// 识别方式、模型和 key 不在这里：在侧栏的"引擎"一页（engine/）。
// 状态都在主进程，这里只负责画出来和转达用户的操作。

const $ = (id) => document.getElementById(id);

const PANES = ["general", "hotkeys", "voice-translate", "lookup", "local-models", "permissions", "about"];

/**
 * 还差的东西在哪补：key 在侧栏"引擎"一页的密钥表；权限、小帮手停了在设置的权限页（重新检查在那页）；
 * 装不上的热键在快捷键那一页。几样都差时按这个先后
 * @returns {{ route: "models", tab: "keys" } | { pane: string }}
 */
export function fixTarget(setup) {
  if (keyMissing(setup)) return { route: "models", tab: "keys" };
  if (permissionDenied(setup) || setup.helper === "stopped") return { pane: "permissions" };
  if (hotkeysTroubled(setup)) return { pane: "hotkeys" };
  return { pane: "general" };
}

/** 有动作的组合装不上、或退回了默认 */
const hotkeysTroubled = (setup) => (setup.hotkeyActions ?? []).some((action) => action.problems?.length);

/**
 * 软件更新那一行怎么显示：一句状态（语气、图标）和按钮做什么。按钮总是下一步该做的事：
 * 检查、更新到新版本、重试；进行中不给按。
 * @param {object} update 主进程给的（app/updates.mjs 的 describe）
 * @returns {{ text: string, tone: string, icon: string | null, action: "check" | "start" | null, label: string,
 *   primary: boolean, busy: boolean }}
 */
export function describeUpdate(update, t) {
  const check = t("preferences.update.check");
  const view = { tone: "", icon: null, action: "check", label: check, primary: false, busy: false };
  const { progress, current, latest } = update;
  if (update.fromSource) return { ...view, text: t("preferences.update.fromSource"), action: null };
  if (progress?.state === "running") {
    const text =
      progress.by === "cli"
        ? t("preferences.update.cliRunning", { version: progress.version ?? "…" })
        : progress.phase === "downloading"
          ? t("preferences.update.downloading", { version: progress.version })
          : progress.phase === "installing"
            ? t("preferences.update.installing")
            : t("preferences.update.checking");
    return { ...view, text, icon: "i-loader-circle", action: null, busy: true };
  }
  if (update.checking) {
    return { ...view, text: t("preferences.update.checking"), icon: "i-loader-circle", busy: true };
  }
  const retry = { tone: "problem", icon: "i-circle-alert", action: "start", label: t("preferences.update.retry") };
  if (update.launchProblem) {
    return { ...view, ...retry, text: t("preferences.update.startFailed", { reason: t.text(update.launchProblem) }) };
  }
  if (progress?.state === "failed") {
    return {
      ...view,
      ...retry,
      primary: true,
      text: t("preferences.update.failed", { problem: t.text(progress.problem) }),
    };
  }
  if (update.available) {
    // 这个 App 自己旧了说"新版本可用"；只是另一份（终端安装的、或者 SpeakMore.app）旧了，说是哪一份
    const { other } = update;
    const text = other
      ? t("preferences.update.otherBehind", {
          copy: t(`update.copies.${other.kind}`),
          current: other.version,
          latest,
        })
      : t("preferences.update.available", { latest, current });
    return {
      ...view,
      text,
      tone: "new",
      icon: "i-download",
      action: "start",
      label: t("preferences.update.updateTo", { version: latest }),
      primary: true,
    };
  }
  if (update.checkProblem) {
    return {
      ...view,
      text: t("preferences.update.checkFailed", { problem: t.text(update.checkProblem) }),
      tone: "problem",
      icon: "i-circle-alert",
    };
  }
  if (update.justUpdated) {
    return {
      ...view,
      text: t("preferences.update.updated", { version: update.justUpdated }),
      tone: "ok",
      icon: "i-check",
    };
  }
  // 还没问到过最新版本（没网、刚装好）：只说现在的版本
  if (latest === null) return { ...view, text: `v${current}` };
  return { ...view, text: t("preferences.update.upToDate", { version: current }), tone: "ok", icon: "i-check" };
}

/** 设置菜单、侧栏的设置图标上要不要标个点：有新版本，或者上一次更新没成（正在更新时不标） */
export const updateFlagged = (update) =>
  Boolean(update) && update.progress?.state !== "running" && (update.available || update.progress?.state === "failed");

/**
 * @param {{ refresh: () => Promise<object> }} options refresh：重新问主进程要一份状态，并让整个窗口跟着更新
 */
export function createSettings({ refresh }) {
  const dialog = $("settings");

  function showPane(pane) {
    const name = PANES.includes(pane) ? pane : "general";
    for (const section of dialog.querySelectorAll(".pane")) section.hidden = section.dataset.pane !== name;
    for (const item of dialog.querySelectorAll(".menu-item")) {
      if (item.dataset.pane === name) item.setAttribute("aria-current", "true");
      else item.removeAttribute("aria-current");
    }
  }

  // ---------- 通用：主题、界面语言、开机启动 ----------

  function renderGeneral(setup) {
    fillSelect(
      $("theme"),
      setup.theme.choices.map((id) => [id, t(`themes.${id}.name`)]),
      setup.theme.value,
    );
    // 跟随系统，再列出每种语言（名字用它自己的语言写）
    fillSelect(
      $("language"),
      [[SYSTEM_LOCALE, t("language.system")], ...LOCALES.map(({ id, name }) => [id, name])],
      setup.language.value,
    );
    // 听写成品的中文字形：简体，或者繁体（香港、台湾字形）
    fillSelect(
      $("output-script"),
      setup.outputScript.choices.map((id) => [id, t(`outputScripts.${id}`)]),
      setup.outputScript.value,
    );
    $("open-at-login").checked = setup.openAtLogin.enabled;
    $("open-at-login-row").hidden = !setup.openAtLogin.supported;
    $("dock-icon").checked = setup.dockIcon.shown;
    $("dock-icon-row").hidden = !setup.dockIcon.supported;
    // 录音时在悬浮条上预览暂定文字：只有本机识别能做
    $("live-preview").checked = setup.livePreview;
  }

  // ---------- 快捷键：每个动作的组合、悬浮条上的按键提示 ----------

  const hotkeyEditor = createHotkeyEditor($("hotkey-editor"), { onChanged: refresh });

  function renderHotkeys(setup) {
    hotkeyEditor.render(setup.hotkeyActions, { blocker: recordBlocker(setup) });
    $("bar-hint").checked = setup.barHint === "on";
  }

  // ---------- 语音翻译：译成哪几种 ----------

  const translatePane = createTranslatePane({ refresh });

  // ---------- 划词翻译：译成哪一种 ----------

  function renderLookup(setup) {
    fillSelect(
      $("lookup-to"),
      setup.lookup.choices.map((id) => [id, t(`languages.${id}`)]),
      setup.lookup.to,
    );
  }

  // ---------- 本机模型：下载源、加速、内存 ----------

  function renderLocalModels(setup) {
    fillSelect(
      $("model-source"),
      setup.local.source.choices.map((id) => [id, t(`modelSources.${id}`)]),
      setup.local.source.value,
    );
    fillSelect(
      $("acceleration"),
      setup.local.acceleration.choices.map((id) => [id, t(`accelerations.${id}`)]),
      setup.local.acceleration.value,
    );
    fillSelect(
      $("local-model-memory"),
      setup.local.memory.choices.map((id) => [id, t(`localModelMemories.${id}`)]),
      setup.local.memory.value,
    );
  }

  function showNote(id, message, tone = "") {
    $(id).textContent = t.text(message);
    $(id).dataset.tone = tone;
    $(id).hidden = !message;
  }

  $("theme").addEventListener("change", async (event) => {
    showNote("general-problem", null);
    showNote("theme-note", null);
    try {
      const result = await window.speakmore.setTheme(event.target.value);
      showNote("theme-note", result.note ?? null);
    } catch (error) {
      showNote("general-problem", t("preferences.themeFailed", { reason: describeError(error) }), "problem");
    }
    await refresh();
  });

  // 换了语言：主进程把这个窗口按新的语言重新加载，回到这一页；被环境变量盖着时语言不变，留在这里说一句
  $("language").addEventListener("change", async (event) => {
    showNote("general-problem", null);
    showNote("language-note", null);
    try {
      const result = await window.speakmore.setLanguage(event.target.value);
      showNote("language-note", result.note ?? null);
    } catch (error) {
      showNote("general-problem", t("preferences.languageFailed", { reason: describeError(error) }), "problem");
    }
    await refresh();
  });

  // 换了字形：存下来就行，悬浮条每次开口现读，下一次听写就按新的
  $("output-script").addEventListener("change", async (event) => {
    showNote("general-problem", null);
    showNote("output-script-note", null);
    try {
      const result = await window.speakmore.setOutputScript(event.target.value);
      showNote("output-script-note", result.note ?? null);
    } catch (error) {
      showNote("general-problem", t("preferences.outputScriptFailed", { reason: describeError(error) }), "problem");
    }
    await refresh();
  });

  // 录音时在悬浮条上预览暂定文字：存下来就行，服务端下一次录音现看开关
  $("live-preview").addEventListener("change", async (event) => {
    showNote("general-problem", null);
    showNote("live-preview-note", null);
    try {
      const result = await window.speakmore.setLivePreview(event.target.checked);
      showNote("live-preview-note", result.note ?? null);
    } catch (error) {
      showNote("general-problem", t("preferences.livePreviewFailed", { reason: describeError(error) }), "problem");
    }
    await refresh();
  });

  // 程序坞里显示不显示：主进程当场换
  $("dock-icon").addEventListener("change", async (event) => {
    showNote("general-problem", null);
    showNote("dock-icon-note", null);
    try {
      const result = await window.speakmore.setDockIcon(event.target.checked);
      showNote("dock-icon-note", result.note ?? null);
    } catch (error) {
      showNote("general-problem", t("preferences.dockIconFailed", { reason: describeError(error) }), "problem");
    }
    await refresh();
  });

  $("lookup-to").addEventListener("change", async (event) => {
    showNote("lookup-problem", null);
    showNote("lookup-note", null);
    try {
      const result = await window.speakmore.setLookupTo(event.target.value);
      if (result.ok === false) {
        showNote("lookup-problem", t("preferences.lookupFailed", { reason: t.text(result.problem) }), "problem");
      } else showNote("lookup-note", result.note ?? null);
    } catch (error) {
      showNote("lookup-problem", t("preferences.lookupFailed", { reason: describeError(error) }), "problem");
    }
    await refresh();
  });

  $("model-source").addEventListener("change", async (event) => {
    showNote("local-models-problem", null);
    showNote("source-note", null);
    try {
      const result = await window.speakmore.setModelSource(event.target.value);
      showNote("source-note", result.note ?? null);
    } catch (error) {
      showNote("local-models-problem", t("preferences.sourceFailed", { reason: describeError(error) }), "problem");
    }
    await refresh();
  });

  $("acceleration").addEventListener("change", async (event) => {
    showNote("local-models-problem", null);
    showNote("acceleration-note", null);
    try {
      const result = await window.speakmore.setAcceleration(event.target.value);
      showNote("acceleration-note", result.note ?? null);
    } catch (error) {
      showNote(
        "local-models-problem",
        t("preferences.accelerationFailed", { reason: describeError(error) }),
        "problem",
      );
    }
    await refresh();
  });

  $("local-model-memory").addEventListener("change", async (event) => {
    showNote("local-models-problem", null);
    showNote("local-model-memory-note", null);
    try {
      const result = await window.speakmore.setLocalModelMemory(event.target.value);
      showNote("local-model-memory-note", result.note ?? null);
    } catch (error) {
      showNote(
        "local-models-problem",
        t("preferences.localModelMemoryFailed", { reason: describeError(error) }),
        "problem",
      );
    }
    await refresh();
  });

  $("bar-hint").addEventListener("change", async (event) => {
    showNote("hotkeys-problem", null);
    showNote("bar-hint-note", null);
    try {
      const result = await window.speakmore.setBarHint(event.target.checked ? "on" : "off");
      showNote("bar-hint-note", result.note ?? null);
    } catch (error) {
      showNote("hotkeys-problem", t("preferences.barHintFailed", { reason: describeError(error) }), "problem");
    }
    await refresh();
  });

  $("open-at-login").addEventListener("change", async (event) => {
    showNote("general-problem", null);
    try {
      await window.speakmore.setOpenAtLogin(event.target.checked);
    } catch (error) {
      showNote("general-problem", t("preferences.loginFailed", { reason: describeError(error) }), "problem");
    }
    await refresh();
  });

  // ---------- 通用：软件更新 ----------

  /** 按钮现在做什么（describeUpdate 的 action） */
  let updateAction = null;

  function renderUpdate(update) {
    if (!update) return;
    const view = describeUpdate(update, t);
    const status = $("update-status");
    status.dataset.tone = view.tone;
    if (view.icon) status.dataset.icon = view.icon;
    else delete status.dataset.icon;
    const icon = status.querySelector(".icon");
    icon.classList.toggle("spin", view.icon === "i-loader-circle");
    icon.querySelector("use").setAttribute("href", `#${view.icon ?? "i-check"}`);
    $("update-status-text").textContent = view.text;
    const button = $("update-action");
    updateAction = view.action;
    button.hidden = view.action === null;
    button.textContent = view.label;
    button.disabled = view.busy;
    button.classList.toggle("primary", view.primary);
  }

  $("update-action").addEventListener("click", async () => {
    showNote("general-problem", null);
    const action = updateAction;
    try {
      if (action === "check") await window.speakmore.checkForUpdate();
      else if (action === "start") await window.speakmore.startUpdate();
    } catch (error) {
      const key = action === "start" ? "preferences.update.startFailed" : "preferences.update.checkFailed";
      const param = action === "start" ? { reason: describeError(error) } : { problem: describeError(error) };
      showNote("general-problem", t(key, param), "problem");
    }
    await refresh();
  });

  // ---------- 通用：存储位置 ----------

  $("storage-change").addEventListener("click", async () => {
    showNote("storage-note", null);
    $("storage-change").disabled = true;
    try {
      // 确认了的话主进程起搬家的进度窗口，这个 App 随后会退出
      await window.speakmore.changeStorage();
    } catch (error) {
      showNote("storage-note", t("preferences.storage.failed", { reason: describeError(error) }), "problem");
    } finally {
      $("storage-change").disabled = false;
    }
  });

  // ---------- 权限 ----------

  function renderPermissions(setup) {
    for (const row of dialog.querySelectorAll("[data-permission]")) {
      const name = row.dataset.permission;
      const [label, tone, action] = permissionText(name, setup.permissions[name], t);
      const granted = row.querySelector(".granted");
      granted.textContent = label;
      granted.dataset.tone = tone;
      row.querySelector("button").textContent = action;
    }
  }

  for (const row of dialog.querySelectorAll("[data-permission]")) {
    row
      .querySelector("button")
      .addEventListener("click", () => window.speakmore.openPrivacySettings(row.dataset.permission));
  }
  $("recheck").addEventListener("click", () => window.speakmore.recheckPermissions());

  // ---------- 关于 ----------

  $("open-homepage").addEventListener("click", () => window.speakmore.openHomepage());

  // ---------- 对话框本身 ----------

  for (const item of dialog.querySelectorAll(".menu-item")) {
    item.addEventListener("click", () => showPane(item.dataset.pane));
  }
  $("settings-close").addEventListener("click", () => dialog.close());
  // 点对话框外面的那层暗底也关掉
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    const inside =
      event.clientX >= box.left &&
      event.clientX <= box.right &&
      event.clientY >= box.top &&
      event.clientY <= box.bottom;
    if (!inside) dialog.close();
  });

  return {
    /** @param {string} [pane] 打开哪一页 */
    open(pane = "general") {
      showPane(pane);
      if (!dialog.open) dialog.showModal();
    },

    render(setup) {
      renderGeneral(setup);
      renderHotkeys(setup);
      translatePane.render(setup);
      renderLookup(setup);
      renderLocalModels(setup);
      renderPermissions(setup);
      $("about-version").textContent = `v${setup.version}`;
      $("storage-path").textContent = setup.home;
      $("storage-path").title = setup.home;
      renderUpdate(setup.update);
      // 菜单上标个点：权限、快捷键这两页有东西要补（红点），通用这一页有更新的事（见下），侧栏的设置图标上也标
      const update = updateFlagged(setup.update);
      const flagged = { permissions: permissionDenied(setup), hotkeys: hotkeysTroubled(setup), general: update };
      for (const dot of dialog.querySelectorAll(".menu-dot")) dot.hidden = !flagged[dot.dataset.for];
      // 有新版本是主题色的点，上一次没更新成是红点
      const tone = setup.update?.progress?.state === "failed" ? "problem" : "new";
      dialog.querySelector('.menu-dot[data-for="general"]').dataset.tone = tone;
      $("settings-dot").hidden = !update;
      $("settings-dot").dataset.tone = tone;
    },
  };
}
