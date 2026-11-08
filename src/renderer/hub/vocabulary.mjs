import { MAX_TERMS, termKey } from "../../vocabulary/terms.mjs";
import { $, brand, h, platformName, svg } from "../shared/dom.mjs";
import { t } from "../shared/i18n.mjs";
import { describeError } from "../shared/setup-text.mjs";
import { toast } from "./toast.mjs";

// 侧栏"词典"一页。结构照原版的词典页（targets/typeless/_work/ui-reference/typeless-dictionary.png）：
// 标题右边是导入和新词，下面是搜索，再下面一格一个词，鼠标移上去出现编辑、删除和多选的勾。
// 和原版不同的几处：
//   - 原版的词典在它的服务端，我们的只存在本机：标题下面一行写明这一点（当前方式里有收词典的云端模型时照实说随请求发出）；
//     "支持的模型"点开是全部模型各怎么收（数据来自主进程 app/vocabulary.mjs，按模型清单里写的拼）
//   - 新词就地输入、回车就加、接着输下一个；编辑在格子里直接改。删除、导入才弹对话框（要确认的事）
// 增删改都交给主进程（storage/vocabulary.mjs），改完重读一遍。
// 后台会时常让这一页重读（下载模型时每半秒、窗口拿回焦点时）：内容没变就不重画，正在格子里改词时先不动词格，
// 免得把改到一半的字存掉、把键盘焦点弄丢。

/** 搜索：大小写、全角半角不论，包含就算 */
export const matchTerms = (terms, query) => {
  const wanted = termKey(query.trim());
  return wanted === "" ? terms : terms.filter((term) => termKey(term).includes(wanted));
};

/** 有这个上限（主进程把"不限"写成 null） */
const limited = (value) => value !== null && value !== undefined;

/**
 * 收多少写成一个短语，放在"支持的模型"那一列："前 100 个词"、"前 600 字"、"全部词"；不收的是 null。
 * 个数上限不少于词典本身的上限（1000 个）就等于全收，不写
 */
export function limitText(support) {
  if (!support) return null;
  if (limited(support.maxTerms) && support.maxTerms < MAX_TERMS) {
    return t("vocabulary.support.limitTerms", { count: support.maxTerms });
  }
  if (limited(support.maxChars)) return t("vocabulary.support.limitChars", { count: support.maxChars });
  return t("vocabulary.support.limitAll");
}

/** 全部的上限，一条一行，悬停在那一列上看：个数、总字数、单个词的长度 */
export function limitDetail(support) {
  if (!support) return "";
  return [
    limited(support.maxTerms) && support.maxTerms < MAX_TERMS && ["terms", support.maxTerms],
    limited(support.maxChars) && ["chars", support.maxChars],
    limited(support.maxTermChars) && ["termChars", support.maxTermChars],
    limited(support.maxTermWords) && ["termWords", support.maxTermWords],
  ]
    .filter(Boolean)
    .map(([name, count]) => t(`vocabulary.support.limits.${name}`, { count }))
    .join("\n");
}

/** 输入法正在组字时的回车、Esc 是给输入法的（上屏、取消），不是给我们的 */
const composing = (event) => event.isComposing || event.keyCode === 229;

/** 收法的标签：做法用描边，不收的灰底；悬停说这种做法是怎么回事 */
function kindTag(kind) {
  const name = kind ?? "none";
  return h("span", {
    class: "tag",
    "data-tone": kind ? "outline" : null,
    title: t(`vocabulary.kindTips.${name}`),
    text: t(`vocabulary.kinds.${name}`),
  });
}

/** 导入前列出来给人看的词最多几个，多的写"还有 N 个" */
const PREVIEW_TERMS = 24;

/** 模型在哪：本机，或者卖它的平台 */
const whereOf = (platform) =>
  platform === "local" ? t("plaza.via.local") : platformName({ id: platform, name: platform });

export function createVocabulary() {
  /** 主进程给的：{ terms, problem, file, limits, support, current } */
  let data = null;
  /** 勾上的词（原样的写法） */
  const selected = new Set();
  /** 正在格子里改的那个词；没在改是 null */
  let editing = null;
  /** 刚加进来、要亮一下的词 */
  let fresh = null;
  /** 对话框确认时做的事：返回提示的那句话 */
  let onConfirm = null;
  /** 上次画出来的内容（主进程给的那份原样），一样就不重画 */
  let drawn = null;
  /** 改词时来了新内容：先不动词格，改完再画 */
  let deferred = false;

  const dialog = $("vocabulary-dialog");
  const confirmButton = $("vocabulary-dialog-confirm");
  const composer = $("vocabulary-composer");
  const composerInput = $("vocabulary-composer-input");

  async function reload() {
    let next;
    try {
      next = await window.speakmore.getVocabulary();
    } catch (error) {
      console.error("读词典失败", error);
      showError(t("vocabulary.loadError", { reason: describeError(error) }));
      return;
    }
    const snapshot = JSON.stringify(next);
    if (snapshot === drawn) return;
    data = next;
    drawn = snapshot;
    // 别处删掉了的词不再算勾着
    for (const term of selected) if (!data.terms.includes(term)) selected.delete(term);
    render();
  }

  function showError(text) {
    $("vocabulary-error").textContent = text;
    $("vocabulary-error").hidden = false;
  }

  function render() {
    $("vocabulary-error").hidden = data.problem === null;
    // 主进程给的那句话已经说了是哪个文件、怎么了，不再加前缀
    if (data.problem) showError(t.text(data.problem));
    $("vocabulary-local").title = t("vocabulary.localTip", { file: data.file });
    // 当前方式里有收词典的云端模型，词就会随听写的请求发出去：照实写
    const leaves = data.current.hops.some(({ platform, kind }) => platform !== "local" && kind !== null);
    $("vocabulary-local-text").textContent = t(`vocabulary.local.${leaves ? "cloud" : "device"}`);
    // 文件坏了不能改：先照提示修好文件，免得把它覆盖掉
    const full = data.terms.length >= data.limits.maxTerms;
    // 置灰的按钮悬停时说为什么
    const blocked = data.problem ? t("vocabulary.fixFileFirst") : null;
    const fullText = full ? t("vocabulary.full", { max: data.limits.maxTerms }) : null;
    for (const id of ["vocabulary-add", "vocabulary-empty-add"]) {
      $(id).disabled = blocked !== null || full;
      $(id).title = blocked ?? fullText ?? "";
    }
    $("vocabulary-import").disabled = blocked !== null;
    $("vocabulary-import").title = blocked ?? "";
    if (full || data.problem) closeComposer();
    renderSupport();
    if (editing !== null) deferred = true;
    else renderTerms();
  }

  /** "支持的模型"浮层：原生识别、转写、润色三段；转写按在哪分组（本机、各家平台），一个模型一行，前面是厂商的标志 */
  function renderSupport() {
    const { native, transcribe, polish } = data.support;
    const row = ({ icon, name, support }) =>
      h(
        "li",
        { class: "vocab-support-row", "data-off": support ? null : true },
        icon,
        h("span", { class: "vocab-support-name", text: name }),
        h("span", { class: "vocab-support-limit", text: limitText(support) ?? "", title: limitDetail(support) }),
        kindTag(support?.kind ?? null),
      );
    // 原生识别、润色不分模型，一行"全部模型"：标志那一格空着，名字和下面各行对齐
    const allModels = (support) =>
      row({ icon: h("span", { "aria-hidden": "true" }), name: t("vocabulary.support.all"), support });
    const section = (title, rows) =>
      h(
        "section",
        { class: "vocab-support-role" },
        h("h3", { class: "vocab-support-title", text: title }),
        h("ul", { class: "vocab-support-rows" }, rows),
      );
    const role = (id) => t(`vocabulary.support.roles.${id}`);
    const platforms = [...new Set(transcribe.map(({ platform }) => platform))];
    $("vocabulary-support-list").replaceChildren(
      section(role("native"), [allModels(native)]),
      ...platforms.map((platform) =>
        section(
          `${role("transcribe")} · ${whereOf(platform)}`,
          transcribe
            .filter((model) => model.platform === platform)
            .map((model) =>
              row({ icon: brand(model.maker ?? model.platform), name: model.name, support: model.vocabulary }),
            ),
        ),
      ),
      section(role("polish"), [allModels(polish)]),
    );
  }

  function renderTerms() {
    deferred = false;
    const query = $("vocabulary-search").value;
    const shown = matchTerms(data.terms, query);
    // 文件读不出时没有可数的；一个词都没有时下面有空的说明，不写"0 个词"
    $("vocabulary-count").textContent =
      data.problem || data.terms.length === 0 ? "" : t("vocabulary.count", { count: data.terms.length });
    const empty = data.problem === null && shown.length === 0;
    const hasTerms = data.terms.length > 0;
    // 一个词都没有时：标题行的"新词"和搜索那一行先收起来，屏上只有空状态里那一个"新词"（一屏只放一个主按钮），
    // 也没什么可搜的。导入留在标题行，加了第一个词以后都回来
    const first = data.problem === null && !hasTerms;
    $("vocabulary-add").hidden = first;
    $("vocabulary-search").closest(".toolbar").hidden = first;
    $("vocabulary-empty").hidden = !empty;
    $("vocabulary-empty").dataset.kind = hasTerms ? "search" : "first";
    $("vocabulary-empty-title").textContent = hasTerms ? t("vocabulary.noResults") : t("vocabulary.empty.title");
    $("vocabulary-empty-text").hidden = hasTerms;
    $("vocabulary-empty-add").hidden = hasTerms;
    const grid = $("vocabulary-grid");
    // 重画前焦点在哪个词的哪个按钮上，画完放回去（键盘操作不会掉到页面最前面）
    const focused = grid.contains(document.activeElement) ? document.activeElement.dataset.focus : undefined;
    grid.toggleAttribute("data-selecting", selected.size > 0);
    grid.replaceChildren(...shown.map((term) => (term === editing ? editCard(term) : termCard(term))));
    if (focused) grid.querySelector(`[data-focus="${CSS.escape(focused)}"]`)?.focus();
    fresh = null;
    renderSelection(shown);
  }

  /** 一个词都没有时搜索那一行和标题行的"新词"都收起了，只剩空状态里的"新词" */
  const firstAdd = () => ($("vocabulary-add").hidden ? $("vocabulary-empty-add") : null);

  /** 词格之外的东西关掉、删掉以后，焦点放到哪：搜索框；一个词都没有时是空状态里的"新词" */
  const focusFallback = () => {
    if (document.activeElement === document.body || document.activeElement === null)
      (firstAdd() ?? $("vocabulary-search")).focus();
  };

  function toggle(term) {
    if (selected.has(term)) selected.delete(term);
    else selected.add(term);
    renderTerms();
  }

  /** 编辑、删除、多选的勾：平时藏着，鼠标移上去、焦点在格子里才出来；已经在多选时只剩勾 */
  function termCard(term) {
    const checked = selected.has(term);
    const tool = (name, icon, onclick) =>
      h(
        "button",
        {
          type: "button",
          class: "icon-button",
          title: t(`vocabulary.${name}`),
          "aria-label": `${t(`vocabulary.${name}`)} ${term}`,
          "data-focus": `${name}:${term}`,
          onclick,
        },
        svg(icon),
      );
    return h(
      "li",
      { class: "vocab-term", "data-selected": checked || null, "data-fresh": term === fresh || null },
      h("span", {
        class: "vocab-term-text",
        text: term,
        // 已经在多选时，点哪里都是勾选
        onclick: () => selected.size > 0 && toggle(term),
      }),
      h(
        "span",
        { class: "vocab-term-tools" },
        tool("edit", "i-pencil", () => startEdit(term)),
        tool("delete", "i-trash", () => openRemove([term])),
        h(
          "button",
          {
            type: "button",
            class: "vocab-check",
            role: "checkbox",
            "aria-checked": String(checked),
            "aria-label": `${t("vocabulary.select")} ${term}`,
            "data-focus": `select:${term}`,
            title: t("vocabulary.select"),
            onclick: () => toggle(term),
          },
          svg("i-check"),
        ),
      ),
    );
  }

  // ---------- 就地编辑：格子换成输入框，回车或点别处保存，Esc 放弃 ----------
  // 改完只换这一格，不重画整片词格：点别处时按下和松开要落在同一个按钮上，点击才算数

  function startEdit(term) {
    editing = term;
    renderTerms();
  }

  /** 改完了：这一格换回普通的格子；改的时候来了新内容就整片重画 */
  function endEdit(card, term, { focus = false } = {}) {
    editing = null;
    if (deferred || !card.isConnected) {
      renderTerms();
    } else {
      card.replaceWith(termCard(term));
      fresh = null;
    }
    if (focus)
      $("vocabulary-grid")
        .querySelector(`[data-focus="${CSS.escape(`edit:${term}`)}"]`)
        ?.focus();
  }

  function editCard(term) {
    const input = h("input", {
      class: "vocab-term-input",
      type: "text",
      value: term,
      autocomplete: "off",
      spellcheck: "false",
      "aria-label": `${t("vocabulary.edit")} ${term}`,
      title: t("vocabulary.editHint"),
    });
    const card = h("li", { class: "vocab-term", "data-editing": true }, input);
    let settled = false;
    /**
     * @param {boolean} save 存（回车、点别处）还是放弃（Esc）
     * @param {boolean} fromKeyboard 回车存的：存不成就留在输入框里改；点别处存不成就放弃这次修改，只提示原因
     */
    const finish = async (save, fromKeyboard = false) => {
      if (settled) return;
      settled = true;
      const value = input.value;
      if (!save || value.trim() === term) {
        endEdit(card, term, { focus: fromKeyboard });
        return;
      }
      try {
        const updated = await window.speakmore.updateTerm(term, value);
        if (selected.delete(term)) selected.add(updated);
        // 先在本地改好、记成已画：接着的重读和这一样，就不会整片重画（那会吞掉他正在点的下一下）
        data = { ...data, terms: data.terms.map((each) => (each === term ? updated : each)) };
        drawn = JSON.stringify(data);
        fresh = updated;
        endEdit(card, updated, { focus: fromKeyboard });
        toast(t("vocabulary.toast.updated", { term: updated }));
        await reload();
      } catch (error) {
        toast(describeError(error));
        if (!fromKeyboard || !card.isConnected) {
          endEdit(card, term);
          return;
        }
        settled = false;
        card.dataset.problem = "";
        card.title = describeError(error);
        input.focus();
      }
    };
    input.addEventListener("keydown", (event) => {
      if (composing(event)) return;
      if (event.key === "Enter") finish(true, true);
      if (event.key === "Escape") finish(false, true);
    });
    input.addEventListener("input", () => {
      delete card.dataset.problem;
      card.removeAttribute("title");
    });
    input.addEventListener("blur", () => finish(true));
    queueMicrotask(() => {
      input.focus();
      input.select();
    });
    return card;
  }

  /** 勾了词时出现的那一条：勾了几个、全选（搜出来的这些）、清除、删除 */
  function renderSelection(shown) {
    $("vocabulary-selection").hidden = selected.size === 0;
    $("vocabulary-selection-count").textContent = t("vocabulary.selection.count", { count: selected.size });
    $("vocabulary-select-all").onclick = () => {
      for (const term of shown) selected.add(term);
      renderTerms();
    };
  }

  // ---------- 新词：就地输入，回车加一个、接着输下一个 ----------

  function openComposer() {
    composer.hidden = false;
    setComposerProblem(null);
    composerInput.focus();
  }

  /** @param {{ focus?: boolean }} [options] focus：他自己收起的（Esc、点收起），焦点回到"新词"按钮 */
  function closeComposer({ focus = false } = {}) {
    const wasOpen = !composer.hidden;
    composer.hidden = true;
    composerInput.value = "";
    setComposerProblem(null);
    if (focus && wasOpen) (firstAdd() ?? $("vocabulary-add")).focus();
  }

  function setComposerProblem(problem) {
    $("vocabulary-composer-problem").textContent = problem ?? "";
    $("vocabulary-composer-problem").hidden = problem === null;
    composer.toggleAttribute("data-problem", problem !== null);
  }

  /** 正在加：连按两下回车只加一次 */
  let adding = false;
  composer.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (adding || composerInput.value.trim() === "") return;
    adding = true;
    try {
      const added = await window.speakmore.addTerm(composerInput.value);
      composerInput.value = "";
      fresh = added;
      $("vocabulary-search").value = "";
      toast(t("vocabulary.toast.added", { term: added }));
      await reload();
      composerInput.focus();
    } catch (error) {
      setComposerProblem(describeError(error));
      // 已经有了的那个词亮一下，告诉他在哪
      const existing = data.terms.find((term) => termKey(term) === termKey(composerInput.value.trim()));
      if (existing) {
        fresh = existing;
        renderTerms();
      }
    } finally {
      adding = false;
    }
  });
  composerInput.addEventListener("input", () => setComposerProblem(null));
  composerInput.addEventListener("keydown", (event) => {
    if (!composing(event) && event.key === "Escape") closeComposer({ focus: true });
  });
  $("vocabulary-composer-close").addEventListener("click", () => closeComposer({ focus: true }));

  // ---------- 对话框：删除、导入（要确认的事） ----------

  /**
   * @param {object} options
   * @param {string} options.title
   * @param {string} [options.text] 标题下面的一句说明
   * @param {string[]} [options.preview] 要加的词（导入）：列出前面一些，看得出是不是把表头也当成了词
   * @param {string} [options.note] 灰字的补充
   * @param {string | null} [options.problem] 一打开就要说的问题（比如导入超出上限），确认按钮随之置灰
   * @param {string} options.confirm 确认按钮上的字
   * @param {boolean} [options.disabled] 没有可确认的（导入的文件里没有新词）
   * @param {() => Promise<string>} options.run 确认时做的事，返回提示的那句话；出错时在对话框里说
   */
  function openDialog({ title, text = "", preview = [], note = "", problem = null, confirm, disabled = false, run }) {
    $("vocabulary-dialog-title").textContent = title;
    $("vocabulary-dialog-text").textContent = text;
    $("vocabulary-dialog-text").hidden = text === "";
    const shown = preview.slice(0, PREVIEW_TERMS);
    $("vocabulary-dialog-preview").hidden = shown.length === 0;
    const more = preview.length - shown.length;
    $("vocabulary-dialog-preview").replaceChildren(
      ...shown.map((term) => h("li", { class: "tag", "data-tone": "outline", text: term })),
      ...(more > 0
        ? [h("li", { class: "vocab-dialog-more", text: t("vocabulary.dialogs.import.more", { count: more }) })]
        : []),
    );
    $("vocabulary-dialog-note").textContent = note;
    $("vocabulary-dialog-note").hidden = note === "";
    setDialogProblem(problem);
    confirmButton.textContent = confirm;
    confirmButton.disabled = problem !== null || disabled;
    onConfirm = run;
    dialog.showModal();
    (confirmButton.disabled ? $("vocabulary-dialog-cancel") : confirmButton).focus();
  }

  function setDialogProblem(problem) {
    $("vocabulary-dialog-problem").textContent = problem ?? "";
    $("vocabulary-dialog-problem").hidden = problem === null;
  }

  $("vocabulary-dialog-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!onConfirm || confirmButton.disabled) return;
    confirmButton.disabled = true;
    confirmButton.setAttribute("aria-busy", "true");
    try {
      const said = await onConfirm();
      dialog.close();
      toast(said);
      await reload();
    } catch (error) {
      // 等回话时他已经按 Esc 关了对话框：在对话框里说就看不见了
      if (dialog.open) setDialogProblem(describeError(error));
      else toast(describeError(error));
    } finally {
      confirmButton.disabled = false;
      confirmButton.removeAttribute("aria-busy");
    }
  });
  $("vocabulary-dialog-cancel").addEventListener("click", () => dialog.close());
  // 关掉以后焦点回到打开它的按钮；那个词已经删掉了的话，放到搜索框
  dialog.addEventListener("close", () => queueMicrotask(focusFallback));

  function openRemove(terms) {
    const one = terms.length === 1;
    openDialog({
      title: one
        ? t("vocabulary.dialogs.remove.title")
        : t("vocabulary.dialogs.removeMany.title", { count: terms.length }),
      text: one
        ? t("vocabulary.dialogs.remove.description", { term: terms[0] })
        : t("vocabulary.dialogs.removeMany.description"),
      confirm: t(one ? "vocabulary.dialogs.remove.confirm" : "vocabulary.dialogs.removeMany.confirm"),
      run: async () => {
        const count = await window.speakmore.removeTerms(terms);
        for (const term of terms) selected.delete(term);
        return one ? t("vocabulary.toast.removed", { term: terms[0] }) : t("vocabulary.toast.removedMany", { count });
      },
    });
  }

  /** 导入分两步，同原版：先选文件看一眼能加几个，确认了再加 */
  async function openImport() {
    let preview;
    try {
      preview = await window.speakmore.previewImport();
    } catch (error) {
      toast(describeError(error));
      return;
    }
    if (preview === null) return;
    const count = preview.terms.length;
    openDialog({
      title: t("vocabulary.dialogs.import.title"),
      text:
        count > 0
          ? t("vocabulary.dialogs.import.found", { file: preview.fileName, count })
          : t("vocabulary.dialogs.import.none", { file: preview.fileName }),
      preview: preview.terms,
      note: ["existing", "duplicates", "invalid"]
        .filter((part) => preview[part] > 0)
        .map((part) => t(`vocabulary.dialogs.import.skipped.${part}`, { count: preview[part] }))
        .join(" · "),
      problem: count > preview.room ? t("vocabulary.tooMany", { max: MAX_TERMS, room: preview.room, count }) : null,
      confirm: t("vocabulary.dialogs.import.confirm", { count }),
      disabled: count === 0,
      run: async () => t("vocabulary.toast.imported", { count: await window.speakmore.importTerms(preview.terms) }),
    });
  }

  for (const id of ["vocabulary-add", "vocabulary-empty-add"]) $(id).addEventListener("click", openComposer);
  $("vocabulary-import").addEventListener("click", openImport);
  $("vocabulary-search").addEventListener("input", () => data && renderTerms());
  $("vocabulary-select-clear").addEventListener("click", () => {
    selected.clear();
    renderTerms();
    focusFallback();
  });
  $("vocabulary-select-delete").addEventListener("click", () => openRemove([...selected]));
  $("vocabulary-support").addEventListener("toggle", (event) => {
    $("vocabulary-support-trigger").setAttribute("aria-expanded", String(event.newState === "open"));
  });

  return {
    /** 切到这一页时重读：命令行、手改文件、换了识别方式都可能让它变了 */
    shown: reload,
  };
}
