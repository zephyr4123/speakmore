import { localize, t } from "../shared/i18n.mjs";
import { createEngine } from "./engine/page.mjs";
import { createHistory } from "./history.mjs";
import { createHome } from "./home.mjs";
import { createModeChip } from "./mode-chip.mjs";
import { createPresetPicker } from "./preset-picker.mjs";
import { createSettings, fixTarget } from "./settings.mjs";
import { createVocabulary } from "./vocabulary.mjs";

// 主窗口：对应原版的 hub.html。左边侧栏切换首页、引擎、历史记录和词典，设置是盖在上面的对话框。
// 识别方式和各种方式里用的模型都在引擎页换（engine/page.mjs，路由名还是 models）；首页标题旁只显示正在用哪种方式，
// 点一下去引擎页（mode-chip.mjs）。引擎页标题旁是推荐组合（preset-picker.mjs）：方式和模型一起换成一套。
// 数据都在主进程：有新记录、记了新的账时它通知这里重读；能不能用、还差什么变了时也一样。

const $ = (id) => document.getElementById(id);
const ROUTES = ["home", "models", "history", "vocabulary"];

// 页面上写死的字先按界面语言填上，下面各块再画自己的
localize();

const home = createHome();
const history = createHistory({ getSetup: () => setup });
const vocabulary = createVocabulary();
const settings = createSettings({ refresh: refreshSetup });
const engine = createEngine({ refresh: refreshSetup });
const presetPicker = createPresetPicker({
  refresh: refreshSetup,
  configureKey: (platform) => engine.show({ platform }),
});
/** 去引擎页换识别方式：语音那一段的第一列（上次停在划词段也换回来） */
function openModes() {
  navigate("models");
  engine.show({ section: "voice" });
}
const modeChip = createModeChip({ open: openModes });

/** 最近一次拿到的状态：横幅、设置对话框都按它画 */
let setup = null;

function navigate(route) {
  const name = ROUTES.includes(route) ? route : "home";
  for (const page of document.querySelectorAll(".page")) page.hidden = page.dataset.route !== name;
  for (const item of document.querySelectorAll(".nav-item")) {
    if (item.dataset.route === name) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  }
  document.querySelector(".content").scrollTop = 0;
  document.querySelector(".content").removeAttribute("data-scrolled");
  if (name === "models") engine.shown();
  else engine.hidden();
  if (name === "home") home.shown();
  if (name === "vocabulary") vocabulary.shown();
  if (name === "history") history.shown();
  // 记在地址里：换语言时页面重新加载，回到的还是这一页。打开时带的 pane 也一并去掉，免得重新加载时设置又弹出来
  window.history.replaceState(null, "", `?route=${name}`);
}

/**
 * 顶上那一条：还差什么才能用，或者能用但打了折扣。准备中、都齐了时不出现。
 * 差的是这种识别方式要的东西（key、本机模型）时，除了去补，也能直接换一种方式：哪种方式都随时能换
 */
function renderBanner(current) {
  const { summary } = current;
  const banner = $("banner");
  const wayIncomplete =
    ["missing", "unreadable", "rejected"].includes(current.key.state) ||
    ["missing", "failed"].includes(current.localModel?.state);
  $("banner-switch").hidden = !(summary.missing.length > 0 && wayIncomplete && current.switchable);
  if (summary.missing.length > 0) {
    banner.dataset.tone = "problem";
    $("banner-text").textContent = t("hub.missing", { items: t.list(summary.missing) });
  } else if (summary.degraded !== null) {
    banner.dataset.tone = "soft";
    $("banner-text").textContent = t.text(summary.degraded);
  } else {
    banner.hidden = true;
    return;
  }
  banner.hidden = false;
}

async function refreshSetup() {
  setup = await window.speakmore.getSetup();
  renderBanner(setup);
  settings.render(setup);
  engine.render(setup);
  modeChip.render(setup);
  presetPicker.render(setup);
  // 换了识别方式，词典页标题下面那一行（词随不随请求发出）跟着变
  if (!document.querySelector('.page[data-route="vocabulary"]').hidden) await vocabulary.shown();
  return setup;
}

async function refreshData() {
  try {
    const [usage, insights, app] = await Promise.all([
      window.speakmore.usageReport(),
      window.speakmore.insights(),
      window.speakmore.appInfo(),
    ]);
    home.render({ insights, usage, app });
    // 历史自己管搜索和筛选（history.mjs）：这里只请它重读，搜索的字、选了哪个功能都由它自己带
    await history.refresh();
  } catch (error) {
    console.error("刷新失败", error);
    history.showError(error instanceof Error ? error.message : String(error));
  }
}

// ---------- 用户的操作 ----------

for (const item of document.querySelectorAll(".nav-item")) {
  item.addEventListener("click", () => navigate(item.dataset.route));
}
$("open-settings").addEventListener("click", () => settings.open("general"));
$("open-about").addEventListener("click", () => settings.open("about"));
/** 补上还差的东西：缺 key 去引擎页的密钥面板，缺权限去设置的权限页 */
function openFix() {
  const target = setup ? fixTarget(setup) : { pane: "general" };
  if (target.route) {
    navigate(target.route);
    engine.show({ tab: target.tab });
  } else settings.open(target.pane);
}
$("banner-action").addEventListener("click", openFix);
// 换一种识别方式
$("banner-switch").addEventListener("click", openModes);
// 往下滚了，最上面那条拖窗口的地方变成玻璃
const content = document.querySelector(".content");
content.addEventListener("scroll", () => content.toggleAttribute("data-scrolled", content.scrollTop > 4), {
  passive: true,
});

// ---------- 主进程来的 ----------

window.speakmore.onHistoryChanged(refreshData);
window.speakmore.onSetupChanged(refreshSetup);
// 菜单栏、命令行、首次引导要打开某一页（"显示历史记录"、"设置…"、"前往引擎"）
window.speakmore.onNavigate(({ route, pane, engine: section, presets }) => {
  if (route) navigate(route);
  // 引擎页的哪一段（划词卡片上的"配置密钥"要划词那一段）
  if (section) engine.show({ section });
  // 首次引导的"前往引擎"：弹出推荐组合，一套一套直接启用
  if (presets) presetPicker.open();
  if (pane === "auto") openFix();
  else if (pane) settings.open(pane);
});

// 第一次打开时要去哪一页，主进程写在地址里
const params = new URLSearchParams(location.search);
navigate(params.get("route") ?? "home");
await Promise.all([refreshSetup(), refreshData()]);
if (params.get("engine")) engine.show({ section: params.get("engine") });
if (params.get("presets")) presetPicker.open();
if (params.get("pane") === "auto") openFix();
else if (params.get("pane")) settings.open(params.get("pane"));
