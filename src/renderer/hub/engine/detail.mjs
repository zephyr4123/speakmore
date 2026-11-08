import { brand, h, platformName, progressBadge, svg } from "../../shared/dom.mjs";
import { t } from "../../shared/i18n.mjs";
import { fact, priceFacts } from "./facts.mjs";
import { itemKey, itemName, makerName, modeName, roleName } from "./plaza-view.mjs";
import { badges } from "./tree.mjs";

// 引擎页的详情：树的最后一节，点型号才出来，停在画布右边、不跟着缩放。一级（树上）只放名字和一个状态，
// 这里放全：标签、启用会不会连方式一起换、渠道、价格或规格、数据发到哪、还差什么、检测和启用、许可和删除。

/** 本机模型的五项规格（数取自 bench/results/asr-round1-2026-10-16.md）：评分越高越好，其余越低越好 */
const SPECS = [
  { spec: "zh", label: "plaza.cols.zh", tip: "plaza.cols.zhTip", better: "high", digits: 1, outOf: 5 },
  { spec: "mix", label: "plaza.cols.mix", tip: "plaza.cols.mixTip", better: "high", digits: 1, outOf: 5 },
  {
    spec: "minuteSeconds",
    label: "plaza.cols.minute",
    tip: "plaza.cols.minuteTip",
    better: "low",
    digits: 1,
    unitKey: "plaza.units.seconds",
  },
  { spec: "memoryGB", label: "plaza.cols.memory", tip: "plaza.cols.memoryTip", better: "low", digits: 1, unit: "GB" },
  { spec: "sizeMB", label: "plaza.cols.size", tip: "plaza.cols.sizeTip", better: "low", digits: 0, unit: "MB" },
];

/** 地址的主机名。填的地址还没验证、可能写错（漏了 https://）：认不出就照填的写 */
function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * @param {object} ctx 引擎页（page.mjs）
 * @param {HTMLElement} dock 停详情的那一格
 */
export function createDetail(ctx, dock) {
  const { ui, checks } = ctx;
  /** 上一次画的是哪一项：换了一项才放进场的动画，重画（下载进度、检测结果）时不再放 */
  let shown = null;

  /** 这一项的检测、操作结果记在哪：云端的按渠道分开记，换个渠道看的是那个渠道的 */
  const rowKey = (role, group, item) =>
    `${role}:${group.id}:${itemKey(item)}${group.kind === "cloud" ? `:${ctx.view.viaOf(role, group)}` : ""}`;

  /** 检测这一项：本机模型念一句交给它转，云端的按这一项的设置发一个最小的请求 */
  function checkCall(role, group, item) {
    const { view } = ctx;
    if (group.kind === "local") return () => window.speakmore.checkTranscriber(item.choice);
    const choice = view.choiceOf(role, group, item);
    if (role === "native") return () => window.speakmore.checkModel("native", { model: choice });
    if (role === "transcribe") return () => window.speakmore.checkModel("local", { transcriber: choice });
    const extra = group.kind === "custom" ? view.customExtra() : {};
    return () => window.speakmore.checkModel("local", { polish: choice, ...extra });
  }

  /** 渠道：同一模型多个平台都卖时的分段控件；勾是该平台已配置密钥 */
  function channel(role, group) {
    const { view } = ctx;
    const via = view.viaOf(role, group);
    const single = group.channels.length === 1;
    return h(
      "div",
      { class: "detail-channel" },
      h("span", { class: "detail-label", id: "detail-channel-label", text: t("plaza.channel.label") }),
      h(
        "div",
        {
          class: "segmented",
          role: "radiogroup",
          "aria-labelledby": "detail-channel-label",
          "data-indicator": "detail-channel",
          "data-single": single ? "" : null,
        },
        h("span", { class: "indicator", "aria-hidden": "true" }),
        ...group.channels.map((id) =>
          h(
            "button",
            {
              type: "button",
              class: "segment",
              role: "radio",
              "aria-checked": String(via === id),
              "aria-disabled": single ? "true" : null,
              title: `${platformName(view.platformOf(id) ?? { id, name: id })} · ${t(view.hasKey(id) ? "plaza.channel.keyed" : "plaza.channel.noKey")}`,
              onclick: single
                ? null
                : () => {
                    ui.via[group.id] = id;
                    ctx.draw();
                  },
            },
            brand(id),
            h("span", { class: "segment-name", text: view.channelName(group, id) }),
            view.hasKey(id) && svg("i-check", "icon key-mark"),
          ),
        ),
      ),
    );
  }

  /** 价格或规格，和它下面那行小字的口径 */
  function factsOf(role, group, item) {
    const { view } = ctx;
    if (group.kind === "local") {
      if (!item.specs) return { facts: [], note: null };
      const peers = group.items.filter(({ specs }) => specs);
      const facts = SPECS.filter(({ spec }) => typeof item.specs[spec] === "number").map((col) => {
        const value = item.specs[col.spec];
        const values = peers.map(({ specs }) => specs[col.spec]).filter((v) => typeof v === "number");
        const best = col.better === "high" ? Math.max(...values) : Math.min(...values);
        return fact({
          label: t(col.label),
          tip: t(col.tip),
          value: value.toFixed(col.digits),
          unit: col.outOf ? `/ ${col.outOf}` : col.unitKey ? t(col.unitKey) : col.unit,
          best: value.toFixed(col.digits) === best.toFixed(col.digits),
          meter: col.outOf ? value / col.outOf : null,
        });
      });
      return { facts, note: null };
    }
    if (group.kind === "custom") return { facts: [], note: null };
    const via = view.viaOf(role, group);
    const platform = platformName(view.platformOf(via) ?? { id: via, name: via });
    return priceFacts(view.offerOf(role, group, item)?.price, platform);
  }

  /** 数据去哪：录音、文字离不离开本机 */
  function path(role, group) {
    if (group.kind === "local") {
      return h(
        "p",
        { class: "detail-path", "data-tone": "local" },
        svg("i-shield-check"),
        h("span", { text: t("plaza.detail.audioLocal") }),
      );
    }
    const via = ctx.view.viaOf(role, group);
    const text =
      group.kind === "custom"
        ? t("plaza.detail.textToCustom")
        : t(role === "polish" ? "plaza.detail.textTo" : "plaza.detail.audioTo", {
            platform: platformName(ctx.view.platformOf(via) ?? { id: via, name: via }),
          });
    return h("p", { class: "detail-path" }, svg("i-cloud-upload"), h("span", { text }));
  }

  /** 还差什么：一行说明加一个去补的按钮（缺密钥、自定义服务没配齐、这个渠道不卖它） */
  function need(role, group, item) {
    const { view, setup } = ctx;
    const block = view.blocker(role, group, item);
    if (block === "channel") {
      const via = view.viaOf(role, group);
      return h(
        "p",
        { class: "detail-need" },
        svg("i-circle-alert"),
        h("span", { text: t("plaza.detail.notOnChannel", { platform: view.channelName(group, via) }) }),
      );
    }
    if (block !== "key" && block !== "custom") return null;
    const platform = block === "custom" ? "custom" : view.viaOf(role, group);
    return h(
      "div",
      { class: "detail-need" },
      svg("i-key-round"),
      h(
        "span",
        {},
        h("b", { text: platformName(view.platformOf(platform) ?? { id: platform, name: platform }) }),
        ` · ${t(block === "custom" ? "plaza.notice.custom" : "plaza.notice.noKey")}`,
      ),
      h("button", {
        type: "button",
        class: "button small",
        disabled: !setup.switchable,
        text: t(block === "custom" ? "plaza.actions.configure" : "plaza.actions.configureKey"),
        onclick: () => ctx.openKeys(platform, { back: true }),
      }),
    );
  }

  /** 右边的主操作：使用中、已选定、下载、启用；下载中时左边是进度、右边是取消 */
  function actions(role, group, item, key) {
    const { view, setup } = ctx;
    // 同一时间只发一件事（page.mjs 的 act）：有一件在等回话时（包括正在换识别方式），别的启用、下载也先不让点，免得点了没反应
    const busy = ctx.waiting();
    const block = view.blocker(role, group, item);
    const name = itemName(group, item, { withBuild: true });
    let left = h("span");
    let right;
    // 已选定、所在方式没在用的：照样能启用，点了连方式一起换过去（上面那行说明写着）
    if (view.isChosen(role, group, item) && view.modeFor(role, group) === setup.plaza.mode) {
      right = h("span", { class: "state-box block", "data-tone": "accent" }, svg("i-check"), t("plaza.inUse"));
    } else if (block === "downloading") {
      left = progressBadge(item.download);
      right = h("button", {
        type: "button",
        class: "button ghost block",
        disabled: busy,
        text: t("plaza.actions.cancel"),
        onclick: () =>
          ctx.act(key, () => window.speakmore.cancelDownload(item.choice), {
            done: () => ctx.toast(t("plaza.toast.canceled")),
          }),
      });
    } else if (block === "download") {
      right = h(
        "button",
        {
          type: "button",
          class: "button block",
          disabled: busy,
          onclick: () => ctx.act(key, () => window.speakmore.downloadModel(item.choice)),
        },
        svg("i-download"),
        t("plaza.actions.download", { size: `${Math.round(item.bytes / 1e6)} MB` }),
      );
    } else if (block !== null || !setup.switchable) {
      right = h("button", {
        type: "button",
        class: "button block",
        disabled: true,
        title: t("plaza.actions.needKey"),
        text: t("plaza.actions.use"),
      });
    } else {
      right = h("button", {
        type: "button",
        class: "button block",
        disabled: busy,
        text: t("plaza.actions.use"),
        "aria-label": `${t("plaza.actions.use")} ${name}`,
        onclick: () => ctx.use(role, group, item, key),
      });
    }
    // 检测：这一项都齐了才能测
    if (block === null) {
      const tip = group.kind === "local" ? t("plaza.check.localTip") : t("plaza.check.modelTip");
      left = checks.control(key, tip, checkCall(role, group, item));
    }
    return h("div", { class: "detail-actions" }, left, right);
  }

  function foot(role, group, item, key, note) {
    const { view } = ctx;
    const removable = group.kind === "local" && item.installed && !view.holds(role, group, item) && !item.download;
    const name = itemName(group, item, { withBuild: true });
    const text = [group.kind === "local" ? t("plaza.detail.license", { license: item.license }) : null, note]
      .filter(Boolean)
      .join(" · ");
    const custom = group.kind === "custom" && view.hasKey("custom");
    if (!text && !removable && !custom) return null;
    return h(
      "footer",
      { class: "detail-foot" },
      h("span", { text }),
      removable &&
        h("button", {
          type: "button",
          class: "link detail-link",
          disabled: ctx.waiting(),
          text: t("plaza.actions.remove"),
          "aria-label": t("plaza.actions.removeModel", { model: name }),
          onclick: () =>
            ctx.act(key, () => window.speakmore.deleteModel(item.choice), {
              done: () => ctx.toast(t("plaza.toast.removed", { model: name })),
            }),
        }),
      custom &&
        h("button", {
          type: "button",
          class: "link detail-link",
          text: t("plaza.keys.replace"),
          onclick: () => ctx.openKeys("custom", { back: true }),
        }),
    );
  }

  /** 自定义服务现在交给谁：模型名 · 主机名；没配齐时写它是什么 */
  function customLine() {
    const { view } = ctx;
    const choice = view.customChoice();
    const { url } = view.customNow();
    const text = choice && url ? `${choice.slice("custom/".length)} · ${hostOf(url)}` : t("plaza.custom.desc");
    return h("p", { class: "detail-custom", text });
  }

  function render() {
    const { view, setup } = ctx;
    const group = ui.detail ? setup.plaza.shelves[ui.role]?.find(({ id }) => id === ui.maker) : null;
    const item = group?.items.find((it) => itemKey(it) === ui.item);
    if (!item) {
      dock.replaceChildren();
      shown = null;
      return;
    }
    const role = ui.role;
    const key = rowKey(role, group, item);
    const entering = shown !== `${role}:${group.id}:${ui.item}`;
    shown = `${role}:${group.id}:${ui.item}`;
    const target = view.modeFor(role, group);
    const tags = badges(view, role, group, item);
    const { facts, note } = factsOf(role, group, item);
    const live = view.isChosen(role, group, item) && view.isLive(role);
    const icon =
      group.kind === "local" ? brand(item.maker) : group.kind === "custom" ? brand("custom") : brand(group.id);
    dock.replaceChildren(
      h(
        "article",
        {
          class: "detail",
          "aria-label": t("plaza.detail.label", { model: itemName(group, item, { withBuild: true }) }),
          "data-tone": live ? "live" : null,
          "data-enter": entering ? "" : null,
        },
        h(
          "header",
          { class: "detail-head" },
          h("span", { class: "logo-tile", "data-size": "lg" }, icon),
          h(
            "div",
            { class: "detail-titles" },
            h("h2", { class: "detail-name", text: itemName(group, item) }),
            h("p", { class: "detail-sub", text: `${roleName(role)} · ${makerName(group)}` }),
          ),
          h(
            "button",
            {
              type: "button",
              class: "icon-button detail-close",
              "aria-label": t("plaza.detail.close"),
              title: t("plaza.detail.close"),
              onclick: () => ctx.closeDetail(),
            },
            svg("i-close"),
          ),
        ),
        tags.length > 0 && h("div", { class: "detail-tags" }, tags),
        // 不在正在用的识别方式里：启用会连方式一起换
        target !== setup.plaza.mode &&
          h(
            "p",
            { class: "detail-note" },
            svg("i-info"),
            h("span", { text: t("plaza.detail.switchTo", { mode: modeName(target) }) }),
          ),
        group.kind === "cloud" && channel(role, group),
        group.kind === "custom" && customLine(),
        facts.length > 0 && h("dl", { class: "facts", "data-count": String(facts.length) }, facts),
        path(role, group),
        need(role, group, item),
        group.kind === "local" &&
          item.problem &&
          h("p", { class: "callout", role: "alert" }, svg("i-circle-alert"), h("span", {}, t.text(item.problem))),
        actions(role, group, item, key),
        checks.note(key),
        foot(role, group, item, key, note),
      ),
    );
  }

  return { render };
}
