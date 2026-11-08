import { chordKeycaps, sortChord } from "../../hotkeys/chord.mjs";
import { h, svg } from "../shared/dom.mjs";
import { recordBlocker } from "../shared/hotkey-editor.mjs";
import { localize, t } from "../shared/i18n.mjs";
import { meterLevels, openMicrophone } from "../shared/level-meter.mjs";
import { describeError, permissionGranted } from "../shared/setup-text.mjs";
import { engineReady, FEATURES, PERMISSIONS, permissionsOff, stepDone, stepsFor } from "./flow.mjs";
import { actionOfChord, createGesture, helperPassed } from "./key-check.mjs";
import { createScene, PLAY_MS } from "./scene.mjs";

// 首次引导：开屏 → 功能 → 快捷键 → 权限（只有 Mac）→ 引擎（flow.mjs）。哪一步都能退回去、往前跳、跳过。
// 引导里不选识别方式、不填密钥、不下模型：最后一步把人送到主窗口的引擎页（弹出推荐组合），在那里配。
// 快捷键那一步两路都认（key-check.mjs）：窗口自己收到的按键，和小帮手转来的（主进程的 onboarding:hotkey）。
// 状态都在主进程，这里管走到哪一步、每一步怎么画。走完了主进程关掉这个窗口、打开主窗口。

const $ = (id) => document.getElementById(id);
const STEPS = stepsFor(window.speakmore.platform);
/** 顶上那几段：开屏不算 */
const GROUPS = STEPS.filter((step) => step !== "splash");
/** 麦克风那一行几根电平条，中间的高、两边的矮 */
const LEVEL_SHAPE = [0.5, 0.8, 1, 0.8, 0.5];

localize();

let setup = null;
let step = null;
/** 快捷键那一步按到了哪几个功能 */
const passed = new Set();
/** 输入监控开了以后，小帮手转来过按键没有 */
let listenTested = false;

async function refresh() {
  setup = await window.speakmore.getSetup();
  render();
}

/** 这个功能现在装着的组合：画键帽、演示按的都是第一个；一个都没有（划词翻译能清空）是 [] */
const chordOf = (feature) => setup.hotkeyActions.find((action) => action.id === feature)?.inEffect[0] ?? [];
const actionName = (feature) => t(`actions.${feature}.name`);

/** 一个组合的一排键帽，每块记着自己是哪个键（按下时让对应的那块亮） */
const keycaps = (codes) =>
  sortChord(codes).map((code) =>
    h("kbd", { class: "keycap", "data-code": code, text: t.text(chordKeycaps([code])[0]) }),
  );

/** 结论：一个勾加一句 */
const done = (text) => h("span", { class: "done" }, svg("i-check"), h("span", { text }));

// ---------- 顶上几段 ----------

function renderGroups() {
  const index = GROUPS.indexOf(step);
  $("groups").replaceChildren(
    ...GROUPS.map((each, i) =>
      h(
        "li",
        {},
        h("button", {
          type: "button",
          "data-state": i < index ? "done" : i === index ? "current" : "todo",
          "aria-current": i === index ? "step" : "false",
          text: t(`onboarding.groups.${each}`),
          onclick: () => go(each),
        }),
      ),
    ),
  );
}

// ---------- 功能：只演示 ----------

const scene = createScene($("scene"), {
  platform: window.speakmore.platform,
  chords: () => Object.fromEntries(FEATURES.map((feature) => [feature, chordOf(feature)])),
});
/** 正在放哪一项 */
let playing = FEATURES[0];
let loopRun = 0;

function renderFeatures() {
  $("key-tests").replaceChildren(
    ...FEATURES.map((feature) => {
      const current = feature === playing;
      return h(
        "li",
        {
          class: "key-test",
          "data-feature": feature,
          "aria-current": current ? "true" : null,
          "data-playing": current ? "" : null,
          style: current ? `--dur: ${PLAY_MS[feature]}ms` : null,
          onclick: () => loop(feature, { pinned: true }),
        },
        h("span", { class: "key-test-line", "aria-hidden": "true" }),
        h("span", { class: "key-test-name", text: actionName(feature) }),
        h("span", { class: "keycaps" }, ...keycaps(chordOf(feature))),
      );
    }),
  );
}

/** 没人动时三项一项接一项轮着放；点了哪一项就只循环放那一项。离开这一步就停 */
async function loop(start, { pinned = false } = {}) {
  const ticket = ++loopRun;
  await scene.ready;
  let index = FEATURES.indexOf(start);
  while (ticket === loopRun && step === "features") {
    const feature = FEATURES[index];
    playing = feature;
    renderFeatures();
    const finished = await scene.play(feature, { onPress: () => flash(feature) });
    if (!finished || ticket !== loopRun) return;
    if (!pinned) index = (index + 1) % FEATURES.length;
  }
}

/** 时间线上按下快捷键的那一下：这一项的键帽亮一下 */
function flash(feature) {
  const node = $("key-tests").querySelector(`[data-feature="${feature}"]`);
  node?.setAttribute("data-pressed", "");
  setTimeout(() => node?.removeAttribute("data-pressed"), 260);
}

// ---------- 快捷键 ----------

/** 窗口自己收到的按键 */
const gesture = createGesture();
/** 小帮手说正按着的那个功能 */
let helperHeld = null;
/**
 * 正在重录的那一个：{ feature, token, codes, reason }；没在录是 null。录键在主进程和小帮手那边（app/hotkey-recording.mjs），
 * 和设置页同一路：存的时候查冲突、两键以内这些规矩
 */
let recording = null;
let lastToken = 0;
/** 每个功能那一行下面的一句话（重录被拒的原因、录不了的原因） */
const notes = new Map();

/** 小帮手听不听得到键：听得到时空格、回车会被它吞掉，窗口收不全，只认它转来的 */
const helperHears = () => setup.helper === "running" && setup.permissions.listen === true;

function renderKeys() {
  // 还没按到的头一个：键帽一明一暗，等人按
  const next = FEATURES.find((feature) => !passed.has(feature));
  $("key-rows").replaceChildren(
    ...FEATURES.map((feature) => {
      const live = recording?.feature === feature ? recording : null;
      const chord = chordOf(feature);
      const note = live?.reason ?? notes.get(feature);
      let caps;
      if (live) {
        caps =
          live.codes.length > 0
            ? h("span", { class: "keycaps big" }, ...keycaps(live.codes))
            : h("span", { class: "chord-prompt", text: t("onboarding.keys.record") });
      } else if (chord.length > 0) caps = h("span", { class: "keycaps big" }, ...keycaps(chord));
      else caps = h("span", { class: "hint-text", text: t("onboarding.engine.unset") });
      return h(
        "li",
        {
          "data-feature": feature,
          "data-await": feature === next && !live && chord.length > 0 ? "" : null,
          "data-held": helperHeld === feature ? "" : null,
        },
        h("span", { class: "key-row-name", text: actionName(feature) }),
        caps,
        h(
          "span",
          { class: "key-row-state" },
          passed.has(feature)
            ? done(t("onboarding.keys.passed"))
            : h("span", { class: "hint-text", text: t("onboarding.keys.press") }),
        ),
        h("button", {
          type: "button",
          class: "button ghost small",
          "data-recording": live ? "" : null,
          text: t("onboarding.keys.change"),
          onclick: () => (live ? stopRecording("reclick") : startRecording(feature)),
        }),
        note ? h("p", { class: "key-row-note", role: "status", text: t.text(note) }) : null,
      );
    }),
  );
  lightHeld();
}

/** 按着的键：同一个键的键帽一起亮；小帮手说正按着哪个功能，那一行的键帽全亮（被它吞掉的键窗口看不到） */
function lightHeld() {
  for (const cap of document.querySelectorAll(":is(.key-rows, .grants) kbd[data-code]")) {
    const row = cap.closest("[data-feature], [data-permission]");
    const byHelper = row?.dataset.feature ? row.dataset.feature === helperHeld : helperHeld !== null;
    cap.toggleAttribute("data-down", gesture.held.has(cap.dataset.code) || byHelper);
  }
}

function startRecording(feature) {
  notes.delete(feature);
  const blocker = recordBlocker(setup);
  if (blocker !== null) {
    notes.set(feature, t(blocker));
    renderKeys();
    return;
  }
  const token = ++lastToken;
  recording = { feature, token, codes: [], reason: null };
  syncCapture();
  renderKeys();
  window.speakmore.recordHotkey(feature, 0, token).catch((error) => {
    if (recording?.token !== token) return;
    recording = null;
    notes.set(feature, describeError(error));
    syncCapture();
    renderKeys();
  });
}

/** reason 记进日志（app/hotkey-recording.mjs 的 PAGE_REASONS） */
function stopRecording(reason) {
  if (recording === null) return;
  recording = null;
  window.speakmore.stopRecordingHotkey(reason);
  syncCapture();
  renderKeys();
}

window.speakmore.onHotkeyRecording((payload) => {
  if (recording === null || payload.token !== recording.token) return;
  const { feature } = recording;
  if (payload.state === "recording") {
    // 被拒的原因留到下一次按下：全部松开时的那份空快照不能把它冲掉
    recording = { ...recording, codes: payload.codes, reason: payload.codes.length > 0 ? null : recording.reason };
  } else if (payload.state === "rejected") {
    recording = { ...recording, codes: payload.codes, reason: payload.reason };
  } else {
    recording = null;
    // 存好了：换了键，得重新按一下
    if (payload.state === "saved") {
      passed.delete(feature);
      if (payload.note) notes.set(feature, payload.note);
      refresh();
    }
    syncCapture();
  }
  renderKeys();
});

/** 按的这一下认成了哪个功能：快捷键那一步算它按到了；权限那一步算小帮手那一路通了 */
function pressed(feature) {
  if (step === "keys") {
    passed.add(feature);
    notes.delete(feature);
  } else if (step === "permissions") listenTested = true;
  render();
}

/** 窗口收键的时候：快捷键那一步（没在重录） */
const windowListens = () => step === "keys" && recording === null;

window.addEventListener("keydown", (event) => {
  if (!windowListens() || event.repeat) return;
  // 组合里的空格、回车不让它点到按钮（单按照常，键盘还能用来点"继续"）
  if (gesture.held.size > 0 || event.code.startsWith("Alt")) event.preventDefault();
  gesture.down(event.code);
  lightHeld();
});

window.addEventListener("keyup", (event) => {
  if (!windowListens()) return;
  const chord = gesture.up(event.code);
  lightHeld();
  if (chord === null || helperHears()) return;
  const feature = actionOfChord(setup.hotkeyActions, chord);
  if (feature) pressed(feature);
});

// 切走了窗口：按着的都算松开，免得键帽一直亮着
window.addEventListener("blur", () => {
  gesture.reset();
  helperHeld = null;
  lightHeld();
});

// 小帮手转来的：{ action, event, down }。主进程只在这个窗口要了（captureHotkey）、人正看着它时才转
window.speakmore.onOnboardingHotkey((event) => {
  if (event.event === "binding" && event.down) helperHeld = event.action;
  else if (helperHeld === event.action) helperHeld = null;
  lightHeld();
  const feature = helperPassed(event);
  if (feature) pressed(feature);
});

/** 要不要主进程把热键转到这里（不去开悬浮条、不弹卡片）：快捷键那一步，和权限那一步输入监控开了以后 */
let capturing = false;
function syncCapture() {
  const wanted =
    (step === "keys" && recording === null) ||
    (step === "permissions" && permissionGranted("listen", setup.permissions.listen) === true);
  if (wanted === capturing) return;
  capturing = wanted;
  window.speakmore.captureHotkey(wanted);
}

// ---------- 权限 ----------

const PERMISSION_ICONS = { microphone: "i-mic", listen: "i-keyboard", trusted: "i-person-standing" };

function renderGrants() {
  $("grants").replaceChildren(
    ...PERMISSIONS.map((name) => {
      const granted = permissionGranted(name, setup.permissions[name]);
      let state;
      if (granted === null) state = h("span", { class: "hint-text", text: t("permissions.checking") });
      else if (!granted) {
        state = h("button", {
          type: "button",
          class: "button",
          text: t("onboarding.permissions.allow"),
          onclick: () => window.speakmore.openPrivacySettings(name),
        });
      } else
        state = done(name === "listen" && listenTested ? t("onboarding.keys.passed") : t("onboarding.permissions.on"));
      return h(
        "li",
        { "data-permission": name, "data-granted": String(granted === true) },
        svg(PERMISSION_ICONS[name], "icon row-icon"),
        h("p", { class: "grant-primary", text: t(`permissions.${name}`) }),
        granted === true ? check(name) : h("span"),
        state,
      );
    }),
  );
  lightHeld();
}

/** 开了以后当场测的那一块：麦克风出电平；输入监控请人按一下语音输入的键，按过了键帽保持亮着 */
function check(name) {
  if (name === "microphone") {
    return h("span", { class: "level", id: "level", "aria-hidden": "true" }, ...LEVEL_SHAPE.map(() => h("i")));
  }
  if (name === "listen") {
    return h(
      "span",
      { class: "press", "data-await": listenTested ? null : "", "data-tested": listenTested ? "" : null },
      listenTested ? null : h("span", { text: t("onboarding.permissions.press") }),
      h("span", { class: "keycaps" }, ...keycaps(chordOf("dictate"))),
    );
  }
  return h("span");
}

let meter = null;
let stream = null;
/** 第几次打开麦克风：等麦克风回来时对不上号的就是过时了的（人已经离开了这一步） */
let meterRun = 0;

/** 权限那一步、麦克风开着：那一行的几根条跟着音量动 */
async function startMeter() {
  if (meter !== null || stream !== null) return;
  const run = ++meterRun;
  let opened;
  try {
    opened = await openMicrophone();
  } catch (error) {
    // 开不了不拦着往下走：那一行照样写着"已开启"，原因记下来
    console.warn("测麦克风时打不开", describeError(error));
    return;
  }
  if (run !== meterRun) {
    for (const track of opened.getTracks()) track.stop();
    return;
  }
  stream = opened;
  meter = meterLevels(stream, (level) => {
    const bars = $("level")?.children;
    if (!bars) return;
    // 说话的音量一般只到满格的一两成，放大一点才看得出在动
    const loud = Math.min(1, level * 4);
    [...bars].forEach((bar, i) => {
      bar.style.setProperty("--h", (0.18 + loud * LEVEL_SHAPE[i] * (0.7 + Math.random() * 0.3)).toFixed(3));
    });
  });
}

function stopMeter() {
  meterRun += 1;
  meter?.stop();
  meter = null;
  for (const track of stream?.getTracks() ?? []) track.stop();
  stream = null;
}

// ---------- 引擎 ----------

function renderSummary() {
  const off = permissionsOff(setup);
  const untested = FEATURES.filter((feature) => !passed.has(feature)).length;
  const row = (icon, name, ok, text, target) =>
    h(
      "li",
      { "data-ok": String(ok) },
      svg(icon, "icon row-icon"),
      h("span", { class: "summary-name", text: name }),
      ok
        ? done(text)
        : target
          ? h("button", { type: "button", class: "link", text, onclick: () => go(target) })
          : h("span", { class: "status-dot", text }),
    );
  const ready = engineReady(setup);
  $("summary").replaceChildren(
    row(
      "i-keyboard",
      t("preferences.hotkey"),
      untested === 0,
      untested === 0 ? t("onboarding.keys.passed") : t("onboarding.engine.untested", { count: untested }),
      "keys",
    ),
    STEPS.includes("permissions")
      ? row(
          "i-shield-check",
          t("preferences.permissions"),
          off === 0,
          off === 0 ? t("onboarding.permissions.on") : t("onboarding.engine.missing", { count: off }),
          "permissions",
        )
      : null,
    row("i-workflow", t("hub.models"), ready, t(ready ? "onboarding.engine.ready" : "onboarding.engine.unset"), null),
  );
}

// ---------- 走到哪一步 ----------

/** 这一步配的东西在主窗口哪里随时能改：图标和主窗口里那个入口一样（设置是齿轮，引擎是侧栏那个图标） */
const WHERE = {
  keys: { icon: "i-settings", path: () => [t("hub.settings"), t("preferences.hotkey")] },
  permissions: { icon: "i-settings", path: () => [t("hub.settings"), t("preferences.permissions")] },
  engine: { icon: "i-workflow", path: () => [t("hub.models")] },
};

function renderWhere() {
  const where = WHERE[step];
  if (!where) {
    $("where").replaceChildren();
    return;
  }
  const place = h("span", { class: "where-path" }, svg(where.icon), where.path().join(" › "));
  $("where").replaceChildren(...t.parts("onboarding.where", { place }));
}

/** 离开、进入某一步时要做的 */
const leave = {
  features: () => {
    loopRun += 1;
    scene.stop();
  },
  keys: () => {
    stopRecording("left");
    gesture.reset();
  },
  permissions: () => stopMeter(),
};
const enter = {
  features: () => loop(playing),
};

function go(next) {
  if (next === step) return;
  if (step) leave[step]?.();
  step = next;
  helperHeld = null;
  document.body.dataset.step = step;
  for (const section of document.querySelectorAll(".step")) section.hidden = section.dataset.step !== step;
  $("stage").scrollTop = 0;
  // 换语言时页面重新加载：记在地址里，回到的还是这一步
  history.replaceState(null, "", `?step=${step}`);
  enter[step]?.();
  render();
}

const goBy = (offset) => go(STEPS[Math.min(STEPS.length - 1, Math.max(0, STEPS.indexOf(step) + offset))]);

function render() {
  if (setup === null || step === null) return;
  syncCapture();
  renderGroups();
  renderWhere();
  if (step === "features") renderFeatures();
  if (step === "keys") renderKeys();
  if (step === "permissions") {
    renderGrants();
    if (permissionGranted("microphone", setup.permissions.microphone)) startMeter();
    else stopMeter();
  }
  if (step === "engine") renderSummary();

  // 底下：返回（开屏没有）、跳过引导、继续。开屏有自己的"开始"，引擎页有自己的"前往引擎"。
  // 开屏的"继续"只是看不见、照样占着位置：不然"跳过引导"在开屏挪到最右边，到下一步又往左挪
  $("back").style.visibility = step === STEPS[0] ? "hidden" : "visible";
  $("skip-all").hidden = step === "engine";
  const next = $("next");
  next.hidden = step === "engine";
  next.style.visibility = step === "splash" ? "hidden" : "visible";
  // 这一步做完了"继续"是主按钮，没做完写"稍后配置"（照样能往下走）
  const finished = stepDone(step, { passed, setup });
  next.textContent = t(finished ? "onboarding.next" : "onboarding.skip");
  next.classList.toggle("primary", finished);
}

// ---------- 用户的操作 ----------

$("start").addEventListener("click", () => go("features"));
$("back").addEventListener("click", () => goBy(-1));
$("next").addEventListener("click", () => goBy(1));
$("skip-all").addEventListener("click", () => window.speakmore.finishOnboarding());
$("later").addEventListener("click", () => window.speakmore.finishOnboarding());
// 去引擎页：主窗口打开引擎页，弹出推荐组合
$("go-engine").addEventListener("click", () => window.speakmore.finishOnboarding({ engine: true }));

// ---------- 主进程来的 ----------

window.speakmore.onSetupChanged(refresh);

await refresh();
const wanted = new URLSearchParams(location.search).get("step");
go(STEPS.includes(wanted) ? wanted : STEPS[0]);
