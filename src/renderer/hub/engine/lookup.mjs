import { brand, h, platformName, svg } from "../../shared/dom.mjs";
import { t } from "../../shared/i18n.mjs";
import { describeError } from "../../shared/setup-text.mjs";
import { createChecks } from "../checks.mjs";
import { DOCK_ANCHOR, offsetIn } from "./canvas.mjs";
import { priceFacts } from "./facts.mjs";
import { lookupView } from "./lookup-view.mjs";
import { itemKey, itemName, makerName } from "./plaza-view.mjs";
import { curve, tagNode } from "./tree.mjs";

// 引擎页"划词"那一段：厂商 → 型号两列，点型号在右边出详情（检测、启用）。自定义服务的地址、模型名、key 直接在它的详情里填，
// 是划词自己的一份，和语音那一段（密钥面板里的自定义服务）不相干。清单里厂商的 key 和语音共用，缺了去密钥面板配。
// 只有两列、放得下，不上画布（不拖不缩）。状态怎么定在 lookup-view.mjs；换模型、配自定义服务交给主进程（app/lookup/setup.mjs）。

/** 节点下面那一行：一个小圆点或小图标，加几个字（同语音那一段的树） */
function line(kind, text) {
  const glyph = kind === "live" ? h("i", { class: "dot", "data-tone": "live" }) : svg("i-key-round");
  return h("span", { class: "node-line", "data-kind": kind }, glyph, h("span", { class: "node-line-text", text }));
}

/** 地址的主机名；认不出（还没验证、可能写错）就照填的写 */
function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * @param {object} options
 * @param {{ root: HTMLElement, stage: HTMLElement, tree: HTMLElement, links: SVGElement, makers: HTMLElement,
 *   models: HTMLElement, dock: HTMLElement, dockLinks: SVGElement }} options.els
 * @param {() => object | null} options.getSetup 最近一次拿到的状态
 * @param {() => Promise<object>} options.refresh 重新问主进程要一份状态，整个窗口跟着更新
 * @param {(platform: string, options: { back: boolean }) => void} options.openKeys 打开密钥面板、展开那一家
 * @param {(text: string) => void} options.toast
 * @param {() => void} options.placeIndicators 分段控件（渠道）的滑块按新排好的位置放
 */
export function createLookupSegment({ els, getSetup, refresh, openKeys, toast, placeIndicators }) {
  const ui = {
    /** 展开的是哪一家（组 id）、点开的是哪一项（itemKey）；detail 是详情开着 */
    maker: null,
    item: null,
    detail: false,
    /** 各组看的是哪个渠道：组 id → 平台 id */
    via: {},
    /** 正在等主进程回话的那一次操作，按钮不重复点 */
    busy: null,
    /** 自定义服务表单里填着的（地址、模型名、key、参数）：重画（切回窗口时会重读状态）不丢；存好了清掉 */
    form: null,
  };
  let view = null;
  const checks = createChecks(() => render());

  const currentGroup = () => view?.shelf.find(({ id }) => id === ui.maker) ?? null;
  /** 检测、操作结果记在哪：云端的按渠道分开记 */
  const rowKey = (group, item) =>
    `lookup:${group.id}:${itemKey(item)}${group.kind === "cloud" ? `:${view.viaOf(group)}` : ""}`;

  // ---------- 主进程那边的操作 ----------

  /** 发一件要等回话的事：同一时间只发一件；没成的原因挂在那一项下面，成了重读状态 */
  async function act(key, call, { done } = {}) {
    if (ui.busy !== null) return;
    ui.busy = key;
    delete checks.results[key];
    render();
    let result;
    try {
      result = await call();
    } catch (error) {
      result = { ok: false, problem: describeError(error) };
    } finally {
      ui.busy = null;
    }
    if (result?.ok === false)
      checks.results[key] = { state: "fail", problem: result.problem, title: "plaza.actionFailed" };
    else done?.(result ?? {});
    await refresh();
    if (result?.note) toast(t.text(result.note));
  }

  function use(group, item, key) {
    const choice = view.choiceOf(group, item);
    act(key, () => window.speakmore.setLookupModel(choice), {
      done: () => toast(t("plaza.toast.enabled", { model: itemName(group, item) })),
    });
  }

  function saveCustom(key) {
    const inUse = view.holds(...customSpot());
    const form = ui.form ?? formOf();
    act(key, () => window.speakmore.saveLookupCustom(form), {
      done: () => {
        ui.form = null;
        toast(t(inUse ? "plaza.toast.customUpdated" : "plaza.lookup.customEnabled"));
      },
    });
  }

  // ---------- 走到哪 ----------

  function pickMaker(id) {
    if (ui.maker === id && !ui.detail) return;
    ui.maker = id;
    ui.item = null;
    ui.detail = false;
    render();
  }

  function pickItem(key, event) {
    if (ui.item === key && ui.detail) {
      closeDetail();
      return;
    }
    ui.item = key;
    ui.detail = true;
    ui.form = null;
    render();
    // 用键盘打开的：焦点放进详情（鼠标点的不挪焦点，免得冒出聚焦框）
    if (event?.detail === 0) requestAnimationFrame(() => els.dock.querySelector(".detail-close")?.focus());
  }

  function closeDetail() {
    const key = ui.item;
    ui.detail = false;
    ui.form = null;
    render();
    if (key) [...els.models.children].find((el) => el.dataset.key === key)?.focus({ preventScroll: true });
  }

  // ---------- 树 ----------

  function makerNode(group) {
    const live = view.groupHolds(group);
    const block = view.groupBlocker(group);
    let status = null;
    if (live) status = line("live", t("plaza.inUse"));
    else if (block === "key") status = line("key", t("plaza.notice.noKey"));
    else if (block === "custom") status = line("key", t("plaza.notice.custom"));
    return h(
      "button",
      {
        type: "button",
        class: "node",
        "data-level": "maker",
        "data-key": group.id,
        "data-tone": live ? "live" : null,
        "data-dim": block !== null && !live ? "" : null,
        "aria-expanded": String(ui.maker === group.id),
        title: makerName(group),
        onclick: () => pickMaker(group.id),
      },
      h(
        "span",
        { class: "logo-tile", "data-dim": block !== null && !live ? "" : null },
        brand(group.kind === "custom" ? "custom" : group.id),
      ),
      h(
        "span",
        { class: "node-text" },
        h(
          "span",
          { class: "node-name-line" },
          h("span", { class: "node-name", text: makerName(group) }),
          h("span", { class: "node-count", text: String(group.items.length) }),
        ),
        status,
      ),
    );
  }

  /** 名字后面的标签：默认、已评测按划词自己的；看的渠道上没调过的加未验证 */
  function badges(group, item) {
    return [
      ...item.tags.map((tag) => tagNode(tag, tag.kind === "tested" ? t("plaza.lookup.testedTip") : null)),
      view.offerOf(group, item)?.unverified && tagNode({ kind: "unverified" }),
    ].filter(Boolean);
  }

  function leafMark(group, item) {
    if (view.holds(group, item)) {
      return h(
        "span",
        { class: "leaf-state", "data-tone": "live" },
        h("i", { class: "dot", "data-tone": "live" }),
        t("plaza.inUse"),
      );
    }
    const block = view.blocker(group, item);
    if (block !== "key" && block !== "custom") return null;
    const text = t(block === "custom" ? "plaza.notice.custom" : "plaza.notice.noKey");
    return h(
      "span",
      { class: "leaf-icon", title: text },
      svg("i-key-round"),
      h("span", { class: "visually-hidden", text }),
    );
  }

  function leaf(group, item) {
    const key = itemKey(item);
    const live = view.holds(group, item);
    const block = view.blocker(group, item);
    const tags = badges(group, item);
    return h(
      "button",
      {
        type: "button",
        class: "leaf",
        "data-key": key,
        "data-tone": live ? "live" : null,
        "data-dim": !live && (block === "key" || block === "custom") ? "" : null,
        "aria-expanded": String(ui.detail && ui.item === key),
        title: itemName(group, item),
        onclick: (event) => pickItem(key, event),
      },
      h(
        "span",
        { class: "leaf-text" },
        h("span", { class: "leaf-name", text: itemName(group, item) }),
        tags.length > 0 ? h("span", { class: "leaf-tags" }, tags) : null,
      ),
      leafMark(group, item),
    );
  }

  // ---------- 详情 ----------

  /** 渠道：同一模型多个平台都卖时的分段控件；勾是该平台已配置密钥 */
  function channel(group) {
    const via = view.viaOf(group);
    const single = group.channels.length === 1;
    const name = (id) => platformName(view.platformOf(id) ?? { id, name: id });
    return h(
      "div",
      { class: "detail-channel" },
      h("span", { class: "detail-label", id: "lookup-channel-label", text: t("plaza.channel.label") }),
      h(
        "div",
        {
          class: "segmented",
          role: "radiogroup",
          "aria-labelledby": "lookup-channel-label",
          "data-indicator": "lookup-channel",
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
              title: `${name(id)} · ${t(view.hasKey(id) ? "plaza.channel.keyed" : "plaza.channel.noKey")}`,
              onclick: single
                ? null
                : () => {
                    ui.via[group.id] = id;
                    render();
                  },
            },
            brand(id),
            h("span", { class: "segment-name", text: name(id) }),
            view.hasKey(id) && svg("i-check", "icon key-mark"),
          ),
        ),
      ),
    );
  }

  /** 还差什么：缺密钥给一个去配置的按钮（密钥面板，和语音共用），这个渠道不卖它只说一句 */
  function need(group, item) {
    const block = view.blocker(group, item);
    const via = view.viaOf(group);
    const name = platformName(view.platformOf(via) ?? { id: via, name: via });
    if (block === "channel") {
      return h(
        "p",
        { class: "detail-need" },
        svg("i-circle-alert"),
        h("span", { text: t("plaza.detail.notOnChannel", { platform: name }) }),
      );
    }
    if (block !== "key") return null;
    return h(
      "div",
      { class: "detail-need" },
      svg("i-key-round"),
      h("span", {}, h("b", { text: name }), ` · ${t("plaza.notice.noKey")}`),
      h("button", {
        type: "button",
        class: "button small",
        text: t("plaza.actions.configureKey"),
        onclick: () => openKeys(via, { back: true }),
      }),
    );
  }

  /** 右边的主操作：使用中，或者启用；都齐了左边是检测 */
  function actions(group, item, key) {
    const block = view.blocker(group, item);
    const choice = view.choiceOf(group, item);
    const left =
      block === null
        ? checks.control(key, t("plaza.check.modelTip"), () => window.speakmore.checkLookup({ "lookup.model": choice }))
        : h("span");
    const right = view.isChosen(group, item)
      ? h("span", { class: "state-box block", "data-tone": "accent" }, svg("i-check"), t("plaza.inUse"))
      : h("button", {
          type: "button",
          class: "button block",
          disabled: block !== null || ui.busy !== null,
          title: block === "key" ? t("plaza.actions.needKey") : null,
          text: t("plaza.actions.use"),
          "aria-label": `${t("plaza.actions.use")} ${itemName(group, item)}`,
          onclick: () => use(group, item, key),
        });
    return h("div", { class: "detail-actions" }, left, right);
  }

  /** 自定义服务那一项（[group, item]） */
  function customSpot() {
    const group = view.shelf.find(({ kind }) => kind === "custom");
    return [group, group.items[0]];
  }

  /** 自定义服务表单的初值：设置里存的（模型名只有在用时才有），key 不回显 */
  const formOf = () => ({ ...view.customNow(), apiKey: "" });

  /** 自定义服务：地址、模型名、key、参数四格，交上去先验再存，并换成它；已经在用时是保存 */
  function customForm(key) {
    const inUse = view.holds(...customSpot());
    const stored = getSetup().lookup.customKey;
    const values = ui.form ?? formOf();
    const field = (name, props) =>
      h("input", {
        class: "input",
        id: `lookup-custom-${name}`,
        autocomplete: "off",
        spellcheck: "false",
        value: values[name],
        oninput: (event) => {
          ui.form = { ...(ui.form ?? formOf()), [name]: event.target.value };
        },
        ...props,
      });
    return h(
      "form",
      {
        class: "key-entry",
        // 地址写得不对由主进程按界面语言说，不用浏览器自带的气泡
        novalidate: true,
        onsubmit: (event) => {
          event.preventDefault();
          saveCustom(key);
        },
      },
      field("url", {
        type: "url",
        placeholder: t("plaza.custom.urlPlaceholder"),
        "aria-label": t("plaza.custom.url"),
      }),
      field("model", { placeholder: t("plaza.custom.modelPlaceholder"), "aria-label": t("plaza.custom.model") }),
      field("apiKey", {
        type: "password",
        class: "input key-input",
        placeholder: stored ? t("plaza.custom.keyKept") : t("plaza.lookup.customKey"),
        "aria-label": t("plaza.lookup.customKey"),
      }),
      // 选填，放在密钥后面：多数服务用不上
      field("params", {
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
          disabled: ui.busy !== null,
          text: t(inUse ? "plaza.keys.save" : "plaza.actions.use"),
        }),
        stored === "stored" &&
          h("button", {
            type: "button",
            class: "button ghost",
            disabled: ui.busy !== null,
            text: t("plaza.lookup.removeKey"),
            onclick: () =>
              act(key, () => window.speakmore.forgetLookupCustomKey(), {
                done: () => toast(t("plaza.lookup.keyRemoved")),
              }),
          }),
      ),
    );
  }

  /** 自定义服务现在交给谁：在用时是 模型名 · 主机名，没在用时写它是什么 */
  function customLine() {
    const { model, url } = view.customNow();
    const inUse = view.holds(...customSpot());
    return h("p", { class: "detail-custom", text: inUse ? `${model} · ${hostOf(url)}` : t("plaza.custom.desc") });
  }

  /** 自定义服务在用时：检测和使用中（没在用时启用在表单里） */
  function customActions(key) {
    if (!view.holds(...customSpot())) return null;
    return h(
      "div",
      { class: "detail-actions" },
      view.groupBlocker(customSpot()[0]) === null
        ? checks.control(key, t("plaza.check.modelTip"), () => window.speakmore.checkLookup({}))
        : h("span"),
      h("span", { class: "state-box block", "data-tone": "accent" }, svg("i-check"), t("plaza.inUse")),
    );
  }

  /** 上一次画的是哪一项：换了一项才放进场的动画 */
  let shown = null;

  function renderDetail() {
    const group = ui.detail ? currentGroup() : null;
    const item = group?.items.find((it) => itemKey(it) === ui.item);
    if (!item) {
      els.dock.replaceChildren();
      shown = null;
      return;
    }
    const key = rowKey(group, item);
    const entering = shown !== `${group.id}:${ui.item}`;
    shown = `${group.id}:${ui.item}`;
    const custom = group.kind === "custom";
    const tags = badges(group, item);
    const via = view.viaOf(group);
    const platform = platformName(view.platformOf(via) ?? { id: via, name: via });
    const { facts, note } = custom ? { facts: [], note: null } : priceFacts(view.offerOf(group, item)?.price, platform);
    els.dock.replaceChildren(
      h(
        "article",
        {
          class: "detail",
          "aria-label": t("plaza.detail.label", { model: itemName(group, item) }),
          "data-tone": view.holds(group, item) ? "live" : null,
          "data-enter": entering ? "" : null,
        },
        h(
          "header",
          { class: "detail-head" },
          h("span", { class: "logo-tile", "data-size": "lg" }, brand(custom ? "custom" : group.id)),
          h(
            "div",
            { class: "detail-titles" },
            h("h2", { class: "detail-name", text: itemName(group, item) }),
            h("p", { class: "detail-sub", text: `${t("actions.lookup.name")} · ${makerName(group)}` }),
          ),
          h(
            "button",
            {
              type: "button",
              class: "icon-button detail-close",
              "aria-label": t("plaza.detail.close"),
              title: t("plaza.detail.close"),
              onclick: () => closeDetail(),
            },
            svg("i-close"),
          ),
        ),
        tags.length > 0 && h("div", { class: "detail-tags" }, tags),
        !custom && channel(group),
        custom && customLine(),
        facts.length > 0 && h("dl", { class: "facts", "data-count": String(facts.length) }, facts),
        h(
          "p",
          { class: "detail-path" },
          svg("i-cloud-upload"),
          h("span", {
            text: custom ? t("plaza.detail.textToCustom") : t("plaza.detail.textTo", { platform }),
          }),
        ),
        !custom && need(group, item),
        custom ? customForm(key) : actions(group, item, key),
        custom && customActions(key),
        checks.note(key),
        note && h("footer", { class: "detail-foot" }, h("span", { text: note })),
      ),
    );
  }

  // ---------- 线 ----------

  /** 展开的那一家 → 它的型号：在用的那一条主题色、线上一小段光；点开的那一项连到右边的详情 */
  function drawLinks() {
    const { tree, links } = els;
    if (!view || tree.offsetWidth === 0) return;
    const w = tree.offsetWidth;
    const hgt = tree.offsetHeight;
    links.setAttribute("viewBox", `0 0 ${w} ${hgt}`);
    links.setAttribute("width", String(w));
    links.setAttribute("height", String(hgt));
    const makerEl = [...els.makers.children].find((el) => el.dataset.key === ui.maker);
    const paths = [];
    for (const leafEl of makerEl ? els.models.children : []) {
      const a = offsetIn(makerEl, tree);
      const b = offsetIn(leafEl, tree);
      const live = leafEl.dataset.tone === "live";
      const open = ui.detail && ui.item === leafEl.dataset.key;
      const d = curve(a.right, a.top + a.height / 2, b.left, b.top + b.height / 2);
      paths.push({ weight: (live ? 2 : 0) + (open ? 0.5 : 0), d, kind: live ? "live" : "base", open });
    }
    paths.sort((a, b) => a.weight - b.weight);
    links.innerHTML = paths
      .map(({ d, kind, open }) => {
        const path = `<path class="link ${kind}${open ? " open" : ""}" vector-effect="non-scaling-stroke" d="${d}"/>`;
        return kind === "live" ? `${path}<path class="flow" vector-effect="non-scaling-stroke" d="${d}"/>` : path;
      })
      .join("");
    drawDockLink();
  }

  /** 点开的那一项连到右边停着的详情：按屏幕上的位置算 */
  function drawDockLink() {
    const { root, dock, dockLinks } = els;
    dockLinks.setAttribute("viewBox", `0 0 ${root.clientWidth} ${root.clientHeight}`);
    const card = dock.firstElementChild;
    const leafEl = ui.detail ? [...els.models.children].find((el) => el.dataset.key === ui.item) : null;
    if (!card || !leafEl) {
      dockLinks.replaceChildren();
      return;
    }
    const box = root.getBoundingClientRect();
    const a = leafEl.getBoundingClientRect();
    const b = card.getBoundingClientRect();
    const x1 = a.right - box.left;
    const x2 = b.left - box.left;
    if (x1 > x2 - 8) {
      dockLinks.replaceChildren();
      return;
    }
    const y1 = a.top + a.height / 2 - box.top;
    const y2 = Math.min(Math.max(y1, b.top - box.top + DOCK_ANCHOR), b.bottom - box.top - 24);
    const live = leafEl.dataset.tone === "live" ? " live" : "";
    dockLinks.innerHTML = `<path class="link open${live}" d="${curve(x1, y1, x2, y2)}"/><circle class="link-end${live}" cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="3"/>`;
  }

  // 详情开合时树往左让（过渡），窗口变大变小：线跟着重画
  new ResizeObserver(() => drawLinks()).observe(els.root);
  els.stage.addEventListener("transitionend", () => drawLinks());
  els.stage.addEventListener("scroll", () => drawDockLink(), { passive: true });

  // ---------- 总的 ----------

  /** 选的那几样在新状态里还在不在：不在了（模型清单变了）就退回一层 */
  function keepSelection() {
    if (!currentGroup()) {
      ui.maker = view.chosenSpot()?.group.id ?? view.shelf[0].id;
      ui.detail = false;
    }
    if (ui.detail && !currentGroup().items.some((item) => itemKey(item) === ui.item)) ui.detail = false;
  }

  /** 详情里该放焦点的那一个：还差的那一步，没差的就是主操作，都点不动就是关闭 */
  const detailFocusTarget = () =>
    els.dock.querySelector(".detail-need button:not(:disabled)") ??
    els.dock.querySelector(".detail-actions button:not(:disabled)") ??
    els.dock.querySelector(".detail-close");

  /** 重画会把两列和详情整块换掉：焦点在里面的，画完放回同一个（输入框连光标一起） */
  function keepingFocus(paint) {
    const active = document.activeElement;
    const inside = active && els.root.contains(active) && active !== els.root;
    const id = inside ? active.id : "";
    const key = inside ? active.closest("[data-key]")?.dataset.key : null;
    const column = inside ? active.closest(".tree-col")?.id : null;
    const name = inside && !id ? (active.getAttribute("aria-label") ?? active.textContent.trim()) : null;
    const selection = id && active.selectionStart !== null ? [active.selectionStart, active.selectionEnd] : null;
    paint();
    if (!inside || active.isConnected) return;
    let next = id ? document.getElementById(id) : null;
    if (!next && column && key)
      next = [...document.getElementById(column).children].find((el) => el.dataset.key === key);
    if (!next && name) {
      next = [...els.dock.querySelectorAll("button:not(:disabled)")].find(
        (el) => (el.getAttribute("aria-label") ?? el.textContent.trim()) === name,
      );
    }
    // 同一个没了（检测中换成了状态、启用以后成了使用中、密钥删了）：退到详情里还差的那一步或主操作上，不掉回页面开头
    if (!next && !column && ui.detail) next = detailFocusTarget();
    next?.focus({ preventScroll: true });
    if (next && selection) next.setSelectionRange(...selection);
  }

  function render() {
    const setup = getSetup();
    if (!setup?.plaza?.shelves.lookup || !setup.lookup) return;
    view = lookupView(setup, ui);
    keepSelection();
    keepingFocus(() => {
      els.makers.replaceChildren(...view.shelf.map(makerNode));
      const group = currentGroup();
      els.models.replaceChildren(...(group ? group.items.map((item) => leaf(group, item)) : []));
      renderDetail();
    });
    els.root.toggleAttribute("data-detail", ui.detail);
    placeIndicators();
    drawLinks();
  }

  return {
    render,
    closeDetail,
    get detailOpen() {
      return ui.detail;
    },

    /** 这一段刚露出来：量得出位置了，线重画 */
    shown() {
      requestAnimationFrame(() => drawLinks());
    },

    /**
     * 打开在用的那一项的详情（卡片上的"配置密钥"来的）；它缺密钥就顺手打开密钥面板，存好回到详情
     */
    openChosen() {
      if (!view) render();
      const spot = view?.chosenSpot();
      if (!spot) return;
      ui.maker = spot.group.id;
      ui.item = itemKey(spot.item);
      ui.detail = true;
      ui.form = null;
      // 先前在这一组换着看过别的渠道也不算：卡片说缺的是在用的那一份
      delete ui.via[spot.group.id];
      render();
      if (view.blocker(spot.group, spot.item) === "key") openKeys(view.viaOf(spot.group), { back: true });
    },

    /** 从密钥面板回到详情：焦点放在还差的那一步上，补齐了就放在启用上 */
    focusDetail() {
      detailFocusTarget()?.focus({ preventScroll: true });
    },
  };
}
