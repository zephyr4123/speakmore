import { ACTIONS, SPOKEN_ACTIONS } from "../../hotkeys/actions.mjs";
import { formatSeconds, formatTokens, formatUsd } from "../../usage/format.mjs";
import { h } from "../shared/dom.mjs";
import { t } from "../shared/i18n.mjs";
import { describeError } from "../shared/setup-text.mjs";
import { createRerunDialog } from "./history-rerun.mjs";
import { slidingIndicators } from "./indicators.mjs";
import { toast } from "./toast.mjs";

// 历史记录：按天分组（今天、昨天、再往前写日期），一行一条，鼠标移上去才出现播放、复制、重跑和详情。
// 和原版一样一行只有时间和文字；录音时长、模型用时、用到的型号和花费放在详情的悬停提示里。
// 翻译的那几条正文是译文，下面一行是小标签（功能 · 目标语言）和原文；重跑出来的，小标签写"重跑"。
// 标题右边按功能筛，下面是搜索：都在库里做（history:list），列表只显示最近 200 条，更老的也搜得到。
// 导出的是搜索、筛选出来的全部，格式在保存窗口里选。

const $ = (id) => document.getElementById(id);

const clock = new Intl.DateTimeFormat(t.locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const longDay = new Intl.DateTimeFormat(t.locale, { month: "long", day: "numeric", weekday: "long" });
const longDayWithYear = new Intl.DateTimeFormat(t.locale, {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
});

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** 分组的标题：今天、昨天，再往前写几月几日星期几（不是今年的带上年份） */
function dayTitle(day, now) {
  const today = startOfDay(now);
  const days = Math.round((today - day) / 86_400_000);
  if (days === 0) return t("history.today");
  if (days === 1) return t("history.yesterday");
  return (day.getFullYear() === now.getFullYear() ? longDay : longDayWithYear).format(day);
}

function formatDuration(seconds) {
  const whole = Math.round(seconds);
  return whole < 60
    ? t("units.seconds", { value: whole })
    : t("units.minutesSeconds", { minutes: Math.floor(whole / 60), seconds: whole % 60 });
}

/** 详情：录音多长（说话的功能才有录音，划词没有）、等了模型多久、花了多少，token 细节 */
function detailsOf(row) {
  const lines = SPOKEN_ACTIONS.includes(row.kind)
    ? [t("history.recording", { duration: formatDuration(row.duration) })]
    : [];
  if (row.usage) {
    const cost = row.usage.costUsd === null ? t("history.unpriced") : formatUsd(row.usage.costUsd);
    lines.push(t("history.model", { latency: formatSeconds(row.usage.latencyMs, t), cost }));
    lines.push(t("history.models", { models: row.usage.models.join(" · ") }));
    const tokens = { input: formatTokens(row.usage.inputTokens), output: formatTokens(row.usage.outputTokens) };
    lines.push(
      row.usage.calls > 1
        ? t("history.tokensCalls", { ...tokens, calls: row.usage.calls })
        : t("history.tokens", tokens),
    );
  }
  return lines.join("\n");
}

/** 能筛的功能：任何时候都能按的动作（取消不算） */
const FEATURES = ACTIONS.filter((action) => action.when === "always").map(({ id }) => id);

/**
 * @param {{ getSetup: () => object | null }} deps 最近一次拿到的状态（重跑对话框要平台的名字）
 */
export function createHistory({ getSetup }) {
  const dayTemplate = $("history-day");
  const rowTemplate = $("history-row");
  /** 最近一次拿到的记录 */
  let latest = [];
  /** 筛的是哪个功能；all 是全部 */
  let filter = "all";
  /** 搜的字；空的不过滤 */
  let search = "";
  /** 连着打字、连着点时前一次的结果可能后到：只认最后一次 */
  let loadToken = 0;
  let playToken = 0;
  let searchTimer;
  const indicators = slidingIndicators(document.querySelector('.page[data-route="history"]'));
  const rerunDialog = createRerunDialog({ getSetup });

  // ---------- 播放录音 ----------

  const player = new Audio();
  /** 正在放的那条：{ id, url } */
  let playing = null;

  /** 按钮跟着正在放的那条走：列表重画了，新画的那一行照样是"停止" */
  function markPlaying() {
    for (const button of $("history-days").querySelectorAll(".play")) {
      const on = playing?.id === button.closest(".entry").dataset.id;
      button.toggleAttribute("data-playing", on);
      button.querySelector("use").setAttribute("href", on ? "#i-square" : "#i-play");
      button.title = t(on ? "history.stop" : "history.play");
      button.setAttribute("aria-label", button.title);
    }
  }

  function stop() {
    if (playing === null) return;
    player.pause();
    player.removeAttribute("src");
    player.load();
    URL.revokeObjectURL(playing.url);
    playing = null;
    markPlaying();
  }

  player.addEventListener("ended", stop);

  /** 点正在放的那条是停下；点别的换成放它 */
  async function togglePlay(id) {
    const again = playing?.id === id;
    stop();
    if (again) return;
    const token = ++playToken;
    try {
      const bytes = await window.speakmore.historyAudio(id);
      if (token !== playToken) return;
      playing = { id, url: URL.createObjectURL(new Blob([bytes], { type: "audio/webm" })) };
      player.src = playing.url;
      markPlaying();
      await player.play();
    } catch (error) {
      stop();
      toast(t("history.playFailed", { reason: describeError(error) }));
    }
  }

  // ---------- 按功能筛、搜索、导出 ----------

  // 分段控件：全部，加每个功能一个
  $("history-filter").append(
    ...["all", ...FEATURES].map((id) =>
      h("button", {
        type: "button",
        class: "segment",
        role: "radio",
        "aria-checked": String(id === filter),
        "data-filter": id,
        text: id === "all" ? t("history.all") : t(`actions.${id}.name`),
        onclick: () => {
          filter = id;
          for (const segment of $("history-filter").querySelectorAll(".segment")) {
            segment.setAttribute("aria-checked", String(segment.dataset.filter === id));
          }
          indicators.place();
          refresh();
        },
      }),
    ),
  );

  // 打字停一下才查：每敲一个字都跑一次 SQL、重画一遍列表，在慢的电脑上会一跳一跳
  $("history-search").addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      search = $("history-search").value;
      refresh();
    }, 120);
  });

  /** 现在要的是哪些：搜索的字、只看哪几个功能 */
  const filtered = () => ({ query: search, kinds: filter === "all" ? null : [filter] });

  async function refresh() {
    const token = ++loadToken;
    try {
      const rows = await window.speakmore.listHistory(filtered());
      if (token !== loadToken) return;
      latest = rows;
      $("history-error").hidden = true;
      draw();
    } catch (error) {
      if (token === loadToken) showError(describeError(error));
    }
  }

  $("history-export").addEventListener("click", async () => {
    try {
      const done = await window.speakmore.exportHistory(filtered());
      if (done) toast(t("history.exportDone", { count: done.count }));
    } catch (error) {
      toast(t("history.exportFailed", { reason: describeError(error) }));
    }
  });

  // ---------- 画列表 ----------

  /** 小标签：重跑出来的写"重跑"，翻译的写功能和目标语言、后面是原文。都不是的不画 */
  function renderSource(node, row) {
    const tags = [
      row.rerunOf && t("history.rerun"),
      row.outputLanguage && `${t(`actions.${row.kind}.name`)} · ${t(`languages.${row.outputLanguage}`)}`,
    ].filter(Boolean);
    if (tags.length === 0) return;
    const source = node.querySelector(".entry-source");
    source.hidden = false;
    source.querySelector(".tag").textContent = tags.join(" · ");
    const original = source.querySelector(".entry-original");
    original.textContent = row.sourceText ?? "";
    original.title = row.sourceText ?? "";
  }

  function renderRow(row) {
    const node = rowTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.id = row.id;
    const time = node.querySelector("time");
    time.dateTime = row.createdAt;
    time.textContent = clock.format(new Date(row.createdAt));

    const text = node.querySelector(".entry-text");
    const copy = node.querySelector(".copy");
    if (row.status === "failed") {
      node.dataset.kind = "failed";
      // 失败的原因是当时界面上的那句话，记在历史里，不随语言再变
      text.dataset.prefix = t("history.failed");
      text.textContent = row.error;
      copy.dataset.absent = "";
    } else if (row.refinedText === "") {
      // 原版的说法：hub__history__item__empty__text
      node.dataset.kind = "silent";
      text.textContent = t("history.silent");
      copy.dataset.absent = "";
    } else {
      text.textContent = row.refinedText;
      copy.addEventListener("click", async () => {
        try {
          await window.speakmore.copyText(row.refinedText);
          copy.dataset.done = "";
          copy.title = t("history.copied");
        } catch (error) {
          console.error("复制失败", error);
          copy.title = t("history.copyFailed");
        }
        setTimeout(() => {
          delete copy.dataset.done;
          copy.title = t("history.copy");
        }, 1500);
      });
    }

    // 播放和重跑只对有录音的记录（划词没有录音）
    const play = node.querySelector(".play");
    const rerun = node.querySelector(".rerun");
    if (row.audioFile) {
      play.addEventListener("click", () => togglePlay(row.id));
      rerun.addEventListener("click", () => rerunDialog.open(row.id));
    } else {
      play.dataset.absent = "";
      rerun.dataset.absent = "";
    }

    renderSource(node, row);
    const details = node.querySelector(".details");
    details.title = detailsOf(row);
    details.setAttribute("aria-label", details.title);
    return node;
  }

  function draw() {
    $("history-empty").hidden = latest.length > 0;
    $("history-empty").textContent = search.trim() === "" ? t("history.empty") : t("history.noResults");

    const now = new Date();
    const groups = [];
    for (const row of latest) {
      const day = startOfDay(new Date(row.createdAt));
      const last = groups.at(-1);
      if (last && last.day.getTime() === day.getTime()) last.rows.push(row);
      else groups.push({ day, rows: [row] });
    }
    $("history-days").replaceChildren(
      ...groups.map(({ day, rows }) => {
        const node = dayTemplate.content.firstElementChild.cloneNode(true);
        node.querySelector(".day-title").textContent = dayTitle(day, now);
        node.querySelector(".entries").replaceChildren(...rows.map(renderRow));
        return node;
      }),
    );
    // 正在放的那条还在列表里就接着放（重跑途中每记一笔账都会重画），不在了才停
    if (latest.some((row) => row.id === playing?.id)) markPlaying();
    else stop();
  }

  function showError(message) {
    $("history-error").textContent = t("history.loadError", { reason: message });
    $("history-error").hidden = false;
  }

  return {
    /** 重读一遍（主进程说历史变了） */
    refresh,

    /** 页面切到前台时，分段控件的底块要按真实宽度重新放（藏着时量不出来） */
    shown() {
      indicators.reset();
      indicators.place();
    },

    showError,
  };
}
