import { spawn } from "node:child_process";
import { closeSync, existsSync, openSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, extname, join } from "node:path";
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  safeStorage,
  screen,
  shell,
  systemPreferences,
  Tray,
} from "electron";
import { ALREADY_RUNNING_EXIT_CODE, startControlServer } from "../control.mjs";
import { ACTIONS, actionOf, defaultChords, MAX_CHORDS, SPOKEN_ACTIONS } from "../hotkeys/actions.mjs";
import {
  actionOfBinding,
  bindingTable,
  boundProblems,
  describeHotkeyProblem,
  resolveHotkeys,
} from "../hotkeys/bindings.mjs";
import { chordString, chordsName, chordsText } from "../hotkeys/chord.mjs";
import { isModifier, nativeCode } from "../hotkeys/keys.mjs";
import { chordsOf, chordsValue, settingNameOf } from "../hotkeys/settings.mjs";
import { refineWarning } from "../hotkeys/validate.mjs";
import { createTranslator, LocalizedError, msg, problemOf, resolveLocale, SYSTEM_LOCALE } from "../i18n/index.mjs";
import { createInstance } from "../instance.mjs";
import { LANGUAGES } from "../languages.mjs";
import { alsoLogTo, log } from "../log.mjs";
import { chipOf, downloadSize, MODELS, makerOf, measuredOn, SOURCES, tagsOn } from "../models/catalog.mjs";
import { sizeText } from "../models/describe.mjs";
import { createLocalModels, freeBytesAt } from "../models/library.mjs";
import { presetsFor } from "../models/presets.mjs";
import { createMove, settleMove } from "../move/index.mjs";
import { CHAT_VENDORS, formatChatChoice } from "../server/chat/vendors.mjs";
import { describeRoute, keyVendorOf, MODES, taskProblem } from "../server/modes.mjs";
import { formatModelChoice, PROVIDERS } from "../server/providers/index.mjs";
import { OUTPUT_SCRIPTS } from "../server/tasks/dictate/index.mjs";
import { findTask } from "../server/tasks/index.mjs";
import { findVendor, VENDORS } from "../server/vendors.mjs";
import { adoptAppKeys } from "../storage/app-keys.mjs";
import { openHistory } from "../storage/history.mjs";
import { migrateLegacyData, migrateLegacySettings } from "../storage/legacy.mjs";
import { ensureHome, installedHomeOf, keyFile, oldAppKeyFile, resolvePaths } from "../storage/paths.mjs";
import {
  ACCELERATIONS,
  LOCAL_MODEL_MEMORY,
  MAX_TRANSLATE_TARGETS,
  overridingEnv,
  patchSettings,
  resolveSettings,
  routeOf,
  saveSetting,
  unsetSetting,
} from "../storage/settings.mjs";
import { openVocabulary, readImportFile } from "../storage/vocabulary.mjs";
import { toHex } from "../themes/color.mjs";
import { themeCss } from "../themes/contract.mjs";
import { findTheme, THEMES } from "../themes/index.mjs";
import { createUpdates } from "../update/index.mjs";
import { estimateTime } from "../usage/estimate.mjs";
import { dayKey, insights } from "../usage/insights.mjs";
import { usageReport } from "../usage/report.mjs";
import { MAX_TERM_LENGTH, MAX_TERMS } from "../vocabulary/terms.mjs";
import { createDelivery } from "./delivery.mjs";
import { chooseHome, needsHomeChoice } from "./first-run.mjs";
import { helperPaths, startHelper } from "./helper.mjs";
import { EXPORTS } from "./history-export.mjs";
import { createHotkeyRecording } from "./hotkey-recording.mjs";
import { createKeyManager } from "./keys/key-manager.mjs";
import { createKeyStore } from "./keys/key-store.mjs";
import { createCardWindow } from "./lookup/card-window.mjs";
import { createLookup } from "./lookup/controller.mjs";
import { createLookupEngine } from "./lookup/engine.mjs";
import { createLookupSetup } from "./lookup/setup.mjs";
import { describePlaza, loadPriceBook } from "./model-plaza.mjs";
import { createModeSwitch } from "./modes.mjs";
import { MOVE_TO, startMoveWindow } from "./move-window.mjs";
import { floatAboveAll, showAboveAll } from "./on-top.mjs";
import { createRerun, recordingOf } from "./rerun.mjs";
import { startService } from "./service.mjs";
import { createSessionGate } from "./session-gate.mjs";
import { summarizeSetup, summaryAsText } from "./setup-state.mjs";
import { createAppUpdates } from "./updates.mjs";
import { describeVocabularySupport, vocabularyHops } from "./vocabulary.mjs";

// 后台应用的主进程：两个窗口（悬浮条、主窗口）、菜单栏图标、原生小帮手、内置的听写服务，
// 以及页面和命令行要它代办的事。窗口用什么颜色由主题定（src/themes），这里负责把它交给每个窗口。
// 平时由 speakmore 命令启动（src/cli），也可以打成应用双击启动。
// 结构对应原版的"主进程 + 悬浮条 + 主窗口（hub）+ 键盘子进程"（targets/typeless/docs/03-process-architecture.md）。

/** 调试用：设了就连这个地址上单独启动的服务端，不启动内置的那个 */
const EXTERNAL_SERVER_URL = process.env.SPEAKMORE_SERVER_URL ?? null;
/** 是 speakmore 命令启动的：日志由它接到文件里，缺什么也由它在终端里说，这边不自己弹主窗口 */
const LAUNCHED_BY_CLI = process.env.SPEAKMORE_CLI === "1";
/**
 * 这一次启动不是来跑 App 本身的，先办一件事（办这些时不找家目录、不拿单实例锁、不起服务）：
 *   "move"   设置里点了"存储位置 › 更改"，App 另起的搬家进度窗口（move-window.mjs）
 *   "choose" macOS 上从"应用程序"第一次打开、什么都还没装过：先问存储位置放哪（first-run.mjs），问完重新启动
 * 平常是 null
 */
const PRELUDE = MOVE_TO
  ? "move"
  : needsHomeChoice({
        env: process.env,
        platform: process.platform,
        packaged: app.isPackaged,
        launchedByCli: LAUNCHED_BY_CLI,
        userHome: homedir(),
      })
    ? "choose"
    : null;

let PATHS;
let SETTINGS;
/** 0.13 以前的热键设置换成了新写法时，换了什么（migrateLegacySettings）：日志接到文件上之后再记 */
let MIGRATED = null;
/**
 * 这一次装哪些热键（hotkeys/bindings.mjs 的 resolveHotkeys）：每个动作的组合，和装不上的、要提醒的。
 * 设置里、命令行里可以当场换（setup:set-hotkey、reload-hotkeys），换的时候给小帮手下发新的绑定表
 */
let hotkeys;
/** 设置里热键那几项写的（hotkeySettingValues），和 hotkeys 一起换 */
let hotkeySettings;
/**
 * 启动时用谁家的 key：原生链路是收音频的那家，本地转写链路是润色的那家；数据隐私模式不用 key，是 null。
 * 正在用的以 keys.provider 为准
 */
let PROVIDER;
/** 启动时走哪条路线（server/modes.mjs）。之后切模式、换模型时当场换（keys.switchRoute），正在走的以 service.route 为准 */
let ROUTE;
/** 本机模型用不用显卡（设置里的 acceleration）。在设置里换了当场生效（service.setAcceleration） */
let acceleration;
/** 本机模型常驻，还是开口时装载、空闲多久后释放（设置里的 localModelMemory）。换了当场生效（service.setLocalModelMemory） */
let localModelMemory;
/**
 * 启动时就出错了（家目录找不到、定位文件坏了、设置读不出）：照实说出来再退出，不留一个按了热键没反应的进程。
 * 写在标准错误上的，speakmore 命令起的会在终端里转述（它接着日志）；从程序坞、开始菜单、开机启动起的没有终端，
 * 另外弹系统的错误框（ready 之前也能弹），不然只是闪一下就没了，用户不知道为什么打不开。设置可能还没读出来，按系统的语言说
 */
function reportStartupProblem(error) {
  console.error(String(error?.stack ?? error));
  if (LAUNCHED_BY_CLI) return;
  let text = String(error?.message ?? error);
  try {
    const t = createTranslator(resolveLocale(SYSTEM_LOCALE, app.getPreferredSystemLanguages()));
    text = t.text(problemOf(error));
  } catch {
    // 翻不出来就用它自己的英文
  }
  dialog.showErrorBox("SpeakMore", text);
}

// Windows 上装好的那一份（开始菜单、开机启动、命令行起的都是它）：家目录就是程序所在的那个，外面传进来的 SPEAKMORE_HOME
// 不算数。程序和数据永远是同一个目录里的：搬过家以后环境里残留的旧位置带不偏它
if (process.platform === "win32" && PRELUDE === null) {
  const home = installedHomeOf(process.execPath, existsSync);
  if (home) process.env.SPEAKMORE_HOME = home;
}

if (PRELUDE === null) {
  try {
    PATHS = resolvePaths(process.env);
    // 0.13 以前的热键设置先换成新写法：直接双击打开、开机自启的那一次也要用原来的键（docs/hotkey-research.md 5.9）
    MIGRATED = migrateLegacySettings(PATHS.settingsFile);
    SETTINGS = resolveSettings({ file: PATHS.settingsFile, env: process.env });
    ROUTE = routeOf(SETTINGS);
    acceleration = SETTINGS.acceleration.value;
    localModelMemory = SETTINGS.localModelMemory.value;
    hotkeys = resolveHotkeys(SETTINGS, process.platform);
    hotkeySettings = hotkeySettingValues(SETTINGS);
    PROVIDER = keyVendorOf(ROUTE) ?? null;
  } catch (error) {
    reportStartupProblem(error);
    process.exit(2);
  }
}
/** 日志里的话用英文写：排查的人不一定看得懂界面的语言 */
const LOG_TEXT = createTranslator("en");
/** 每个动作的组合写成 "AltRight+Space" 这样的字：日志里看得懂 */
const chordStrings = (chords) =>
  Object.fromEntries(Object.entries(chords).map(([action, list]) => [action, list.map(chordString)]));
/** 设置里热键那几项现在写的（hotkey.<动作> → 值）。后台报给命令行的状态、当场换的回答里都是这几项 */
function hotkeySettingValues(settings) {
  return Object.fromEntries(ACTIONS.map((action) => [settingNameOf(action), settings[settingNameOf(action)].value]));
}
/** 一个组合换成小帮手认的原生码（探测冲突用，写法同绑定表） */
function nativeChord(codes, platform) {
  const key = codes.find((code) => !isModifier(code));
  return {
    mods: codes.filter(isModifier).map((code) => nativeCode(code, platform)),
    ...(key === undefined ? {} : { key: nativeCode(key, platform) }),
  };
}
/** 思考档位只有 Gemini 有；别家用不上时是 null，状态里也不报 */
const thinkingFor = (provider) => (provider?.thinkingLevels ? SETTINGS.thinking.value : null);
const WINDOWS = process.platform === "win32";
/**
 * 菜单栏图标：印章上的五道声波。macOS 上文件名带 Template，系统按菜单栏的深浅反色，@2x 那张由系统自己挑；
 * Windows 的通知区域不会反色，用带颜色的应用图标，.ico 里各个尺寸都有（scripts/build/make-icon.sh）
 */
const TRAY_ICON = join(import.meta.dirname, "../../assets", WINDOWS ? "icon.ico" : "trayTemplate.png");
/** Windows 上窗口和任务栏的图标（macOS 上是应用包自己的图标） */
const WINDOW_ICON = join(import.meta.dirname, "../../assets/icon.ico");
/**
 * Windows 上标题栏藏起来以后，系统的最小化、最大化、关闭三个按钮叠在页面右上角这么高的一条里。
 * 和主窗口内容区最上面那条拖动区（hub.css 的 .content::before，2.75rem）一样高
 */
const CAPTION_HEIGHT = 44;
/** 划词翻译自己的自定义服务的 key 存在哪（keyFile 的厂商 id）、从哪个环境变量来：和语音那边的 custom 分开 */
const LOOKUP_CUSTOM_KEY = "lookupcustom";
const LOOKUP_CUSTOM_KEY_ENV = "SPEAKMORE_LOOKUP_CUSTOM_API_KEY";
/** 关于里"在 GitHub 上看"打开的地方 */
const HOMEPAGE = "https://github.com/zephyr4123/speakmore";
/** 这台机器是哪类芯片：本地模型的实测按它挑（models/catalog.mjs 的 CHIPS） */
const CHIP = chipOf();
/** 主窗口的大小，照原版（targets/typeless 的 hub 窗口：1080×750，最小 988×685） */
const HUB_SIZE = { width: 1080, height: 750, minWidth: 988, minHeight: 685 };
/**
 * 悬浮条的窗口。比条本身大一圈：上面要放一行提示，四周要留出阴影，报错时条会变宽变高；
 * 再往上留出语音翻译的语言选单（最多 MAX_TRANSLATE_TARGETS 种，一种一行）。窗口透明、点不到，多出来的地方看不见也挡不住
 */
const BAR_SIZE = { width: 380, height: 310 };
/**
 * 系统设置里各项权限的页面。Windows 只有麦克风这一项：没有"输入监控""辅助功能"，
 * 小帮手装上钩子就能听键、能模拟按键（报上来的 listen、trusted 总是 true）
 */
const PRIVACY_PANES = WINDOWS
  ? { microphone: "ms-settings:privacy-microphone" }
  : {
      microphone: "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone",
      listen: "x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent",
      trusted: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
    };

/**
 * 问一下麦克风权限。macOS 上没问过时会弹系统的授权框；Windows 没有这种框（在系统设置里统一开关），照实报现在的状态
 * @returns {Promise<boolean>} 能不能用
 */
async function askMicrophone() {
  if (WINDOWS) return systemPreferences.getMediaAccessStatus("microphone") === "granted";
  return systemPreferences.askForMediaAccess("microphone");
}

/**
 * 起更新进程（src/update/background.mjs）：借这个 App 自己的 Electron 当 Node 跑，App 退出了它还在（detached），
 * 说的话接到日志上。它会让这个 App 退出、换掉、再打开
 */
function launchUpdate() {
  const logFd = openSync(PATHS.logFile, "a");
  try {
    const child = spawn(process.execPath, [join(app.getAppPath(), "src", "update", "background.mjs")], {
      detached: true,
      windowsHide: true,
      stdio: ["ignore", logFd, logFd],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", SPEAKMORE_HOME: PATHS.home },
    });
    child.unref();
    log.info("update_launched", { pid: child.pid });
    return child;
  } finally {
    closeSync(logFd);
  }
}

/**
 * 起搬家的进度窗口：用这个 App 自己的程序另起一个（不当 Node 跑，它要开窗口），环境变量 SPEAKMORE_MOVE_TO 说搬去哪
 * （见文件开头的 PRELUDE）。它不挂在这个 App 名下（detached）：这个 App 马上会被它请退出
 */
function launchMove(folder) {
  const { ELECTRON_RUN_AS_NODE: _asNode, SPEAKMORE_CLI: _byCli, ...env } = process.env;
  // 在临时目录里起：从开始菜单打开的 App 工作目录就是家目录，进度窗口要是跟着继承，旧目录就删不掉
  const child = spawn(process.execPath, app.isPackaged ? [] : [app.getAppPath()], {
    detached: true,
    stdio: "ignore",
    cwd: tmpdir(),
    env: { ...env, SPEAKMORE_HOME: PATHS.home, SPEAKMORE_MOVE_TO: folder },
  });
  child.unref();
  log.info("move_launched", { pid: child.pid, folder });
}

// Windows 认应用靠这个 id：任务栏把窗口归到一起、通知写谁发的。和 macOS 应用包的标识一样
if (WINDOWS) app.setAppUserModelId("com.zephyrxiang.speakmore");

// 所有东西都放在 paths.mjs 定的那一个目录里，命令行和这里用同一处。Electron 默认会按应用名在
// ~/Library/Application Support 下另开一个目录放 Chromium 的缓存和状态，把它也收进来，和我们的数据分开放
if (PRELUDE === null) app.setPath("userData", PATHS.cacheDir);

/**
 * Windows 上装好的那一份：程序在家目录 versions 下某一个版本里。没有单独的"应用"：命令行起的、开始菜单起的都是它，
 * 用的是同一套 key 和设置（不像 macOS 的 SpeakMore.app 有自己的一套权限）
 */
const INSTALLED_ON_WINDOWS =
  PRELUDE === null && WINDOWS && process.execPath.toLowerCase().startsWith(`${PATHS.versionsDir.toLowerCase()}\\`);
/**
 * 开机启动登记的是这个可执行文件加上程序目录（Windows 上没有应用包，要把参数也记下来）。
 * 装了新版本时 install.ps1 把这一项改指到新版本的程序上（Electron 认开没开只比程序路径）
 */
const LOGIN_ITEM = WINDOWS ? { path: process.execPath, args: [app.getAppPath()], name: "SpeakMore" } : {};

/**
 * 开机启动开着没有。Windows 上 openAtLogin 只认以 AppUserModelId 为名的那一项，我们写的名字是 SpeakMore，
 * 读回来永远是 false（真机上试过）：看 executableWillLaunchAtLogin，Run 里有指向这个程序、这些参数的一项，
 * 并且没在任务管理器里被停用
 */
function loginItemEnabled() {
  const settings = app.getLoginItemSettings(LOGIN_ITEM);
  return WINDOWS ? settings.executableWillLaunchAtLogin : settings.openAtLogin;
}

// 打成应用后没有终端，日志自己写文件。由命令启动时标准输出已经被接到同一个文件里了。
// Windows 上从开始菜单起的（不是命令行起的）也没有终端
if (PRELUDE === null && (app.isPackaged || (INSTALLED_ON_WINDOWS && !LAUNCHED_BY_CLI))) alsoLogTo(PATHS.logFile);

// 同一个家目录只跑一个。这里给的数据会随 second-instance 事件送到已经在运行的那一个手里
const isOnlyInstance = PRELUDE === null && app.requestSingleInstanceLock({ byCli: LAUNCHED_BY_CLI });
if (PRELUDE === null && !isOnlyInstance) {
  console.error("已经有一个在运行了");
  // 约定的退出码：启动它的 speakmore 命令据此知道"不是没起来，是有别的先起来了"，接着等那一个
  app.exit(ALREADY_RUNNING_EXIT_CODE);
}

const sourceDir = join(app.getAppPath(), "src");
const webPreferences = { preload: join(sourceDir, "preload", "preload.cjs"), sandbox: true, contextIsolation: true };
// 悬浮条和划词卡片平时藏着、按热键才露出来。藏着的页面会被 Chromium 当后台页降频，按键那条消息压在队列里，
// 要几秒后才画出来，连按几下会一起涌出来（PR #21，Windows 上实测最长 13 秒）
const popupPreferences = { ...webPreferences, backgroundThrottling: false };
// 窗口里只放我们自己的页面。几个窗口共用一份预加载脚本：拖进窗口的文件、页面里的链接要是把窗口带走了，
// 那个页面也能调到存 key、读历史、读剪贴板这些接口。开新窗口同理
app.on("web-contents-created", (_event, contents) => {
  contents.on("will-navigate", (event, url) => {
    event.preventDefault();
    log.warn("navigation_blocked", { url: url.slice(0, 200) });
  });
  contents.setWindowOpenHandler(({ url }) => {
    log.warn("window_open_blocked", { url: url.slice(0, 200) });
    return { action: "deny" };
  });
});

/** 第一次打开时问存储位置的那一次（PRELUDE 是 "choose"）：Chromium 的缓存先放临时目录，问完重新启动 */
const FIRST_RUN_PROFILE = join(tmpdir(), "speakmore-first-run");

// 不能写成顶层的 await app.whenReady()：Electron 要等主模块加载完才会就绪，
// 而顶层 await 让模块一直加载不完，两边互相等（Electron 44.7 实测如此）。
// 没抢到锁的那个正在退出，不往下走：家目录里的东西（进程号、控制通道）都是先到的那个的
if (isOnlyInstance) {
  app
    .whenReady()
    .then(main)
    .catch((error) => {
      // 启动失败：记下来、说出来，以非零码退出，不留一个什么都不干的进程
      log.error("startup_failed", { error: String(error?.stack ?? error) });
      reportStartupProblem(error);
      app.exit(1);
    });
} else if (PRELUDE === "move") {
  startMoveWindow({ folder: MOVE_TO, sourceDir, webPreferences, windowIcon: WINDOW_ICON });
} else if (PRELUDE === "choose") {
  startHomeChoice();
}

function startHomeChoice() {
  app.setPath("userData", FIRST_RUN_PROFILE);
  // 问的时候又双击了一次：交给正在问的那个
  if (!app.requestSingleInstanceLock()) {
    app.exit(0);
    return;
  }
  app.dock?.hide();
  app
    .whenReady()
    .then(async () => {
      app.focus({ steal: true });
      const t = createTranslator(resolveLocale(SYSTEM_LOCALE, app.getPreferredSystemLanguages()));
      const home = await chooseHome({ dialog, t, env: process.env, userHome: homedir() });
      console.log(`storage location chosen: ${home}`);
      app.relaunch();
      app.exit(0);
    })
    .catch((error) => {
      reportStartupProblem(error);
      app.exit(1);
    });
}

/**
 * 删掉以前搬家、第一次打开时放在临时目录里的 Chromium 缓存（speakmore-move-*、speakmore-first-run）。
 * 只删一个小时以前的：刚起这个 App 的搬家进度窗口可能还开着。删不掉的留给系统清临时目录
 */
function removeOldTemporaryProfiles() {
  const hourAgo = Date.now() - 60 * 60 * 1000;
  let names = [];
  try {
    names = readdirSync(tmpdir()).filter((name) => /^speakmore-(move-.+|first-run)$/.test(name));
  } catch (error) {
    log.warn("temporary_profiles_unreadable", { error: error.code ?? error.message });
  }
  for (const name of names) {
    const dir = join(tmpdir(), name);
    try {
      if (statSync(dir).mtimeMs < hourAgo) rmSync(dir, { recursive: true, force: true });
    } catch (error) {
      log.warn("temporary_profile_kept", { dir, error: error.code ?? error.message });
    }
  }
}

async function main() {
  app.dock?.hide();

  // 搬家进行到一半（另一个进程正在搬）就不在这里启动；上次断在半路的先收拾好（src/move）
  await settleMove({
    paths: PATHS,
    env: process.env,
    stdio: "forward",
    atStartup: true,
    report: (message) => log.info("move_settled", { step: message.key, ...message.params }),
  });
  ensureHome(PATHS);
  removeOldTemporaryProfiles();
  // 记下进程号：万一卡住了不答话，speakmore stop 靠它找到这个进程。要赶在控制通道开始听之前写好，
  // 这样只要通道连得上，文件里记的就一定是通道那头的进程
  writeFileSync(PATHS.pidFile, `${process.pid}\n`);
  // 0.1 版的数据在别处。平时是 speakmore 命令在启动之前搬好的；直接双击应用启动时由这里搬
  await migrateLegacyData({ paths: PATHS, log });
  // 0.7.0 及以前 App 另存的那份 key 搬进 App 和命令行共用的文件
  adoptAppKeys({ paths: PATHS, log });

  const startedAt = new Date().toISOString();
  const history = openHistory(PATHS.historyDb);
  // 模型广场上的标价、推荐组合的月成本：各家的价目模块启动时加载一次
  const prices = await loadPriceBook();
  // 每家一把 key，各存一个文件。正在用的那家之外的也要在：speakmore key openai、model check 要用
  const keyStores = Object.fromEntries(
    VENDORS.map(({ id }) => [
      id,
      createKeyStore({ file: keyFile(PATHS, id), oldFile: oldAppKeyFile(PATHS, id), safeStorage }),
    ]),
  );
  /** 本地模型的状态一变，菜单栏和主窗口跟着更新。菜单栏建好之前变的不用管：建的时候读的就是最新的 */
  let localModelChanged = () => {};
  // 本机的模型库：下载、取消、删除都由用户点。下好了、删了，服务按路线装上或卸掉
  const localModels = createLocalModels({
    dir: PATHS.modelsDir,
    source: SETTINGS.modelSource.value,
    log,
    // 只在用户点了下载、取消、删除之后才会来，那时服务早就建好了
    onChange: () => {
      service?.modelsChanged();
      localModelChanged();
    },
  });
  /** 用户的词典：只存在本机。内置服务每次听写读一次（命令行改了文件也读得到），词典页增删改都经这里 */
  const vocabulary = openVocabulary(PATHS.vocabularyFile);
  // 版本检查和更新（app/updates.mjs，内核在 src/update）：设置 › 通用里那一行、菜单栏的提醒
  const appUpdates = createAppUpdates({
    updates: createUpdates({
      paths: PATHS,
      env: process.env,
      packageDir: app.getAppPath(),
      version: app.getVersion(),
      instance: createInstance({ paths: PATHS }),
      stdio: "ignore",
    }),
    version: app.getVersion(),
    launch: launchUpdate,
    onChange: () => setupChanged(),
    log,
    logFile: PATHS.logFile,
  });
  // 每次调模型记一笔账，开着的历史窗口跟着更新花费（记账出错由整理流程写日志，不连累听写）
  const service = EXTERNAL_SERVER_URL
    ? null
    : await startService({
        log,
        route: ROUTE,
        modelsDir: PATHS.modelsDir,
        models: localModels,
        onModelCall: (call) => {
          history.addCall(call);
          historyChanged();
        },
        onLocalModel: () => localModelChanged(),
        acceleration,
        localModelMemory,
        // 录音时的预览只有本机识别能做；关着时服务端连排都不排。换了调 service.setLivePreview
        livePreview: SETTINGS.livePreview.value === "on",
        vocabulary: vocabulary.terms,
      });
  const serverUrl = EXTERNAL_SERVER_URL ?? service.url;
  const e2e = process.env.SPEAKMORE_E2E_OUT ? await import("./e2e.mjs") : null;

  const keys = createKeyManager({
    service,
    provider: PROVIDER,
    keyStores,
    env: process.env,
    log,
    onChange: () => setupChanged(),
    // 给不是正在用的那一家存 key 时拿哪条路线验证，由模式那一层说
    routeFor: (id) => modes.routeForVendor(id),
  });
  /** 切模式、换各模式里的模型（app/modes.mjs）。连着单独启动的服务端时这些都归那边，是 null */
  const modes = service
    ? createModeSwitch({ service, keys, models: localModels, settingsFile: PATHS.settingsFile, env: process.env, log })
    : null;
  /** 按键监听的小帮手：starting（还没报上来）/ running / stopped（退出了，或者根本没起来） */
  let helperState = "starting";
  /** 小帮手报上来的两项权限；它没在 running 时是 null */
  let helperPermissions = null;
  /** 控制通道，启动到后面才开；端到端测试时一直是 null */
  let control = null;
  /** 启动时对麦克风和 key 的检查做完了没有 */
  let startupChecked = false;
  let hubWindow = null;
  let onboardingWindow = null;
  /** 首次引导正在测快捷键：三个功能的热键都送到引导窗口，不去开悬浮条、不弹划词卡片 */
  let hotkeyToOnboarding = false;
  /** 小帮手问来的系统设置（Mac：按下地球仪键时做什么），录键存的时候按它说提醒；小帮手每次起来再问一遍 */
  let systemInfo = {};

  // ---------- 界面语言 ----------

  /** 设置里的语言（system 是跟随系统）和这次实际用的那种。设置里改了当场换，不用重启 */
  let languageSetting = SETTINGS.language.value;
  let locale = resolveLocale(languageSetting, app.getPreferredSystemLanguages());
  /** 菜单栏用它；窗口里的页面各自按 locale 翻（预加载脚本一上来就同步来取） */
  let t = createTranslator(locale);
  ipcMain.on("locale:get", (event) => {
    event.returnValue = locale;
  });

  if (MIGRATED) log.info("settings_migrated", MIGRATED);
  logHotkeys("hotkeys_resolved");
  log.info("started", {
    version: app.getVersion(),
    hotkeys: chordStrings(hotkeys.chords),
    route: describeRoute(ROUTE),
    thinking: ROUTE.mode === "native" ? thinkingFor(PROVIDER) : null,
    theme: SETTINGS.theme.value,
    acceleration,
    localModelMemory,
    language: languageSetting,
    locale,
    system_languages: app.getPreferredSystemLanguages(),
    home: PATHS.home,
    server_url: serverUrl,
    packaged: app.isPackaged,
    by_cli: LAUNCHED_BY_CLI,
    e2e: Boolean(e2e),
  });

  // ---------- 能不能用、还差什么 ----------

  /** 一家的名字，按界面语言写（文案 providers.<id>.name）；没有那一家（数据隐私模式）是 null */
  const vendorTitle = (vendor) => (vendor ? msg(`providers.${vendor.id}.name`) : null);

  /** 正在用的那一家：连着单独启动的服务端时是设置里那家（用哪个由那边定，这里只是个名字） */
  const provider = () => (service ? keys.provider : PROVIDER);

  const currentSetup = () => ({
    // 缺的是路线里另一家的 key（第一跳交给云端）时点名那一家。按界面语言写它的名字（阿里云百炼，不是日志里的 Bailian）
    providerName: vendorTitle(keys.current.vendor ?? provider()),
    key: keys.current,
    localModel: service?.localModel ?? null,
    helper: helperState,
    hotkeys: [...hotkeys.problems, ...helperHotkeyProblems],
    // 小帮手把听写的组合全退回了（回执里每个都在）：按哪个都没反应
    dictateUsable:
      hotkeys.chords.dictate.length >
      new Set(helperHotkeyProblems.filter((problem) => problem.action === "dictate").map((p) => chordString(p.chord)))
        .size,
    permissions: {
      microphone: systemPreferences.getMediaAccessStatus("microphone"),
      listen: helperPermissions?.listen ?? null,
      trusted: helperPermissions?.trusted ?? null,
    },
  });

  let offeredSettings = LAUNCHED_BY_CLI;
  /**
   * 还缺东西就打开首次引导，第一次启动的人不用猜下一步该干什么。只主动弹一次。
   * 由命令启动时不弹：那个人正看着终端，突然冒出一个窗口还会把他正要粘贴 key 的焦点抢走。
   * 几样检查是先后到的（key 要验证、小帮手要启动），都有了结论才判断，免得刚启动就误报。
   */
  function offerSettingsIfIncomplete() {
    const setup = currentSetup();
    if (offeredSettings || !startupChecked || setup.key.state === "checking" || setup.permissions.listen === null)
      return;
    const summary = summarizeSetup(setup);
    if (summary.missing.length === 0 && summary.degraded === null) return;
    offeredSettings = true;
    log.info("settings_offered", { missing: summary.missing, degraded: summary.degraded !== null });
    showOnboarding();
  }

  /** 上面任何一样变了都调一次：菜单栏和主窗口跟着更新 */
  function setupChanged() {
    refreshTrayMenu();
    hubWindow?.webContents.send("setup:changed");
    onboardingWindow?.webContents.send("setup:changed");
  }

  // ---------- 主题 ----------

  let theme = findTheme(SETTINGS.theme.value);
  // 每个窗口的预加载脚本一上来就同步来取，赶在页面画出第一帧之前
  ipcMain.on("theme:get", (event) => {
    event.returnValue = themeCss(theme);
  });
  /** 重新读一遍设置里的主题，开着的窗口当场换。别的设置要重启才生效，主题不用 */
  function reloadTheme() {
    theme = findTheme(resolveSettings({ file: PATHS.settingsFile, env: process.env }).theme.value);
    const css = themeCss(theme);
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send("theme:changed", css);
    recolorCaptionButtons();
    log.info("theme_changed", { theme: theme.id });
    return { theme: theme.id };
  }
  const windowColors = () => theme.window[nativeTheme.shouldUseDarkColors ? "dark" : "light"];
  /** 窗口还没画出页面时的底色：和页面的底一样，免得深色模式下先闪一下白 */
  const windowBackground = () => toHex(windowColors().bg);
  /** Windows 右上角那三个系统按钮：底透明（透出页面），符号用正文的颜色，跟着主题和深浅色换 */
  const captionButtons = () => ({ color: "#00000000", symbolColor: toHex(windowColors().ink), height: CAPTION_HEIGHT });
  /**
   * 主窗口和首次引导的标题栏：都藏起来，页面画到最顶上。macOS 的红绿灯放到 trafficLight 那里；
   * Windows 留下系统的三个按钮叠在右上角，再给窗口挂上图标（不然任务栏上是 Electron 的）
   */
  const frame = (trafficLight) =>
    WINDOWS
      ? { titleBarStyle: "hidden", titleBarOverlay: captionButtons(), icon: WINDOW_ICON }
      : { titleBarStyle: "hidden", trafficLightPosition: trafficLight };
  /** 换了主题、系统换了深浅色：Windows 上那三个按钮的颜色跟着换 */
  function recolorCaptionButtons() {
    if (!WINDOWS) return;
    for (const window of [hubWindow, onboardingWindow]) {
      if (window && !window.isDestroyed()) window.setTitleBarOverlay(captionButtons());
    }
  }
  nativeTheme.on("updated", recolorCaptionButtons);

  // ---------- 悬浮条 ----------

  function createBar() {
    const { workArea } = screen.getPrimaryDisplay();
    const bar = new BrowserWindow({
      ...BAR_SIZE,
      x: Math.round(workArea.x + (workArea.width - BAR_SIZE.width) / 2),
      // 贴着屏幕可用区域的底边。条离底边多远由 bar.css 定
      y: workArea.y + workArea.height - BAR_SIZE.height,
      show: false,
      frame: false,
      transparent: true,
      hasShadow: false,
      resizable: false,
      skipTaskbar: true,
      // 不能抢焦点：焦点一旦离开用户正在用的输入框，文字就贴不进去了
      focusable: false,
      webPreferences: popupPreferences,
    });
    // 整个窗口都点不到，鼠标事件原样落到它下面的应用上。条上的两个按钮不靠这个窗口收点击：
    // 点击一旦落在我们的窗口上，系统就会把我们切到最前面（面板类型的窗口也一样，实测过），输入框照样丢焦点。
    // 所以点击是原生小帮手在事件到达任何窗口之前截下来的，见下面的 bar:capture。
    // 鼠标移动照样转给页面（forward）：语音翻译的语言胶囊要靠悬停展开，点选项还是小帮手截
    bar.setIgnoreMouseEvents(true, { forward: true });
    bar.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    // 浮在一切之上，露出来时再顶一次（on-top.mjs，GitHub issue #16）
    floatAboveAll(bar, { mac: !WINDOWS });
    bar.loadFile(join(sourceDir, "renderer", "bar", "bar.html"));
    return bar;
  }

  const bar = createBar();
  /** 给悬浮条的页面发消息。退出途中窗口已经销毁，这时再发会抛错 */
  const tellBar = (channel, payload) => {
    if (!bar.isDestroyed()) bar.webContents.send(channel, payload);
  };
  const notify = (message) => tellBar("notice", message);
  /** 悬浮条上方的操作提示开不开（设置里的 barHint，on / off）。每次现读：被环境变量盖着时是环境变量里的 */
  const currentBarHint = () => resolveSettings({ file: PATHS.settingsFile, env: process.env }).barHint.value;
  /** 语音翻译译成哪几种（设置里的 translate.to），第一种是默认。同样每次现读 */
  const currentTranslateTo = () =>
    JSON.parse(resolveSettings({ file: PATHS.settingsFile, env: process.env })["translate.to"].value);
  /** 听写成品的中文字形（设置里的 outputScript）。每次现读：设置里换了，下一次开口就按新的 */
  const currentOutputScript = () => resolveSettings({ file: PATHS.settingsFile, env: process.env }).outputScript.value;
  /** 录音时要不要在悬浮条上显示暂定文字（设置里的 livePreview）。每次现读：设置里换了，下一次录音就按新的 */
  const currentLivePreview = () =>
    resolveSettings({ file: PATHS.settingsFile, env: process.env }).livePreview.value === "on";
  /**
   * 小帮手现在替谁截着 esc 和点击：bar（悬浮条，说话时）、lookup（划词卡片开着时）或 null。同一时间只有一个：
   * 开始说话时卡片收起；正在说话时不理划词。esc、截到的点击按它转给谁
   */
  let captureOwner = null;
  /** 悬浮条不截了：只松开它自己截的，卡片截着的不动 */
  function releaseBarCapture() {
    if (captureOwner !== "bar") return;
    captureOwner = null;
    helper.release();
  }
  ipcMain.on("bar:set-visible", (_event, visible) => {
    if (visible) {
      showAboveAll(bar);
      return;
    }
    bar.hide();
    // 条不在屏幕上时它不该截着。页面自己会说"不截了"，这里再说一遍是保险：
    // 万一它漏说了，esc 会一直被吞掉，在哪个应用里都按不出来
    releaseBarCapture();
  });
  // 页面崩了就更没人说"不截了"
  bar.webContents.on("render-process-gone", (_event, details) => {
    log.error("bar_gone", { reason: details.reason });
    releaseBarCapture();
  });
  // 听写进行中，页面让小帮手把 esc 和条上两个按钮的点击截下来（null 是不截了）。
  // 页面给的是按钮在窗口里的位置，小帮手要的是在屏幕上的位置
  ipcMain.on("bar:capture", (_event, regions) => {
    if (regions === null) {
      releaseBarCapture();
      return;
    }
    if (!Array.isArray(regions)) {
      log.error("bar_capture_invalid", { type: typeof regions });
      return;
    }
    const origin = bar.getBounds();
    const onScreen = regions.map(({ id, x, y, width, height }) => {
      const rect = { x: origin.x + x, y: origin.y + y, width, height };
      // Windows 的鼠标钩子报的是物理像素，窗口的位置是按缩放换算过的：换成那块屏上的物理像素再交过去
      return { id, ...(WINDOWS ? screen.dipToScreenRect(bar, rect) : rect) };
    });
    // "点了按钮没反应"时先看这条：位置对不对得上屏幕上画的那两个圆
    log.info("bar_capture", { regions: onScreen });
    // 开始说话了：划词卡片收起，截取归悬浮条（卡片刚开、还没报位置时也收）
    if (lookup.open) lookup.close("dictation");
    captureOwner = "bar";
    helper.capture(onScreen);
  });

  // ---------- 按键和贴字 ----------

  let helper = null;
  /** 每启动一个小帮手加一；旧的那个退出时发来的事件靠它认出来并丢掉 */
  let helperGeneration = 0;
  /**
   * 发给小帮手、还没等到 bound 回执的几份组合（先发的在前）。小帮手按顺序一份一份回，回执里的绑定 id 按发的那份数
   */
  let sentHotkeys = [];
  /** 最近一次 bound 回执里装不上的（没有辅助功能权限、注册不上……），放进"还差什么" */
  let helperHotkeyProblems = [];
  /** 小帮手截不截得住 esc 和点击（要辅助功能权限）。截不住时悬浮条不画那两个按钮 */
  let barControls = false;
  function setBarControls(enabled) {
    barControls = enabled;
    tellBar("bar:controls", enabled);
  }

  /**
   * 小帮手报的绑定事件先过这一道：语音输入的组合是划词翻译的一部分时，按下先压住，凑成划词就不交给悬浮条（session-gate.mjs）
   */
  const sessionGate = createSessionGate({ deliver: (event) => onBindingEvent(event) });

  /** 把现在要装的热键下发给小帮手（hotkeys 已经查过，这个系统上绑不了的不在里面） */
  function sendHotkeys() {
    sentHotkeys.push(hotkeys.chords);
    sessionGate.setChords(hotkeys.chords);
    helper.bind(bindingTable(hotkeys.chords, process.platform));
  }

  /** 热键装不上的、要提醒的写进日志（英文）：热键不灵时先看这几条 */
  function logHotkeys(event) {
    const fields = {
      hotkeys: chordStrings(hotkeys.chords),
      problems: hotkeys.problems.map((problem) => LOG_TEXT.text(describeHotkeyProblem(problem))),
      warnings: hotkeys.warnings.map(
        ({ action, chord, reason }) => `${action} ${chordString(chord)}: ${LOG_TEXT.text(reason)}`,
      ),
    };
    if (hotkeys.problems.length > 0) log.warn(event, fields);
    else log.info(event, fields);
  }

  /**
   * @param {{ prompt: boolean }} options prompt：两项权限没给时让不让系统弹授权框。只在应用启动时弹一次；
   *   之后重新检查权限靠的是重启小帮手，那时再弹的话每查一次弹一次
   */
  function launchHelper({ prompt }) {
    // 换小帮手（重查权限）时正在录的那次跟着结束：旧的那个的回执、退出都按代数丢掉了，不说的话页面一直停在"请按键"。
    // 新的小帮手没在截：开着的划词卡片收起
    if (helperGeneration > 0) {
      recording.helperGone();
      lookup.close("helper");
      captureOwner = null;
    }
    const generation = ++helperGeneration;
    helperPermissions = null;
    helperState = "starting";
    sentHotkeys = [];
    helperHotkeyProblems = [];
    setBarControls(false);
    helper = startHelper(helperPaths(app.getAppPath()).binary, {
      args: prompt ? [] : ["--no-prompt"],
      onEvent: (event) => {
        if (generation === helperGeneration) onHelperEvent(event);
      },
      log,
    });
    // 写进标准输入就行：它报完 ready 才开始读命令，读到之前的按键本来也没有绑定可认
    sendHotkeys();
  }

  /** 提示过"管理员窗口在前台、热键用不了"的进程号 */
  const elevatedNoticed = new Set();

  function onHelperEvent(event) {
    switch (event.event) {
      case "ready": {
        helperState = "running";
        helperPermissions = { listen: event.listen, trusted: event.trusted };
        log.info("helper_ready", { ...helperPermissions, capture: event.capture });
        const asked = helperGeneration;
        helper.info().then((info) => {
          if (asked !== helperGeneration) return;
          systemInfo = info;
          log.info("helper_info", info);
        });
        setBarControls(event.capture === true);
        setupChanged();
        offerSettingsIfIncomplete();
        break;
      }
      case "bound": {
        // 装不上的绑定按了不会有反应：先看这条。没有辅助功能权限时取消装不上是预料之中的，悬浮条那时也不画按钮
        const sent = sentHotkeys.shift() ?? hotkeys.chords;
        const rejected = event.rejected ?? [];
        if (rejected.length) log.warn("helper_bound", { rejected });
        else log.info("helper_bound", { rejected: [] });
        // 回的是更早的一份（中间又换过键）：等最新那份的回执
        if (sentHotkeys.length > 0) break;
        helperHotkeyProblems = boundProblems(rejected, sent);
        setupChanged();
        break;
      }
      case "permissions":
        // 运行中两项权限变了（Mac 小帮手自己盯着）：没了的那项的 tap 它已经作废，紧跟着按新的权限重报 bound
        helperPermissions = { listen: event.listen, trusted: event.trusted };
        log.info("helper_permissions", { ...helperPermissions, capture: event.capture });
        setBarControls(event.capture === true);
        setupChanged();
        break;
      case "secure_input":
        // 有应用开着安全输入（密码框、终端的安全键盘输入）：带普通键的组合由 Carbon 顶着，顶不了的这段时间按了没反应
        log.info("secure_input", { on: event.on, unavailable: event.unavailable });
        if (event.on && event.unavailable?.length > 0) notify(msg("bar.secureInput"));
        break;
      case "elevated_foreground":
        // Windows：以管理员身份运行的窗口在前台，钩子收不到发给它的按键，按热键没有任何反应。
        // 同一个窗口（进程）只提示一次，切来切去不反复弹
        log.info("elevated_foreground", { on: event.on, pid: event.pid });
        if (event.on && !elevatedNoticed.has(event.pid)) {
          elevatedNoticed.add(event.pid);
          notify(msg("bar.elevatedForeground"));
        }
        break;
      case "relistened":
        // Windows：睡眠唤醒、解锁以后小帮手重装了键盘钩子。热键这时候不灵的话，先看有没有这条
        log.info("helper_relistened", { reason: event.reason });
        break;
      case "binding":
      case "interrupted":
        // 引导页正在测快捷键：不压，按下就亮。压着的话点按右⌥ 的按下和松开同一刻送到，键帽看不出变色
        if (onboardingTestsHotkey()) toOnboarding(event);
        else sessionGate.accept(event);
        break;
      case "recording":
        // 录键模式里按住的键（设置页、引导页在录）：只交给录键那边，不进日志
        recording.onRecording(event);
        break;
      case "click":
        // 只在截着时才会有：听写进行中的悬浮条，或者开着的划词卡片
        // 字段不能叫 event：日志这一条的名字就记在 event 里，会被盖掉
        log.info("captured_click", { id: event.id, to: captureOwner });
        if (captureOwner !== "lookup") tellBar("input", event);
        else if (event.id === "outside") lookup.outside();
        else card.click(event.id);
        break;
      case "exit":
        helperState = "stopped";
        helperPermissions = null;
        recording.helperGone();
        // 压着的那一下不会再有松开、打断了：丢掉，不然 250ms 后照样交给悬浮条
        sessionGate.reset();
        // 没有小帮手就截不住卡片上的点击：卡片收起
        lookup.close("helper");
        captureOwner = null;
        setBarControls(false);
        log.error("helper_exited", { code: event.code, signal: event.signal });
        setupChanged();
        notify(msg("bar.helperStopped", { hotkey: chordsName(hotkeys.chords.dictate) }));
        break;
      default:
        log.warn("helper_unknown_event", { event: event.event });
    }
  }

  /** 小帮手报的绑定按下、松开、被打断：认出是哪个动作，交给它的处理者（动作目录的 handler） */
  function onBindingEvent(event) {
    const action = actionOfBinding(event.id);
    if (action === null) {
      log.warn("helper_unknown_binding", { id: event.id });
      return;
    }
    // 热键不灵时先看这条日志有没有：没有就是小帮手没收到按键（权限或键选错了）
    const fields = { event: event.event, id: event.id, down: event.down, to: event.to };
    // chord：这个动作的第几个组合（绑定 id 的序号），悬浮条的提示里写按下的那一个
    const input = { event: event.event, action: action.id, down: event.down, chord: Number(event.id.split("#")[1]) };
    BINDING_HANDLERS[action.handler]({ event, action, fields, input });
  }

  /** 动作目录里的每种处理者（handler）：绑定事件交给谁 */
  const BINDING_HANDLERS = {
    session: onSessionKey,
    // 只在截着时生效的（取消）：交给正在截的那一个，悬浮条或者划词卡片
    cancel: ({ event, fields, input }) => {
      log.info("key_event", { ...fields, to: captureOwner });
      if (captureOwner !== "lookup") tellBar("input", input);
      else if (event.event === "binding" && event.down) lookup.cancel();
    },
    // 划词翻译：按下就取选区、弹卡片（lookup/controller.mjs）
    lookup: ({ event, fields }) => {
      log.info("key_event", fields);
      if (event.event === "binding" && event.down) lookup.press();
    },
  };

  /**
   * 首次引导正在测快捷键、人也正看着它：三个功能的按下、松开、被打断只送到引导窗口。
   * 切到别的应用了就照常听写，不然热键在哪都按不出来，还没有任何提示；
   * 悬浮条在屏幕上（切出去开了一段听写又切回来）时也给条，不然这一段停不下来
   */
  const onboardingTestsHotkey = () => hotkeyToOnboarding && onboardingWindow?.isFocused() && !bar.isVisible();

  /** 测快捷键时的绑定事件：带上是哪个动作，引导页按它认"按到了哪个功能"（onboarding/key-check.mjs）。取消键不送 */
  function toOnboarding(event) {
    const action = actionOfBinding(event.id);
    if (action === null || action.handler === "cancel") return;
    const sent = { action: action.id, event: event.event, down: event.event === "binding" && event.down };
    log.info("key_event", { event: event.event, id: event.id, down: event.down, to: "onboarding" });
    onboardingWindow.webContents.send("onboarding:hotkey", sent);
  }

  /** 录音会话的动作（语音输入、语音翻译）：交给悬浮条开始、结束、升级 */
  function onSessionKey({ event, action, fields, input }) {
    log.info("key_event", fields);
    const blocker = summarizeSetup(currentSetup()).blocker ?? featureProblem(action);
    // 升级到另一个说话的功能（按着右⌥又按了空格）：带上是哪个，悬浮条把这一次直接换过去。
    // 升级到的做不了（离线方式下的语音翻译）就不带：这一次作废，紧跟着它自己的按下会说为什么
    const upgrade = event.to ? actionOfBinding(event.to) : null;
    const to = upgrade?.handler === "session" && featureProblem(upgrade) === null ? { to: upgrade.id } : {};
    // 凑成的是划词（按住右⌥ 停了一下才按回车，会话门已经把按下交给了悬浮条）：悬浮条会作废这一次，截取现在就放掉。
    // 紧跟着的划词按下同一轮就到，等悬浮条自己说不截了，划词会当成正在说话丢掉
    if (event.event === "interrupted" && upgrade && upgrade.handler !== "session") releaseBarCapture();
    if (blocker === null) tellBar("input", { ...input, ...to });
    else if (event.event === "binding" && event.down) notify(blocker);
  }

  /**
   * 这个说话的功能，现在的识别方式做不做得了（离线方式没有能翻译的模型）：做不了是要说的那句话，做得了是 null。
   * 连着单独启动的服务端时由那边判断
   */
  function featureProblem(action) {
    const task = findTask(action.id);
    return service && task ? taskProblem(service.route, task) : null;
  }

  // 设置页、引导页录键（hotkey-recording.mjs）：小帮手的录键模式、定稿、探测冲突、保存
  const recording = createHotkeyRecording({
    platform: process.platform,
    record: (on) => helper.record(on),
    probe: async (codes) => {
      const found = await helper.probe(nativeChord(codes, process.platform));
      if (found.timedOut) log.warn("hotkey_probe_timeout", { chord: chordString(codes) });
      return found;
    },
    chordsOf: (actionId) => chordsOf(hotkeySettings[settingNameOf(actionOf(actionId))]),
    save: (actionId, chords) => setHotkey(actionId, chordsValue(chords)),
    send: (contents, payload) => {
      if (!contents.isDestroyed()) contents.send("hotkey:recording", payload);
    },
    log,
  });

  // ---------- 划词翻译（lookup/） ----------

  /** 划词自己的自定义服务的 key：和语音那边的自定义服务分开存（他定的）。环境变量优先 */
  const lookupCustomKeys = createKeyStore({ file: keyFile(PATHS, LOOKUP_CUSTOM_KEY), safeStorage });
  function lookupCustomKey() {
    const fromEnv = process.env[LOOKUP_CUSTOM_KEY_ENV]?.trim();
    if (fromEnv) return { apiKey: fromEnv, source: "env" };
    const stored = lookupCustomKeys.load();
    return stored ? { apiKey: stored, source: "stored" } : null;
  }
  const lookupEngine = createLookupEngine({
    readSettings: () => resolveSettings({ file: PATHS.settingsFile, env: process.env }),
    keyOf: (id) => keys.keyOf(id),
    customKey: lookupCustomKey,
    log,
    // 划词的每一笔账也记上，开着的历史窗口跟着更新花费
    onCall: (call) => {
      history.addCall(call);
      historyChanged();
    },
  });
  // 主窗口改划词的设置：设置里的译成、引擎页"划词"那一段（换模型、检测、配自定义服务）
  const lookupSetup = createLookupSetup({
    engine: lookupEngine,
    readSettings: () => resolveSettings({ file: PATHS.settingsFile, env: process.env }),
    save: (name, value) => saveSetting(PATHS.settingsFile, name, value),
    customKeys: lookupCustomKeys,
    customKeyEnv: LOOKUP_CUSTOM_KEY_ENV,
    env: process.env,
    log,
  });
  const card = createCardWindow({
    BrowserWindow,
    screen,
    ipcMain,
    sourceDir,
    webPreferences: popupPreferences,
    windows: WINDOWS,
    capture: (regions) => {
      if (regions === null) {
        if (captureOwner !== "lookup") return;
        captureOwner = null;
        helper.release();
        return;
      }
      // 正在说话（悬浮条截着）：卡片不抢截取，收起
      if (captureOwner === "bar") {
        lookup.close("dictation");
        return;
      }
      captureOwner = "lookup";
      helper.capture(regions, { outside: true });
    },
    onAct: (action) => lookup.act(action),
    // 卡片页面崩了：这一张收起，页面重新加载，下一次划词照常出卡片
    onGone: () => lookup.close("card_gone"),
    log,
  });
  const lookup = createLookup({
    selection: () => helper.selection(),
    engine: lookupEngine,
    card,
    copy: (text) => clipboard.writeText(text),
    notify,
    record: (entry) => {
      history.add(entry);
      historyChanged();
    },
    // 正在说话（悬浮条截着键）时不理划词
    busy: () => captureOwner === "bar",
    openKeys: () => showHub({ route: "models", engine: "lookup" }),
    newId: () => crypto.randomUUID(),
    log,
  });

  // 端到端测试时不启动小帮手：不听真键盘，也绝不往用户当前的窗口里贴字
  if (e2e) helper = e2e.fakeHelper;
  else launchHelper({ prompt: true });

  // ---------- 页面要主进程代办的事 ----------

  const delivery = createDelivery({
    recordingsDir: PATHS.recordingsDir,
    history,
    paste: (text) => helper.paste(text),
    writeClipboard: (text) => clipboard.writeText(text),
    log,
  });
  function historyChanged() {
    hubWindow?.webContents.send("history:changed");
  }
  // 历史里重跑：按另一条路线跑一次，结果另存一条（app/rerun.mjs）。连着单独启动的服务端时路线归那边，做不了
  const rerun = service
    ? createRerun({
        history,
        keys,
        service,
        localModels,
        settingsFile: PATHS.settingsFile,
        env: process.env,
        recordingsDir: PATHS.recordingsDir,
        vocabulary: vocabulary.terms,
        describe: (problem) => t.text(problem),
        changed: historyChanged,
        log,
      })
    : null;

  /**
   * 页面调用主进程。出错时 Electron 只把 message 带给页面，problem 丢了，而 LocalizedError 的 message 是英文：
   * 这种错在这边按界面语言翻好再抛（比如设置文件坏了时改热键，中文界面要说中文）
   */
  function handle(channel, listener) {
    ipcMain.handle(channel, async (...args) => {
      try {
        return await listener(...args);
      } catch (error) {
        if (error instanceof LocalizedError) throw new Error(t.text(error.problem), { cause: error });
        throw error;
      }
    });
  }

  handle("config:get", () => ({ serverUrl, hotkeys: hotkeys.chords, barControls, barHint: currentBarHint() }));
  // 悬浮条每次开口时现读的设置：设置页、命令行、手改文件改了，下一次说话就按新的
  handle("bar:session-config", () => ({ translateTo: currentTranslateTo(), outputScript: currentOutputScript() }));
  handle("dictation:deliver", async (_event, payload) => {
    const result = await delivery.completed(payload);
    // 只记长度：成品是用户说的话，不进日志
    log.info("delivered", { audio_id: payload.audioId, text_length: payload.text.length, notice: result.notice });
    historyChanged();
    e2e?.onFinished({ delivered: payload.text, notice: result.notice });
    return result;
  });
  handle("dictation:failed", (_event, payload) => {
    delivery.failed(payload);
    log.warn("dictation_failed", { audio_id: payload.audioId, error: payload.error });
    historyChanged();
    e2e?.onFinished({ failed: payload.error });
  });
  // 搜索和按功能筛都在库里做（几百条也就几毫秒），页面只管画
  handle("history:list", (_event, filter) => history.list(filter ?? {}));
  // 回放：页面传 id，不传路径，只认历史里记的那个录音文件（不让页面指到录音目录外面去）
  handle("history:audio", (_event, id) =>
    readFileSync(recordingOf({ history, recordingsDir: PATHS.recordingsDir }, id).file),
  );
  const viaRerun = (use) => {
    if (!rerun) throw new LocalizedError(msg("key.externalModel"));
    return use(rerun);
  };
  handle("history:rerun-options", (_event, id) => viaRerun((r) => r.options(String(id))));
  handle("history:rerun", (_event, request) =>
    viaRerun((r) => r.run({ id: String(request?.id), mode: request?.mode, settings: request?.settings ?? {} })),
  );
  // 导出：现在搜索、筛选出来的全部记录（不止列表里那 200 条），格式按保存窗口里选的文件类型（app/history-export.mjs）
  handle("history:export", async (_event, filter) => {
    const picked = await dialog.showSaveDialog(hubWindow ?? undefined, {
      title: t("history.export"),
      defaultPath: `speakmore-history-${dayKey(new Date())}.md`,
      filters: Object.entries(EXPORTS).map(([extension, { name }]) => ({ name, extensions: [extension] })),
    });
    if (picked.canceled || !picked.filePath) return null;
    const format = extname(picked.filePath).slice(1).toLowerCase();
    const rows = history.list({ ...filter, limit: null });
    writeFileSync(picked.filePath, (EXPORTS[format] ?? EXPORTS.md).render(rows, t));
    log.info("history_exported", { format, rows: rows.length });
    return { count: rows.length };
  });
  handle("usage:report", () => usageReport(history, { now: new Date() }));
  // 首页的口述统计只数说话的功能（录音会话的动作：语音输入、语音翻译），花费另算、都记
  handle("insights:get", () => insights(history.dictations({ kinds: SPOKEN_ACTIONS }), { now: new Date() }));
  handle("app:info", () => ({ version: app.getVersion(), hotkeys: hotkeys.chords }));
  handle("app:open-homepage", () => shell.openExternal(HOMEPAGE));
  // 设置 › 通用的"软件更新"：检查、开始更新。进行到哪了跟着 setup:get 一起给（update）
  handle("update:check", () => appUpdates.check());
  handle("update:start", () => appUpdates.start());
  // 设置 › 通用的"存储位置 › 更改"：选文件夹，先检查（和命令行的 speakmore move 同一套，src/move），说清楚要拷多少、问一句，
  // 再起搬家的进度窗口（move-window.mjs）。它会请这个 App 退出，搬完从新位置把它打开
  handle("storage:change", async () => {
    const parent = hubWindow ?? undefined;
    const picked = await dialog.showOpenDialog(parent, {
      title: t("preferences.storage.pickTitle"),
      message: t("preferences.storage.pickMessage"),
      buttonLabel: t("preferences.storage.pickButton"),
      defaultPath: dirname(PATHS.home),
      properties: ["openDirectory", "createDirectory"],
    });
    if (picked.canceled || picked.filePaths.length === 0) return { started: false };
    const [folder] = picked.filePaths;
    const mover = createMove({ paths: PATHS, env: process.env, instance: createInstance({ paths: PATHS }) });
    const plan = await mover.plan(folder);
    const detail = [t("preferences.storage.confirmDetail", { size: sizeText(plan.bytes), count: plan.files })];
    if (plan.unknown.length > 0) detail.push(t("preferences.storage.unknown", { items: t.list(plan.unknown) }));
    const { response } = await dialog.showMessageBox(parent, {
      type: "question",
      message: t("preferences.storage.confirm", { to: plan.to }),
      detail: detail.join("\n\n"),
      buttons: [t("preferences.storage.move"), t("preferences.storage.cancel")],
      defaultId: 0,
      cancelId: 1,
    });
    if (response !== 0) return { started: false };
    launchMove(folder);
    return { started: true };
  });
  handle("clipboard:write", (_event, text) => {
    if (typeof text !== "string") throw new TypeError("要复制的不是文字");
    clipboard.writeText(text);
  });

  // ---------- 词典页（renderer/hub/vocabulary.mjs） ----------

  const textArg = (value, what) => {
    if (typeof value !== "string") throw new TypeError(`${what}不是文字`);
    return value;
  };
  const textsArg = (value, what) => {
    if (!Array.isArray(value) || value.some((each) => typeof each !== "string")) {
      throw new TypeError(`${what}不是一组文字`);
    }
    return value;
  };

  handle("vocabulary:get", () => {
    // 文件坏了不抛：页面照实说是哪个文件、为什么，听写照常（不带词典，服务端记一条警告）
    let terms = [];
    let problem = null;
    try {
      terms = vocabulary.terms();
    } catch (error) {
      if (!(error instanceof LocalizedError)) throw error;
      problem = error.problem;
    }
    const route = service?.route ?? ROUTE;
    return {
      terms,
      problem,
      file: PATHS.vocabularyFile,
      limits: { maxTerms: MAX_TERMS, maxTermLength: MAX_TERM_LENGTH },
      support: describeVocabularySupport(),
      current: { mode: route.mode, hops: vocabularyHops(route) },
    };
  });
  /**
   * 改词典的几样都记日志：做了什么、几个词，出错是哪种错。不记词本身（那是用户的内容）
   * @param {string} action
   * @param {(...args: any[]) => any} run
   * @param {(result: any) => number} count 这次动了几个词
   */
  const logged =
    (action, run, count = () => 1) =>
    async (...args) => {
      try {
        const result = await run(...args);
        log.info("vocabulary_changed", { action, count: count(result) });
        return result;
      } catch (error) {
        log.warn("vocabulary_failed", { action, error: error?.problem?.key ?? error?.code ?? error?.name });
        throw error;
      }
    };
  handle(
    "vocabulary:add",
    logged("add", (_event, term) => vocabulary.add(textArg(term, "要添加的词"))),
  );
  handle(
    "vocabulary:update",
    logged("update", (_event, previous, term) =>
      vocabulary.update(textArg(previous, "原来的词"), textArg(term, "改成的词")),
    ),
  );
  handle(
    "vocabulary:remove",
    logged(
      "remove",
      (_event, terms) => vocabulary.remove(textsArg(terms, "要删除的词")).removed,
      (removed) => removed,
    ),
  );
  // 导入分两步，同原版：先选文件、看一眼能加几个（预览），确认了再加
  handle("vocabulary:preview-import", async () => {
    const picked = await dialog.showOpenDialog(hubWindow ?? undefined, {
      properties: ["openFile"],
      filters: [{ name: "CSV", extensions: ["csv", "txt"] }],
    });
    if (picked.canceled || picked.filePaths.length === 0) return null;
    const [file] = picked.filePaths;
    return { fileName: basename(file), ...vocabulary.preview(await readImportFile(file)) };
  });
  handle(
    "vocabulary:import",
    logged(
      "import",
      (_event, terms) => vocabulary.importTerms(textsArg(terms, "要导入的词")),
      (added) => added,
    ),
  );

  // ---------- 主窗口的设置要主进程代办的事 ----------

  handle("setup:get", () => {
    const setup = currentSetup();
    return {
      ...setup,
      summary: summarizeSetup(setup),
      // 每个动作一行：设置里存的组合、装着的、默认的、装不上的；叫什么由页面按界面语言写，这里只给 code
      hotkeyActions: describeHotkeyActions(),
      theme: { value: theme.id, choices: THEMES.map(({ id }) => id) },
      barHint: currentBarHint(),
      // 录音时在悬浮条上预览暂定文字：只有本机识别有，云端没有
      livePreview: currentLivePreview(),
      // 语音翻译译成哪几种（第一种是默认）、能选哪些、最多几种
      translate: { to: currentTranslateTo(), choices: LANGUAGES.map(({ id }) => id), max: MAX_TRANSLATE_TARGETS },
      // 听写成品的中文字形、能选哪些（简体，繁体香港、台湾字形）
      outputScript: { value: currentOutputScript(), choices: OUTPUT_SCRIPTS },
      // 划词翻译：译成哪一种、能选哪些，交给哪个模型、自定义服务的地址参数和 key 在哪（货架在 plaza.shelves.lookup）
      lookup: { ...lookupSetup.describe(), choices: LANGUAGES.map(({ id }) => id) },
      language: { value: languageSetting, locale },
      // 开机启动登记的是"这个应用"；从终端启动时登记上去的会是 Electron 本身，所以只在装成应用后开放
      openAtLogin: {
        supported: app.isPackaged || INSTALLED_ON_WINDOWS,
        enabled: loginItemEnabled(),
      },
      home: PATHS.home,
      version: app.getVersion(),
      update: appUpdates.describe(),
      // 正在用 key 的那一家；数据隐私模式不用 key，是 null
      provider: provider() ? describeVendor(provider()) : null,
      ...describeModes(),
      // 侧栏"模型"一页：三排货架和密钥表（model-plaza.mjs）
      plaza: describePlazaNow(),
      // 连着单独启动的服务端时用哪种模式、哪家由那边定，这里换不了
      switchable: Boolean(service),
    };
  });

  /** 模型广场按现在的设置、key、本机模型的状态拼出来 */
  function describePlazaNow() {
    const settings = resolveSettings({ file: PATHS.settingsFile, env: process.env });
    let freeBytes = null;
    try {
      freeBytes = freeBytesAt(PATHS.modelsDir);
    } catch (error) {
      log.warn("disk_space_unknown", { error: String(error) });
    }
    return describePlaza({
      mode: service?.route.mode ?? ROUTE.mode,
      chosen: {
        native: settings.model.value,
        transcriber: settings.transcriber.value,
        privateTranscriber: settings.privateTranscriber.value,
        polish: settings.polish.value,
        customUrl: settings.customUrl.value,
        customParams: settings.customParams.value,
      },
      keys: service ? keys.sources() : {},
      status: Object.fromEntries(MODELS.map(({ id }) => [id, localModels.status(id)])),
      chip: CHIP,
      freeBytes,
      prices,
      routes: Object.fromEntries(MODES.map(({ id }) => [id, routeOrProblem(settings, id)])),
      presets: presetsFor(CHIP).map((preset) => ({
        preset,
        route: routeOrProblem(settings, preset.mode, preset.settings),
      })),
      at: estimateTime(new Date()),
    });
  }

  /**
   * 某种方式按设置（再换上 changes 那几项）走的路线；拼不出路线时（比如自定义服务没写模型名）交出原因，
   * 首页的选单、模型页的推荐组合照实说
   */
  function routeOrProblem(settings, mode, changes = {}) {
    try {
      return routeOf(patchSettings(settings, changes), mode);
    } catch (error) {
      return { problem: problemOf(error) };
    }
  }

  /** 设置里要的一家的说明，带着它的 key 在哪（env / stored / null，不解密） */
  function describeVendor(found) {
    const sources = service ? keys.sources() : {};
    return {
      id: found.id,
      name: found.name,
      keyEnv: found.keyEnv,
      key: sources[found.id] ?? null,
      hasKeyPage: Boolean(found.keyPage),
      defaultModel: found.defaultModel ?? null,
      // 能挑的模型：{ id, name, maker }
      models: found.models ?? [],
    };
  }

  /**
   * 三种模式各自的设置：正在用的是哪种，native 选了哪个模型，local 两跳各选了什么，private 选了哪个本机模型。
   * 没在用的那种模式也要列：设置里可以先改好它，切过去时就用上
   */
  function describeModes() {
    const settings = resolveSettings({ file: PATHS.settingsFile, env: process.env });
    let freeBytes = null;
    try {
      freeBytes = freeBytesAt(PATHS.modelsDir);
    } catch (error) {
      log.warn("disk_space_unknown", { error: String(error) });
    }
    return {
      mode: { value: service?.route.mode ?? ROUTE.mode, choices: MODES.map(({ id }) => id) },
      native: { model: settings.model.value, providers: PROVIDERS.map(describeVendor) },
      private: { transcriber: settings.privateTranscriber.value },
      local: {
        transcriber: settings.transcriber.value,
        transcribers: MODELS.map((model) => ({
          id: model.id,
          name: model.name,
          // 出自哪家，界面按它配图标
          maker: makerOf(model),
          license: model.license.name,
          bytes: downloadSize(model),
          // 下好了没有、正在下到哪、下过一半的有多少、上次为什么没下下来
          ...localModels.status(model.id),
          tags: tagsOn(model, CHIP),
          // 在这类芯片上的实测，跑得快的在前；没测过是空的
          measured: measuredOn(model, CHIP),
        })),
        chip: CHIP,
        // 模型目录那块磁盘还剩多少，查不了是 null
        freeBytes,
        // 本地模型从哪下：哪种模式里都能换
        source: { value: settings.modelSource.value, choices: SOURCES.map(({ id }) => id) },
        // 本机模型用不用显卡：正在用的那个（被环境变量盖着时是环境变量里的）
        acceleration: { value: acceleration, choices: ACCELERATIONS },
        memory: { value: localModelMemory, choices: LOCAL_MODEL_MEMORY },
        polish: settings.polish.value,
        customUrl: settings.customUrl.value,
        customParams: settings.customParams.value,
        vendors: CHAT_VENDORS.map(describeVendor),
      },
    };
  }

  /** 这几件事归模式那一层管；连着单独启动的服务端时做不了 */
  const viaModes = (action) => (modes ? action(modes) : { ok: false, problem: msg("key.externalModel") });

  // 设置里和 speakmore key 存 key、删 key，走的是同一处。
  // 给别家存 key 时可以带上要一起换成的设置（changes），拿它们验证：自定义服务没有默认模型，要连模型名一起给
  handle("setup:save-key", (_event, value, id, changes) =>
    keys.save(value, {
      provider: id ?? keys.provider?.id,
      ...(id && changes && modes ? { route: modes.routeForVendor(id, changes) } : {}),
    }),
  );
  handle("setup:forget-key", (_event, id) => keys.forget({ provider: id ?? keys.provider?.id }));
  // 设置里的"检查"：哪种模式里都能查，按页面上选的（还没换过去的）设置查
  handle("setup:check-model", (_event, mode, changes) => viaModes((m) => m.check(mode, changes ?? {})));
  // 模式这一层，和各模式里的模型：分开的几件事
  // 切模式时可以连带那种模式自己的设置（changes），比如第一次进 local 就用自定义服务。
  // 选了就当场换上，还差什么（key、下载）记在状态里，不拦着（app/modes.mjs）
  handle("setup:set-mode", (_event, mode, changes) => viaModes((m) => m.switchMode(mode, changes ?? {})));
  handle("setup:set-model", (_event, model) => viaModes((m) => m.setModel(model)));
  handle("setup:set-transcriber", (_event, id) => viaModes((m) => m.setTranscriber(id)));
  // 自定义服务的地址和额外参数（custom）和模型一起换，没给的照设置里的
  handle("setup:set-polish", (_event, polish, custom) => viaModes((m) => m.setPolish(polish, custom ?? {})));
  // 本机模型：下载、取消、删除都由用户点；正在用的不能删（模式那一层管）
  handle("setup:download-model", (_event, id) => localModels.download(id));
  handle("setup:cancel-download", (_event, id) => {
    localModels.cancel(id);
    return { ok: true };
  });
  handle("setup:delete-model", (_event, id) => viaModes((m) => m.removeModel(id)));
  // 检查本机模型：按界面语言念一句交给它转
  handle("setup:check-transcriber", (_event, id) => viaModes((m) => m.checkTranscriber(id, { locale })));
  handle("setup:open-key-page", (_event, id) => {
    // 自定义服务没有申请 key 的页面
    const { keyPage } = findVendor(id) ?? provider() ?? {};
    if (!keyPage) throw new TypeError(`${id} 没有申请 key 的页面`);
    return shell.openExternal(keyPage);
  });

  handle("setup:open-privacy", async (_event, permission) => {
    if (!Object.hasOwn(PRIVACY_PANES, permission)) throw new TypeError(`不认识的权限：${permission}`);
    // 麦克风从没问过时，系统设置的列表里还没有这个应用，要先让系统弹一次授权框（只有 macOS 有这种框）
    if (
      !WINDOWS &&
      permission === "microphone" &&
      systemPreferences.getMediaAccessStatus("microphone") === "not-determined"
    ) {
      await systemPreferences.askForMediaAccess("microphone");
      setupChanged();
      return;
    }
    await shell.openExternal(PRIVACY_PANES[permission]);
  });
  /** 两项系统权限是小帮手启动时查的，授权之后要重启它才看得到。它停了的话，这也是把它重新拉起来的办法 */
  function recheckPermissions() {
    if (!e2e) {
      helper.stop();
      launchHelper({ prompt: false });
    }
    setupChanged();
  }
  /** 启动时没连上网、先用着的 key，在后台再验一次。不等结果：没网时一等就是几十秒 */
  function reverifyKeyInBackground() {
    keys.reverify().catch((error) => log.error("key_reverify_failed", { error: String(error?.stack ?? error) }));
  }
  handle("setup:recheck", () => {
    recheckPermissions();
    reverifyKeyInBackground();
  });
  handle("setup:set-open-at-login", (_event, enabled) => {
    if (!app.isPackaged && !INSTALLED_ON_WINDOWS) throw new Error("从终端启动时不能设置开机启动");
    app.setLoginItemSettings({ ...LOGIN_ITEM, openAtLogin: Boolean(enabled) });
    log.info("open_at_login", { enabled: Boolean(enabled) });
    setupChanged();
  });
  // 录键（docs/hotkey-research.md 5.6）：页面点了某个组合（换掉它）或者"添加"，结果经 hotkey:recording 报回那个页面
  handle("hotkey:record", (event, action, index, token) => {
    editableHotkey(action);
    blockKeysWhileRecording(event.sender);
    recording.start(
      event.sender,
      action,
      Number.isInteger(index) && index >= 0 ? index : null,
      Number.isInteger(token) ? token : undefined,
    );
  });
  handle("hotkey:record-stop", (event, reason) => recording.stop(event.sender, reason));
  handle("setup:remove-hotkey", (_event, actionId, index) => {
    const action = editableHotkey(actionId);
    const chords = chordsOf(hotkeySettings[settingNameOf(action)]).filter((_, at) => at !== index);
    return setHotkey(action.id, chordsValue(chords));
  });
  handle("setup:reset-hotkey", (_event, actionId) => {
    const action = editableHotkey(actionId);
    const name = settingNameOf(action);
    unsetSetting(PATHS.settingsFile, name);
    log.info("hotkey_reset", { action: action.id });
    reloadHotkeys();
    return {};
  });
  /**
   * 页面要改的这个动作：认得、没被环境变量盖着。盖着时页面上看到的是环境变量里的组合，在它上面改再写进设置文件，
   * 会把文件里原来存的冲掉、把临时的值存成长期的；所以只让看，删掉环境变量才能改
   */
  function editableHotkey(actionId) {
    const action = actionOf(actionId);
    if (action === null) throw new TypeError(`不认识的动作：${actionId}`);
    const variable = overridingEnv(settingNameOf(action), process.env);
    if (variable !== null) throw new LocalizedError(msg("hotkeyRecord.envOverride", { variable }));
    return action;
  }
  handle("setup:set-theme", (_event, wanted) => {
    saveSetting(PATHS.settingsFile, "theme", wanted);
    reloadTheme();
    setupChanged();
    // 和热键一样：被环境变量盖着时，存是存下了，眼前不会变，要交代一句
    const variable = overridingEnv("theme", process.env);
    return variable === null ? {} : { note: msg("notes.envRemove", { variable }) };
  });
  handle("setup:set-model-source", (_event, wanted) => {
    saveSetting(PATHS.settingsFile, "modelSource", wanted);
    reloadModelSource();
    const variable = overridingEnv("modelSource", process.env);
    return variable === null ? {} : { note: msg("notes.envRemove", { variable }) };
  });
  handle("setup:set-acceleration", (_event, wanted) => {
    saveSetting(PATHS.settingsFile, "acceleration", wanted);
    acceleration = resolveSettings({ file: PATHS.settingsFile, env: process.env }).acceleration.value;
    log.info("acceleration_changed", { acceleration });
    // 装着本机模型的话按新的设置重装一遍
    service?.setAcceleration(acceleration);
    setupChanged();
    const variable = overridingEnv("acceleration", process.env);
    return variable === null ? {} : { note: msg("notes.envRemove", { variable }) };
  });
  handle("setup:set-local-model-memory", (_event, wanted) => {
    saveSetting(PATHS.settingsFile, "localModelMemory", wanted);
    localModelMemory = resolveSettings({ file: PATHS.settingsFile, env: process.env }).localModelMemory.value;
    log.info("local_model_memory_changed", { localModelMemory });
    // 改成常驻的当场装上；改成按需的从现在起算空闲
    service?.setLocalModelMemory(localModelMemory);
    setupChanged();
    const variable = overridingEnv("localModelMemory", process.env);
    return variable === null ? {} : { note: msg("notes.envRemove", { variable }) };
  });
  // 悬浮条上方的操作提示开不开：存下来，开着的悬浮条当场跟着变
  handle("setup:set-bar-hint", (_event, wanted) => {
    saveSetting(PATHS.settingsFile, "barHint", wanted);
    const barHint = currentBarHint();
    log.info("bar_hint_changed", { barHint });
    tellBar("bar:hint", barHint);
    setupChanged();
    const variable = overridingEnv("barHint", process.env);
    return variable === null ? {} : { note: msg("notes.envRemove", { variable }) };
  });
  // 设置 › 通用：录音时在悬浮条上预览暂定文字。下一次录音就按新的（服务端每次开口现看开关）
  handle("setup:set-live-preview", (_event, wanted) => {
    saveSetting(PATHS.settingsFile, "livePreview", wanted ? "on" : "off");
    const value = currentLivePreview();
    log.info("live_preview_changed", { livePreview: value });
    service?.setLivePreview(value);
    setupChanged();
    const variable = overridingEnv("livePreview", process.env);
    return variable === null ? {} : { note: msg("notes.envRemove", { variable }) };
  });
  // 设置 › 通用：听写成品的中文字形。悬浮条每次开口现读，下一次说话就按新的
  handle("setup:set-output-script", (_event, wanted) => {
    saveSetting(PATHS.settingsFile, "outputScript", wanted);
    log.info("output_script_changed", { outputScript: currentOutputScript() });
    setupChanged();
    const variable = overridingEnv("outputScript", process.env);
    return variable === null ? {} : { note: msg("notes.envRemove", { variable }) };
  });
  // 设置 › 语音翻译：译成哪几种，第一种是默认。悬浮条每次开口现读，下一次说话就按新的
  handle("setup:set-translate-to", (_event, wanted) => {
    if (!Array.isArray(wanted)) throw new TypeError("要译成的语言不是一组");
    const { value } = saveSetting(PATHS.settingsFile, "translate.to", JSON.stringify(wanted));
    log.info("translate_to_changed", { to: JSON.parse(value) });
    setupChanged();
    const variable = overridingEnv("translate.to", process.env);
    return variable === null ? {} : { note: msg("notes.envRemove", { variable }) };
  });
  // 划词翻译的设置（app/lookup/setup.mjs）：改了都让窗口重读一遍
  const lookupChanged = (result) => {
    if (result.ok) setupChanged();
    return result;
  };
  handle("setup:set-lookup-to", (_event, wanted) => lookupChanged(lookupSetup.setTo(wanted)));
  handle("setup:set-lookup-model", (_event, choice) => lookupChanged(lookupSetup.use(choice)));
  handle("setup:check-lookup", (_event, changes) => lookupSetup.check(changes));
  handle("setup:save-lookup-custom", async (_event, form) => lookupChanged(await lookupSetup.saveCustom(form ?? {})));
  handle("setup:forget-lookup-custom-key", () => lookupChanged(lookupSetup.forgetCustomKey()));
  handle("setup:set-language", (_event, wanted) => {
    saveSetting(PATHS.settingsFile, "language", wanted);
    // 是在设置的"通用"那一页换的：主窗口换好语言后回到这一页
    reloadLanguage({ hubTarget: { pane: "general" } });
    const variable = overridingEnv("language", process.env);
    return variable === null ? {} : { note: msg("notes.envRemove", { variable }) };
  });

  /**
   * 重新读一遍设置里的下载源，交给模型库：正在下的从新的源接着下，以后的下载也用它。不用重启
   * @returns {{ modelSource: string }} 实际用的那个（被环境变量盖着时是环境变量里的）
   */
  function reloadModelSource() {
    const { value } = resolveSettings({ file: PATHS.settingsFile, env: process.env }).modelSource;
    localModels.setSource(value);
    setupChanged();
    return { modelSource: value };
  }

  /**
   * 重新读一遍设置里的语言，变了就当场换：菜单栏重画，主窗口和首次引导重新加载（页面上的字都按新的语言写），
   * 悬浮条换掉翻译，下一句提示就是新的语言。不用重启
   * @param {{ hubTarget?: object }} [options] 主窗口重新加载后去哪一页；不给就留在原地
   */
  function reloadLanguage({ hubTarget } = {}) {
    languageSetting = resolveSettings({ file: PATHS.settingsFile, env: process.env }).language.value;
    const next = resolveLocale(languageSetting, app.getPreferredSystemLanguages());
    if (next !== locale) {
      locale = next;
      t = createTranslator(locale);
      refreshTrayMenu();
      tellBar("locale:changed", locale);
      card.localeChanged(locale);
      if (hubWindow !== null) {
        if (hubTarget) hubWindow.loadFile(join(sourceDir, "renderer", "hub", "hub.html"), { query: hubTarget });
        else hubWindow.webContents.reload();
      }
      if (onboardingWindow) {
        // 重新加载后从头开始：正停在测快捷键那一步的话，热键别再交给它，到那一步时它会再要
        hotkeyToOnboarding = false;
        onboardingWindow.webContents.reload();
      }
      log.info("language_changed", { language: languageSetting, locale });
    }
    return { language: languageSetting, locale };
  }

  /**
   * 重新读一遍设置里的热键，当场换上：给小帮手下发新的绑定表，悬浮条的提示、菜单栏跟着换。不用重启小帮手，更不用重启整个应用。
   * 设置页、引导页换了键（setHotkey），命令行 config set hotkey.<动作> 之后（reload-hotkeys）都走这里
   * @returns {Record<string, string> & { env?: Record<string, string> }} 每一项现在用的值；被环境变量盖着的，env 里写着是哪一个
   */
  function reloadHotkeys() {
    const settings = resolveSettings({ file: PATHS.settingsFile, env: process.env });
    const before = JSON.stringify(hotkeys.chords);
    hotkeys = resolveHotkeys(settings, process.platform);
    hotkeySettings = hotkeySettingValues(settings);
    logHotkeys("hotkeys_reloaded");
    if (JSON.stringify(hotkeys.chords) !== before) {
      helperHotkeyProblems = [];
      sendHotkeys();
      tellBar("bar:hotkeys", hotkeys.chords);
      historyChanged();
    }
    setupChanged();
    const env = {};
    for (const name of Object.keys(hotkeySettings)) {
      const variable = overridingEnv(name, process.env);
      if (variable !== null) env[name] = variable;
    }
    return { ...hotkeySettings, ...(Object.keys(env).length > 0 ? { env } : {}) };
  }

  /**
   * 设置页、引导页换某个动作的热键：查过、存进设置，当场换上
   * @param {string} actionId
   * @param {string} wanted 组合或一组组合（"ControlRight"、'["Fn","MetaRight"]'），写法同设置文件
   * @returns {{ note?: object }} 有话要交代时带一句（msg）：被环境变量盖着；能存但要提醒的
   */
  function setHotkey(actionId, wanted) {
    const action = actionOf(actionId);
    if (action === null) throw new TypeError(`不认识的动作：${actionId}`);
    const name = settingNameOf(action);
    const { warnings } = saveSetting(PATHS.settingsFile, name, wanted);
    log.info("hotkey_changed", { action: action.id, value: wanted });
    reloadHotkeys();
    const variable = overridingEnv(name, process.env);
    if (variable !== null) return { note: msg("notes.envRemove", { variable }) };
    // 地球仪键那条按系统设置说具体，设成"无操作"的不提醒
    const notes = warnings.map((warning) => refineWarning(warning, systemInfo)).filter(Boolean);
    return notes.length > 0 ? { note: notes[0] } : {};
  }

  /** 设置页、引导页的快捷键：动作目录里每个动作一行 */
  function describeHotkeyActions() {
    const problems = [...hotkeys.problems, ...helperHotkeyProblems];
    return ACTIONS.map((action) => {
      const name = settingNameOf(action);
      return {
        id: action.id,
        when: action.when,
        clearable: action.clearable,
        max: MAX_CHORDS,
        chords: chordsOf(hotkeySettings[name]),
        inEffect: hotkeys.chords[action.id],
        defaults: defaultChords(action, process.platform),
        // 存着的组合里装不上的（下发前查出来的、小帮手退回的），和一个都装不上、先用默认的那条
        problems: problems
          .filter((problem) => problem.action === action.id)
          .map((problem) =>
            problem.fallback ? { fallback: problem.fallback } : { chord: problem.chord, reason: problem.reason },
          ),
        env: overridingEnv(name, process.env),
      };
    });
  }

  /** 录键时拦住这个页面的按键：没有辅助功能权限的 Mac 上小帮手吞不了，⌘W、⌘Q 之类会作用在窗口上（5.6）。每个页面装一次 */
  const blocking = new WeakSet();
  function blockKeysWhileRecording(contents) {
    if (blocking.has(contents)) return;
    blocking.add(contents);
    contents.on("before-input-event", (event) => {
      if (recording.recordingFor(contents)) event.preventDefault();
    });
  }

  // ---------- 菜单栏、主窗口和首次引导 ----------

  /**
   * 打开主窗口（已经开着就亮出来），可以顺带指定去哪一页。
   * @param {{ route?: "home" | "history", pane?: string }} [target] pane：设置里的哪一页，"auto" 是还差东西的那一页
   */
  function showHub(target = {}) {
    if (hubWindow === null) {
      hubWindow = createHub(target);
    } else if (target.route || target.pane) {
      hubWindow.webContents.send("hub:navigate", target);
    }
    hubWindow.show();
    // 这是个没有程序坞图标的应用，不主动要一下焦点的话窗口会开在别的应用后面
    app.focus({ steal: true });
  }

  function createHub(target) {
    const window = new BrowserWindow({
      ...HUB_SIZE,
      title: "SpeakMore",
      backgroundColor: windowBackground(),
      // 和原版一样把标题栏藏起来，红绿灯放进侧栏的左上角
      ...frame({ x: 26, y: 24 }),
      webPreferences,
    });
    // 第一次打开时去哪一页写在地址里：页面加载完之前发消息是收不到的
    const query = Object.fromEntries(Object.entries(target).filter(([, value]) => value));
    window.loadFile(join(sourceDir, "renderer", "hub", "hub.html"), { query });
    window.on("focus", () => {
      // 切回来时重读一遍：窗口开着过了夜，"今天"要换成新的一天；用户去系统设置里改完权限再切回来，状态跟着刷新
      window.webContents.send("history:changed");
      window.webContents.send("setup:changed");
    });
    // 录键时切走了（点了别的应用、⌘Tab）就不录了：焦点不在这里，人也不在看
    const contents = window.webContents;
    window.on("blur", () => recording.stop(contents, "blur"));
    window.on("closed", () => {
      hubWindow = null;
      recording.stop(contents, "closed");
    });
    return window;
  }

  /** 首次引导（原版的 onboarding 窗口）：和主窗口一样大，红绿灯的位置照原版 */
  function showOnboarding() {
    if (onboardingWindow === null) {
      onboardingWindow = new BrowserWindow({
        ...HUB_SIZE,
        title: "SpeakMore",
        backgroundColor: windowBackground(),
        ...frame({ x: 20, y: 16 }),
        // 功能演示里嵌着悬浮条、划词卡片的真页面（onboarding/demo/，iframe）：预加载脚本在 iframe 里也跑，
        // 它们才有主题的颜色和界面语言。iframe 里只有我们自己的页面，跳转、开新窗口照样拦着
        webPreferences: { ...webPreferences, nodeIntegrationInSubFrames: true },
      });
      onboardingWindow.loadFile(join(sourceDir, "renderer", "onboarding", "onboarding.html"));
      onboardingWindow.on("focus", () => {
        // 用户多半是去系统设置里打开了开关再切回来：两项权限要重启小帮手才看得到。
        // 都给了就不重启，免得测快捷键、说话时小帮手平白断一下
        const { listen, trusted } = helperPermissions ?? {};
        if (listen !== true || trusted !== true) recheckPermissions();
        else setupChanged();
      });
      const contents = onboardingWindow.webContents;
      onboardingWindow.on("blur", () => recording.stop(contents, "blur"));
      onboardingWindow.on("closed", () => {
        onboardingWindow = null;
        hotkeyToOnboarding = false;
        recording.stop(contents, "closed");
      });
      // 页面崩了就没人说"测完了"
      onboardingWindow.webContents.on("render-process-gone", (_event, details) => {
        log.error("onboarding_gone", { reason: details.reason });
        hotkeyToOnboarding = false;
      });
    }
    onboardingWindow.show();
    app.focus({ steal: true });
  }

  ipcMain.on("onboarding:capture-hotkey", (_event, capturing) => {
    hotkeyToOnboarding = capturing === true;
  });
  // 走完了、跳过了：关掉引导，打开主窗口。engine：点的是"前往引擎"，打开引擎页并弹出推荐组合
  handle("onboarding:finish", (_event, { engine = false } = {}) => {
    log.info("onboarding_finished", { engine });
    onboardingWindow?.close();
    showHub(engine ? { route: "models", presets: true } : { route: "home" });
  });

  /** 菜单栏、双击图标要打开 SpeakMore 时：引导还没走完就回到引导，走完了是主窗口 */
  const showMain = () => (onboardingWindow ? showOnboarding() : showHub());

  const trayIcon = nativeImage.createFromPath(TRAY_ICON);
  const tray = new Tray(trayIcon);
  tray.setToolTip("SpeakMore");
  // 图标读不出来时菜单栏上会是空的一格，找不到入口。退回写两个字，并记下来
  if (trayIcon.isEmpty()) {
    log.error("tray_icon_missing", { path: TRAY_ICON });
  }

  function refreshTrayMenu() {
    if (trayIcon.isEmpty()) tray.setTitle(t("tray.fallbackTitle"));
    const update = appUpdates.describe();
    const summary = summarizeSetup(currentSetup());
    const headline = summary.ready
      ? t("tray.ready", { keycap: chordsText(hotkeys.chords.dictate) })
      : summary.missing.length > 0
        ? t("tray.missing", { items: t.list(summary.missing) })
        : t("tray.preparing");
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: headline, enabled: false },
        ...(summary.degraded ? [{ label: t.text(summary.degraded), enabled: false }] : []),
        { type: "separator" },
        // 下面几项照原版菜单栏的菜单（tray_menu__*）
        { label: t("tray.open"), click: () => showHub({ route: "home" }) },
        { label: t("tray.history"), click: () => showHub({ route: "history" }) },
        { type: "separator" },
        { label: t("tray.settings"), accelerator: "CmdOrCtrl+,", click: () => showHub({ pane: "general" }) },
        { type: "separator" },
        { label: t("tray.version", { version: app.getVersion() }), enabled: false },
        // 有新版本：点了打开设置的通用页，更新按钮在那里
        ...(update.available && update.progress?.state !== "running"
          ? [
              {
                label: t("tray.updateAvailable", { version: update.latest }),
                click: () => showHub({ pane: "general" }),
              },
            ]
          : []),
        { label: t("tray.quit"), accelerator: "CmdOrCtrl+Q", click: () => app.quit() },
      ]),
    );
  }
  // Windows 上点通知区域的图标是打开主窗口（右键才是菜单），macOS 上点它就是菜单
  if (WINDOWS) tray.on("click", () => showMain());
  refreshTrayMenu();
  localModelChanged = () => setupChanged();

  // 没有窗口时也继续待在菜单栏里
  app.on("window-all-closed", () => {});
  // 已经开着时又启动了一次。双击图标来的：把主窗口亮出来，让人知道它在哪。
  // speakmore 命令来的（两条命令同时启动，后到的那个）：那个人正看着终端，不弹窗口
  app.on("second-instance", (_event, _argv, _cwd, additionalData) => {
    if (!additionalData?.byCli) showMain();
  });
  app.on("before-quit", () => {
    rmSync(PATHS.pidFile, { force: true });
    // 先让小帮手的事件作废：它接下来的退出是我们自己关的，不该再报"按键监听停了"
    helperGeneration++;
    helper.stop();
    history.close();
    localModels.close();
    // 应用正在退出，这两样关不干净也不拦着；记一笔方便排查
    service?.close().catch((error) => log.warn("service_close_failed", { error: String(error) }));
    control?.close().catch((error) => log.warn("control_close_failed", { error: String(error) }));
  });

  // ---------- 命令行要主进程代办的事 ----------

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  /** 等小帮手把两项权限报上来，或者确定它起不来；最多等 3 秒 */
  async function helperReported() {
    for (let waited = 0; helperState === "starting" && waited < 3_000; waited += 50) await sleep(50);
  }

  /** 命令行说了它用哪种语言就按它的翻，没说（0.5 及以前的命令行）就按界面的 */
  const translatorFor = (wanted) => (wanted ? createTranslator(wanted) : t);
  /** 回给命令行的结果里那句 problem 翻成字：命令行（含旧版本的）和 --json 的读者都只认字 */
  const withProblemText = (result, say) => {
    if (!result) return result;
    const translated = { ...result };
    if (result.problem) translated.problem = say.text(result.problem);
    if (result.note) translated.note = say.text(result.note);
    return translated;
  };

  /** 交给命令行的状态。要给人看的话都按 say 的语言翻成字，原因见 summaryAsText */
  function describeStatus(say) {
    const setup = currentSetup();
    const route = service?.route ?? null;
    const native = route?.mode === "native";
    return {
      pid: process.pid,
      version: app.getVersion(),
      startedAt,
      // 启动时要等 key 验证完、麦克风的授权框有了回应，才算准备好
      starting: !startupChecked,
      // 设置里热键那几项（hotkey.<动作>），命令行拿它和设置文件比，看改了还没生效的
      ...hotkeySettings,
      // 实际装上的（写法同设置项）：设置里写的装不上时退回了默认键，告诉人按哪个要按这一份
      hotkeysInEffect: Object.fromEntries(
        ACTIONS.map((action) => [action.id, chordsValue(hotkeys.chords[action.id] ?? [])]),
      ),
      // 连着单独启动的服务端时，用哪个模型由那边定
      provider: service ? (keys.provider?.id ?? null) : null,
      // 每家的 key 在哪。装成应用的那个各存各的，命令行要靠这一项才知道
      keys: service ? keys.sources() : null,
      // 哪种模式、各用什么。model、thinking 只说 native 的：0.6 及以前的命令行把 model 当收音频的那家来读
      mode: route?.mode ?? null,
      model: native ? formatModelChoice(route.model) : null,
      thinking: native ? thinkingFor(keys.provider) : null,
      // local 的第一跳、private 的那一个本机模型
      transcriber: route?.mode === "local" || route?.mode === "private" ? route.transcriber : null,
      polish: route?.mode === "local" ? formatChatChoice(route.polish) : null,
      theme: theme.id,
      acceleration,
      localModelMemory,
      // 设置里的语言（system 是跟随系统）和实际用的那种
      language: languageSetting,
      locale,
      // 装成应用的和命令启动的，权限和 key 各是一套：命令行据此决定该不该代它重启
      packaged: app.isPackaged,
      ...setup,
      key: withProblemText(setup.key, say),
      localModel: setup.localModel && withProblemText(setup.localModel, say),
      // 每个本机模型下好了没有、正在下到哪（命令行看下载进度用）
      localModels: localModels.list().map((model) => withProblemText(model, say)),
      summary: summaryAsText(summarizeSetup(setup), say),
    };
  }

  // 端到端测试不开控制通道：它自己驱动整个流程，没有命令行参与
  control = e2e
    ? null
    : await startControlServer({
        socketPath: PATHS.controlSocket,
        log,
        handlers: {
          /** recheck：把会自己变的几样重新看一遍再回答（用户刚去系统设置里改过、网刚连上时用） */
          async status({ recheck = false, locale: wanted }) {
            if (recheck) {
              const denied = Object.values(helperPermissions ?? {}).includes(false);
              if (denied || helperState === "stopped") recheckPermissions();
              reverifyKeyInBackground();
            }
            await helperReported();
            return describeStatus(translatorFor(wanted));
          },
          // provider 不给就是正在用的那一家（0.3 的命令行不给）。changes：要一起换成的设置（先存 key 再切模式、
          // 换模型时给），拿它们验证；自定义服务没有默认模型，不给就验证不了
          "set-key": async ({ key, provider, changes, locale: wanted }) => {
            const say = translatorFor(wanted);
            let route;
            try {
              route = provider && changes && modes ? modes.routeForVendor(provider, changes) : undefined;
            } catch (error) {
              return { ok: false, problem: say.text(problemOf(error)) };
            }
            return withProblemText(await keys.save(key, { provider, route }), say);
          },
          // 模式这一层，和各模式里的模型。都是当场换，不用重启
          "set-mode": async ({ mode, changes, locale: wanted }) =>
            withProblemText(await viaModes((m) => m.switchMode(mode, changes ?? {})), translatorFor(wanted)),
          "set-model": async ({ model, locale: wanted }) =>
            withProblemText(await viaModes((m) => m.setModel(model)), translatorFor(wanted)),
          "set-transcriber": async ({ transcriber, locale: wanted }) =>
            withProblemText(await viaModes((m) => m.setTranscriber(transcriber)), translatorFor(wanted)),
          "set-polish": async ({ polish, customUrl, customParams, locale: wanted }) =>
            withProblemText(
              await viaModes((m) => m.setPolish(polish, { customUrl, customParams })),
              translatorFor(wanted),
            ),
          "forget-key": ({ provider } = {}) => keys.forget({ provider }),
          // native 的模型、local 第二跳的润色，各查各的
          "check-model": async ({ model, locale: wanted }) =>
            withProblemText(await viaModes((m) => m.check("native", { model })), translatorFor(wanted)),
          // 某种模式按改后的设置能不能用（云端的第一跳、数据隐私模式）
          "check-mode": async ({ mode, changes, locale: wanted }) =>
            withProblemText(await viaModes((m) => m.check(mode, changes ?? {})), translatorFor(wanted)),
          "check-polish": async ({ polish, customUrl, customParams, locale: wanted }) =>
            withProblemText(
              await viaModes((m) => m.checkPolish(polish, { customUrl, customParams })),
              translatorFor(wanted),
            ),
          "reload-theme": reloadTheme,
          "reload-language": () => reloadLanguage(),
          "reload-model-source": () => reloadModelSource(),
          "reload-hotkeys": () => reloadHotkeys(),
          // 本机模型：下载在后台下，进度看 status 的 localModels
          "download-model": async ({ id, locale: wanted }) =>
            withProblemText(await localModels.download(id), translatorFor(wanted)),
          "cancel-download": ({ id }) => {
            localModels.cancel(id);
            return { ok: true };
          },
          "delete-model": async ({ id, locale: wanted }) =>
            withProblemText(await viaModes((m) => m.removeModel(id)), translatorFor(wanted)),
          // 念的那句跟着命令行的语言走
          "check-transcriber": async ({ id, locale: wanted }) =>
            withProblemText(
              await viaModes((m) => m.checkTranscriber(id, { locale: wanted ?? locale })),
              translatorFor(wanted),
            ),
          // 命令行的名字沿用窗口还分开时的叫法：show-settings 打开设置里还差东西的那一页，
          // 第一次启动时命令行会带上 onboarding，打开首次引导
          "show-settings": ({ onboarding = false }) => (onboarding ? showOnboarding() : showHub({ pane: "auto" })),
          "show-history": () => showHub({ route: "history" }),
          // 先把这次的回答发出去再退出
          quit: () => void setImmediate(() => app.quit()),
        },
      });

  // ---------- 启动时的检查 ----------

  const keyLoaded = keys.loadAtStartup();
  if (e2e) {
    const loaded = await keyLoaded;
    if (loaded.state !== "ready")
      throw new Error(`端到端测试需要能用的 key：${t.text(loaded.problem) || loaded.state}`);
    await e2e.run({
      bar,
      history,
      localModel: () => service?.localModel,
      localModelMemory: () => localModelMemory,
      downloadModel: (id) => localModels.download(id),
      quit: (code) => app.exit(code),
    });
    return;
  }

  const granted = await askMicrophone();
  log.info("microphone_access", { granted });
  await keyLoaded;
  startupChecked = true;
  setupChanged();
  offerSettingsIfIncomplete();
  // 上一次是在这里点的更新、刚换好重新打开：把设置的通用页亮出来，说一句已更新到哪个版本。顺带看看有没有新版本
  if (appUpdates.afterLaunch()) showHub({ pane: "general" });
  // 已经开着时又去双击应用图标，系统不会再起一个，而是"重新打开"这一个：同样把主窗口亮出来。
  // 等启动检查做完才挂上，免得把启动本身也当成一次重新打开
  app.on("activate", showMain);
}
