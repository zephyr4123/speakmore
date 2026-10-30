import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, test } from "node:test";
import { createTranslator } from "../../src/i18n/index.mjs";
import { openHistory } from "../../src/storage/history.mjs";

const zh = createTranslator("zh-CN");
/** 报错里给人看的那句，按中文翻出来对得上 */
const said = (pattern) => (error) => pattern.test(zh.text(error.problem ?? error.message));

let dir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "speakmore-history-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const entry = (overrides = {}) => ({
  id: "a1",
  kind: "dictate",
  status: "completed",
  sourceText: null,
  outputLanguage: null,
  refinedText: "我们后天开会。",
  error: null,
  duration: 4.2,
  audioFile: "a1.webm",
  rerunOf: null,
  createdAt: "2026-10-13T08:00:00.000Z",
  ...overrides,
});

test("存进去的记录能原样读出来，新的在前；目录不存在会自己建", () => {
  const history = openHistory(join(dir, "nested", "history.db"));
  history.add(entry());
  history.add(
    entry({
      id: "a2",
      status: "failed",
      refinedText: "",
      error: "服务端没有回应",
      createdAt: "2026-10-13T09:00:00.000Z",
    }),
  );
  // 没记过账的（还没调到模型就失败了，或者是记账之前的版本存的）用量是 null
  assert.deepEqual(history.list(), [
    {
      ...entry({
        id: "a2",
        status: "failed",
        refinedText: "",
        error: "服务端没有回应",
        createdAt: "2026-10-13T09:00:00.000Z",
      }),
      usage: null,
    },
    { ...entry(), usage: null },
  ]);
  assert.equal(history.list({ limit: 1 }).length, 1);
  history.close();
});

test("搜索：按成品、原文、失败原因找，不分大小写和位置；% 和 _ 按字面找；可以和功能筛一起用", () => {
  const history = openHistory(join(dir, "history.db"));
  history.add(entry({ id: "a1", refinedText: "把 GitHub 的 issue 看完", createdAt: "2026-10-13T08:00:00.000Z" }));
  history.add(
    entry({
      id: "a2",
      kind: "translate",
      refinedText: "Let's ship it.",
      sourceText: "我们发布吧",
      outputLanguage: "en",
      createdAt: "2026-10-13T09:00:00.000Z",
    }),
  );
  history.add(
    entry({
      id: "a3",
      status: "failed",
      refinedText: "",
      error: "服务端 100% 没有回应",
      createdAt: "2026-10-13T10:00:00.000Z",
    }),
  );
  history.add(entry({ id: "a4", refinedText: "100_分_的进度", createdAt: "2026-10-13T11:00:00.000Z" }));
  history.add(entry({ id: "a5", refinedText: "100 分进度", createdAt: "2026-10-13T12:00:00.000Z" }));
  history.add(entry({ id: "a6", refinedText: "C:\\Users\\me 的目录", createdAt: "2026-10-13T13:00:00.000Z" }));

  const ids = (options) => history.list(options).map((row) => row.id);
  assert.deepEqual(ids({ query: "github" }), ["a1"]);
  assert.deepEqual(ids({ query: "发布" }), ["a2"]);
  assert.deepEqual(ids({ query: "服务端" }), ["a3"]);
  // LIKE 的通配符要按字面找
  assert.deepEqual(ids({ query: "100%" }), ["a3"]);
  assert.deepEqual(ids({ query: "100_" }), ["a4"]);
  assert.deepEqual(ids({ query: "C:\\Users" }), ["a6"]);
  // 先搜再取最近几条：列表只显示最近的那些，更老的也搜得到
  assert.deepEqual(ids({ limit: 1, query: "github" }), ["a1"]);
  // 空搜索不过滤；条数不限时全拿
  assert.deepEqual(ids({ query: "  " }), ["a6", "a5", "a4", "a3", "a2", "a1"]);
  assert.equal(history.list({ limit: null }).length, 6);
  assert.deepEqual(ids({ query: "找不到的字" }), []);
  // 功能筛：和搜索一起用
  assert.deepEqual(ids({ kinds: ["translate"] }), ["a2"]);
  assert.deepEqual(ids({ query: "发布", kinds: ["dictate"] }), []);
  assert.deepEqual(ids({ query: "发布", kinds: ["translate"] }), ["a2"]);
  assert.deepEqual(ids({ kinds: "translate" }).length, 6);
  history.close();
});

test("按 id 取一条：和列表里的那一项一样，带上用量和用到的型号；没有的是 null", () => {
  const history = openHistory(join(dir, "history.db"));
  history.add(entry());
  history.addCall({
    purpose: "dictation",
    audioId: "a1",
    provider: "local",
    model: "qwen3-asr-0.6b-q8",
    inputTokens: 0,
    audioTokens: 0,
    cachedTokens: 0,
    outputTokens: 0,
    thinkingTokens: 0,
    costUsd: 0,
    latencyMs: 120,
    createdAt: "2026-10-13T08:00:01.000Z",
  });
  assert.deepEqual(history.get("a1"), {
    ...entry(),
    usage: { calls: 1, inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: 120, models: ["qwen3-asr-0.6b-q8"] },
  });
  assert.equal(history.get("nope"), null);
  history.close();
});

test("录音只记文件名：家目录搬了家也对得上；老版本记的完整路径（macOS、Windows 两种写法）读出来也只取文件名", () => {
  const path = join(dir, "history.db");
  const history = openHistory(path);
  history.add(entry({ id: "new" }));
  history.add(entry({ id: "none", audioFile: null, createdAt: "2026-10-13T07:00:00.000Z" }));
  history.close();
  const db = new DatabaseSync(path);
  const old = db.prepare(
    "INSERT INTO history (id, status, refined_text, duration, audio_local_path, created_at) VALUES (?, 'completed', '', 1, ?, ?)",
  );
  old.run("mac", "/Users/someone/.speakmore/data/Recordings/mac.webm", "2026-10-12T00:00:00.000Z");
  old.run("win", "C:\\Users\\someone\\.speakmore\\data\\Recordings\\win.webm", "2026-10-11T00:00:00.000Z");
  db.close();
  const reopened = openHistory(path, { readOnly: true });
  assert.deepEqual(
    reopened.list().map(({ id, audioFile }) => [id, audioFile]),
    [
      ["new", "a1.webm"],
      ["none", null],
      ["mac", "mac.webm"],
      ["win", "win.webm"],
    ],
  );
  reopened.close();
});

test("关掉再打开，记录还在，不会重复建表", () => {
  const path = join(dir, "history.db");
  const first = openHistory(path);
  first.add(entry());
  first.close();
  const second = openHistory(path);
  assert.equal(second.list().length, 1);
  second.close();
});

test("同一个录音不能存两次；状态只能是完成或失败", () => {
  const history = openHistory(join(dir, "history.db"));
  history.add(entry());
  assert.throws(() => history.add(entry()), /UNIQUE|constraint/i);
  assert.throws(() => history.add(entry({ id: "a3", status: "pending" })), /CHECK|constraint/i);
  history.close();
});

test("库的版本比程序新时拒绝打开，不去动它", () => {
  const path = join(dir, "history.db");
  const db = new DatabaseSync(path);
  db.exec("PRAGMA user_version = 99");
  db.close();
  assert.throws(() => openHistory(path), said(/版本是 99/));
});

test("统计：只数完成的听写，可以只看某个时刻之后的", () => {
  const history = openHistory(join(dir, "history.db"));
  history.add(entry({ id: "a", createdAt: "2026-10-12T08:00:00.000Z", refinedText: "昨天说的话", duration: 6 }));
  history.add(entry({ id: "b", createdAt: "2026-10-13T08:00:00.000Z", refinedText: "今天第一句", duration: 4 }));
  history.add(entry({ id: "c", createdAt: "2026-10-13T09:00:00.000Z", refinedText: "今天第二句话", duration: 5.5 }));
  history.add(
    entry({
      id: "d",
      createdAt: "2026-10-13T10:00:00.000Z",
      status: "failed",
      refinedText: "",
      error: "连不上",
      duration: 9,
    }),
  );

  assert.deepEqual(history.stats(), {
    entries: 4,
    dictations: 3,
    characters: 16,
    seconds: 15.5,
    failed: 1,
    costUsd: 0,
    unpricedCalls: 0,
  });
  assert.deepEqual(history.stats({ since: "2026-10-13T00:00:00.000Z" }), {
    entries: 3,
    dictations: 2,
    characters: 11,
    seconds: 9.5,
    failed: 1,
    costUsd: 0,
    unpricedCalls: 0,
  });
  history.close();
});

test('统计可以只数某几个功能的（命令行的"今天几次听写"只数说话的）；entries 总是所有记录的条数', () => {
  const history = openHistory(join(dir, "history.db"));
  history.add(entry({ id: "a", refinedText: "说的话", duration: 3 }));
  history.add(
    entry({
      id: "l",
      kind: "lookup",
      refinedText: "译文",
      sourceText: "text",
      outputLanguage: "zh-CN",
      duration: 0,
      audioFile: null,
    }),
  );
  const { entries, dictations, characters, seconds } = history.stats({ kinds: ["dictate", "translate"] });
  assert.deepEqual(
    { entries, dictations, characters, seconds },
    { entries: 2, dictations: 1, characters: 3, seconds: 3 },
  );
  assert.equal(history.stats().dictations, 2);
  history.close();
});

test("统计的字数按他说的那段数：翻译的是原文，和首页的口径一样", () => {
  const history = openHistory(join(dir, "history.db"));
  history.add(entry({ id: "d", refinedText: "老的听写", duration: 3 }));
  history.add(
    entry({ id: "t", kind: "translate", refinedText: "Hello", sourceText: "你好", outputLanguage: "en", duration: 2 }),
  );
  assert.equal(history.stats({ kinds: ["dictate", "translate"] }).characters, 6);
  history.close();
});

test("首页统计要的：所有完成了的听写，只带时间、文字、时长，老的在前；失败的、没听到声音的不算", () => {
  const history = openHistory(join(dir, "history.db"));
  history.add(entry({ id: "b", createdAt: "2026-10-13T09:00:00.000Z", refinedText: "第二句", duration: 2 }));
  history.add(entry({ id: "a", createdAt: "2026-10-12T09:00:00.000Z", refinedText: "第一句", duration: 1 }));
  history.add(entry({ id: "c", status: "failed", refinedText: "", error: "超时" }));
  // 误按了一下、没说话：模型回了空文字，也记成完成了，但不算说过话
  history.add(entry({ id: "d", createdAt: "2026-10-14T09:00:00.000Z", refinedText: "", duration: 3 }));
  assert.deepEqual(history.dictations(), [
    { createdAt: "2026-10-12T09:00:00.000Z", kind: "dictate", text: "第一句", duration: 1 },
    { createdAt: "2026-10-13T09:00:00.000Z", kind: "dictate", text: "第二句", duration: 2 },
  ]);
  history.close();
});

test("语音翻译也进历史：正文是译文，另存原文和目标语言；不写功能的是语音输入", () => {
  const history = openHistory(join(dir, "history.db"));
  history.add({
    id: "t1",
    kind: "translate",
    status: "completed",
    refinedText: "Let's meet the day after tomorrow.",
    sourceText: "我们后天开会。",
    outputLanguage: "en",
    error: null,
    duration: 3,
    audioFile: "t1.webm",
    createdAt: "2026-10-14T09:00:00.000Z",
  });
  // 0.15 以前的写法（不带这三项）照样能存，存成语音输入
  const { kind, sourceText, outputLanguage, ...old } = entry();
  history.add(old);
  const [translated, dictated] = history.list();
  assert.deepEqual(
    [translated.kind, translated.refinedText, translated.sourceText, translated.outputLanguage],
    ["translate", "Let's meet the day after tomorrow.", "我们后天开会。", "en"],
  );
  assert.deepEqual([dictated.kind, dictated.sourceText, dictated.outputLanguage], ["dictate", null, null]);
  // 首页数的是他说的那段话：翻译的是原文；可以只要某几个功能的
  assert.deepEqual(
    history.dictations().map(({ kind, text }) => [kind, text]),
    [
      ["dictate", "我们后天开会。"],
      ["translate", "我们后天开会。"],
    ],
  );
  assert.deepEqual(
    history.dictations({ kinds: ["translate"] }).map(({ kind }) => kind),
    ["translate"],
  );
  history.close();
});

test("划词翻译也进历史：正文是译文，原文、目标语言另存；没有录音，时长是 0；首页只数说话的功能时不算它", () => {
  const history = openHistory(join(dir, "history.db"));
  history.add(
    entry({
      id: "l1",
      kind: "lookup",
      refinedText: "模型把音频留在你的设备上。",
      sourceText: "The model keeps the audio on your device.",
      outputLanguage: "zh-CN",
      duration: 0,
      audioFile: null,
    }),
  );
  const [row] = history.list();
  assert.deepEqual(
    [row.kind, row.refinedText, row.sourceText, row.outputLanguage, row.duration, row.audioFile],
    ["lookup", "模型把音频留在你的设备上。", "The model keeps the audio on your device.", "zh-CN", 0, null],
  );
  assert.deepEqual(history.dictations({ kinds: ["dictate", "translate"] }), []);
  history.close();
});

test("0.15 的库（版本 2）打开时升上来，老记录都是语音输入；照文件头写的退回办法降回去，库照样能读", () => {
  const path = join(dir, "history.db");
  const v2 = openHistory(path);
  v2.close();
  // 造一个版本 2 的库：先降回去（文件头写的那条命令），再存一条老版本的记录
  const db = new DatabaseSync(path);
  db.exec("ALTER TABLE history DROP COLUMN rerun_of;");
  db.exec(
    "ALTER TABLE history DROP COLUMN kind; ALTER TABLE history DROP COLUMN source_text; ALTER TABLE history DROP COLUMN output_language; PRAGMA user_version = 2;",
  );
  db.prepare(
    "INSERT INTO history VALUES ('a1', 'completed', '我们后天开会。', NULL, 4.2, 'a1.webm', '2026-10-13T08:00:00.000Z')",
  ).run();
  assert.deepEqual(
    db
      .prepare("PRAGMA table_info(history)")
      .all()
      .map(({ name }) => name),
    ["id", "status", "refined_text", "error", "duration", "audio_local_path", "created_at"],
  );
  db.close();

  const history = openHistory(path);
  assert.deepEqual(history.list(), [{ ...entry(), usage: null }]);
  history.close();
  const upgraded = new DatabaseSync(path);
  assert.equal(upgraded.prepare("PRAGMA user_version").get().user_version, 5);
  upgraded.close();
});

test("版本 3 的库打开时一路升上来：账原样搬过来，用途多认划词；照文件头写的退回办法降回 3，库照样能读", () => {
  const path = join(dir, "history.db");
  openHistory(path).close();
  // 造一个版本 3 的库：账表照版本 3 的样子重建（用途只认三种），存一笔账
  const db = new DatabaseSync(path);
  db.exec(`ALTER TABLE history DROP COLUMN rerun_of;
    DROP TABLE model_calls;
    CREATE TABLE model_calls (
      id INTEGER PRIMARY KEY, audio_id TEXT,
      purpose TEXT NOT NULL CHECK (purpose IN ('dictation', 'check', 'cache')),
      provider TEXT NOT NULL, model TEXT NOT NULL, input_tokens INTEGER NOT NULL, audio_tokens INTEGER NOT NULL,
      cached_tokens INTEGER NOT NULL, output_tokens INTEGER NOT NULL, thinking_tokens INTEGER NOT NULL,
      cost_usd REAL, latency_ms INTEGER NOT NULL, created_at TEXT NOT NULL);
    INSERT INTO model_calls VALUES (7, 'a1', 'dictation', 'gemini', 'gemini-3.6-flash', 1390, 25, 0, 4, 0, 0.001, 1700,
      '2026-10-13T08:00:00.000Z');
    PRAGMA user_version = 3;`);
  db.close();

  const history = openHistory(path);
  history.add(entry());
  history.addCall(call({ purpose: "lookup", audioId: "l1", provider: "deepseek", model: "deepseek-flash" }));
  assert.equal(history.list()[0].usage.calls, 1);
  assert.equal(history.usage().calls, 2);
  history.close();
  const upgraded = new DatabaseSync(path);
  assert.equal(upgraded.prepare("PRAGMA user_version").get().user_version, 5);
  // 索引跟着重建了
  assert.deepEqual(
    upgraded
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'model_calls' ORDER BY name")
      .all()
      .map(({ name }) => name),
    ["model_calls_audio_id", "model_calls_created_at"],
  );
  // 文件头写的退回办法（先从 5 退回 4）
  upgraded.exec("ALTER TABLE history DROP COLUMN rerun_of; PRAGMA user_version = 4;");
  upgraded.exec("DELETE FROM model_calls WHERE purpose = 'lookup'; PRAGMA user_version = 3;");
  assert.equal(upgraded.prepare("SELECT count(*) AS n FROM model_calls").get().n, 1);
  upgraded.close();
});

test("空的历史库统计出来全是 0", () => {
  const history = openHistory(join(dir, "history.db"));
  assert.deepEqual(history.stats(), {
    entries: 0,
    dictations: 0,
    characters: 0,
    seconds: 0,
    failed: 0,
    costUsd: 0,
    unpricedCalls: 0,
  });
  history.close();
});

test("只读打开：能看不能写，库不存在时不会凭空建一个", () => {
  const dbPath = join(dir, "history.db");
  assert.equal(openHistory(dbPath, { readOnly: true }), null);
  assert.equal(existsSync(dbPath), false);

  const writable = openHistory(dbPath);
  writable.add(entry());
  writable.close();

  const readOnly = openHistory(dbPath, { readOnly: true });
  assert.equal(readOnly.list().length, 1);
  assert.throws(() => readOnly.add(entry({ id: "b" })), /readonly/);
  readOnly.close();
});

test("只读打开时发现库的版本和程序对不上，就不读", () => {
  const dbPath = join(dir, "history.db");
  openHistory(dbPath).close();
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA user_version = 99");
  db.close();
  assert.throws(() => openHistory(dbPath, { readOnly: true }), said(/版本/));
});

// ---------- 记账：每次调模型一笔（src/server/refine/refiner.mjs 的 onCall 给的那个样子） ----------

const call = (overrides = {}) => ({
  purpose: "dictation",
  audioId: "a1",
  provider: "gemini",
  model: "gemini-3.6-flash",
  inputTokens: 1390,
  audioTokens: 25,
  cachedTokens: 0,
  outputTokens: 4,
  thinkingTokens: 0,
  costUsd: 0.001,
  latencyMs: 1700,
  createdAt: "2026-10-13T08:00:00.000Z",
  ...overrides,
});

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} ≠ ${expected}`);

test("历史里每一条带上它的用量：重来过的几次调用加在一起", () => {
  const history = openHistory(join(dir, "history.db"));
  // 账先到：模型回了话就记，成品贴出去之后才存历史
  history.addCall(call({ latencyMs: 1500, costUsd: 0.001 }));
  history.addCall(call({ latencyMs: 1200, costUsd: 0.002, outputTokens: 6 }));
  history.add(entry());
  const [row] = history.list();
  assert.deepEqual(
    { ...row.usage, costUsd: 0 },
    {
      calls: 2,
      inputTokens: 2780,
      outputTokens: 10,
      costUsd: 0,
      latencyMs: 2700,
      models: ["gemini-3.6-flash"],
    },
  );
  close(row.usage.costUsd, 0.003);
  history.close();
});

test("一条里有一笔不知道价，这一条的钱就说不知道，不拿一半当全部", () => {
  const history = openHistory(join(dir, "history.db"));
  history.addCall(call({ costUsd: 0.001 }));
  history.addCall(call({ model: "gemini-9-ultra", costUsd: null }));
  history.add(entry());
  assert.equal(history.list()[0].usage.costUsd, null);
  history.close();
});

test("用量汇总：几次听写、几次验证 key、token 分项、多少钱，可以只看某个时刻之后的", () => {
  const history = openHistory(join(dir, "history.db"));
  history.addCall(call({ audioId: "old", createdAt: "2026-10-12T08:00:00.000Z", costUsd: 0.5 }));
  history.addCall(call({ audioId: "a", latencyMs: 1000 }));
  history.addCall(call({ audioId: "a", latencyMs: 900, cachedTokens: 1024, thinkingTokens: 3, outputTokens: 7 }));
  history.addCall(call({ audioId: "b", latencyMs: 3000, provider: "openai", model: "gpt-audio-mini-2025-12-15" }));
  history.addCall(
    call({ purpose: "check", audioId: null, inputTokens: 2, audioTokens: 0, outputTokens: 0, latencyMs: 600 }),
  );
  history.addCall(call({ audioId: "c", model: "gemini-9-ultra", costUsd: null, latencyMs: 2000 }));

  const today = history.usage({ since: "2026-10-13T00:00:00.000Z" });
  const { models, costUsd, ...totals } = today;
  assert.deepEqual(totals, {
    calls: 5,
    checks: 1,
    dictations: 3,
    lookups: 0,
    inputTokens: 1390 * 4 + 2,
    audioTokens: 25 * 4,
    cachedTokens: 1024,
    outputTokens: 4 * 3 + 7,
    thinkingTokens: 3,
    cacheCostUsd: 0,
    unpricedCalls: 1,
    // 每次听写等模型的时间（重来的几次加在一起），从快到慢
    latenciesMs: [1900, 2000, 3000],
  });
  close(costUsd, 0.004);

  // 按型号分开，花得多的在前；每个型号自己的等待时间
  assert.deepEqual(
    models.map(({ provider, model, calls, checks, dictations, unpricedCalls, latenciesMs }) => ({
      provider,
      model,
      calls,
      checks,
      dictations,
      unpricedCalls,
      latenciesMs,
    })),
    [
      {
        provider: "gemini",
        model: "gemini-3.6-flash",
        calls: 3,
        checks: 1,
        dictations: 1,
        unpricedCalls: 0,
        latenciesMs: [1900],
      },
      {
        provider: "openai",
        model: "gpt-audio-mini-2025-12-15",
        calls: 1,
        checks: 0,
        dictations: 1,
        unpricedCalls: 0,
        latenciesMs: [3000],
      },
      {
        provider: "gemini",
        model: "gemini-9-ultra",
        calls: 1,
        checks: 0,
        dictations: 1,
        unpricedCalls: 1,
        latenciesMs: [2000],
      },
    ],
  );

  assert.equal(history.usage().calls, 6);
  close(history.usage().costUsd, 0.504);
  history.close();
});

test("划词的账单独一类：用量里另报几次划词，听写次数和等待时间不算它；钱、token 照样加进去", () => {
  const history = openHistory(join(dir, "history.db"));
  history.addCall(call({ audioId: "a", latencyMs: 1500 }));
  history.addCall(
    call({ purpose: "lookup", audioId: "l1", provider: "deepseek", model: "deepseek-flash", latencyMs: 800 }),
  );
  history.addCall(
    call({ purpose: "lookup", audioId: "l2", provider: "deepseek", model: "deepseek-flash", latencyMs: 900 }),
  );
  const { dictations, lookups, calls, latenciesMs, costUsd, models } = history.usage();
  assert.deepEqual(
    { dictations, lookups, calls, latenciesMs },
    { dictations: 1, lookups: 2, calls: 3, latenciesMs: [1500] },
  );
  close(costUsd, 0.003);
  const deepseek = models.find(({ provider }) => provider === "deepseek");
  assert.deepEqual([deepseek.dictations, deepseek.lookups, deepseek.latenciesMs], [0, 2, []]);
  history.close();
});

test("重跑出来的记录不算又说了一次：首页统计、用量里的听写次数和等待时间都不数它，钱照算；退回 4 时只丢掉这个标记", () => {
  const path = join(dir, "history.db");
  const history = openHistory(path);
  history.add(entry());
  history.addCall(call({ latencyMs: 1500 }));
  history.add(entry({ id: "r1", refinedText: "我们后天开会", rerunOf: "a1", createdAt: "2026-10-14T08:00:00.000Z" }));
  history.addCall(call({ audioId: "r1", model: "gemini-3.6-pro", latencyMs: 9000, costUsd: 0.004 }));

  assert.deepEqual(
    history.list().map(({ id, rerunOf, usage }) => [id, rerunOf, usage.models]),
    [
      ["r1", "a1", ["gemini-3.6-pro"]],
      ["a1", null, ["gemini-3.6-flash"]],
    ],
  );
  const { dictations, characters, seconds } = history.stats();
  assert.deepEqual({ dictations, characters, seconds }, { dictations: 1, characters: 7, seconds: 4.2 });
  assert.equal(history.dictations().length, 1);
  const usage = history.usage();
  assert.deepEqual([usage.calls, usage.dictations, usage.latenciesMs], [2, 1, [1500]]);
  close(usage.costUsd, 0.005);
  history.close();

  // 文件头写的退回办法
  const db = new DatabaseSync(path);
  db.exec("ALTER TABLE history DROP COLUMN rerun_of; PRAGMA user_version = 4;");
  assert.equal(db.prepare("SELECT count(*) AS n FROM history").get().n, 2);
  db.close();
});

test("本机转写那一跳也记账：一次听写不数两次；整次等了多久是两跳加起来，按型号分开时各算各的", () => {
  const history = openHistory(join(dir, "history.db"));
  const local = { provider: "local", model: "qwen3-asr-0.6b-q8", inputTokens: 0, audioTokens: 0, outputTokens: 0 };
  history.addCall(call({ audioId: "l1", ...local, costUsd: 0, latencyMs: 300 }));
  history.addCall(
    call({ audioId: "l1", provider: "deepseek", model: "deepseek-flash", costUsd: 0.0001, latencyMs: 1200 }),
  );
  history.addCall(call({ audioId: "l2", ...local, costUsd: 0, latencyMs: 250 }));
  history.addCall(
    call({ audioId: "l2", provider: "deepseek", model: "deepseek-flash", costUsd: 0.0001, latencyMs: 900 }),
  );
  const usage = history.usage();
  assert.equal(usage.dictations, 2);
  assert.equal(usage.unpricedCalls, 0);
  assert.deepEqual(usage.latenciesMs, [1150, 1500]);
  assert.deepEqual(
    usage.models.map(({ provider, dictations, latenciesMs }) => ({ provider, dictations, latenciesMs })),
    [
      { provider: "deepseek", dictations: 2, latenciesMs: [900, 1200] },
      { provider: "local", dictations: 2, latenciesMs: [250, 300] },
    ],
  );
  history.close();
});

test("今天花了多少钱也在统计里，验证 key 的那几次也算", () => {
  const history = openHistory(join(dir, "history.db"));
  history.add(entry({ id: "a", createdAt: "2026-10-13T08:00:00.000Z" }));
  history.addCall(call({ audioId: "a", costUsd: 0.002 }));
  history.addCall(call({ purpose: "check", audioId: null, costUsd: 0.0001 }));
  history.addCall(call({ audioId: "x", createdAt: "2026-10-12T08:00:00.000Z", costUsd: 1 }));
  const today = history.stats({ since: "2026-10-13T00:00:00.000Z" });
  close(today.costUsd, 0.0021);
  assert.equal(today.unpricedCalls, 0);
  // 有一笔不知道价：钱只加得上知道价的，另报几笔不知道
  history.addCall(call({ audioId: "a", model: "gemini-9-ultra", costUsd: null }));
  assert.equal(history.stats({ since: "2026-10-13T00:00:00.000Z" }).unpricedCalls, 1);
  history.close();
});

test("花费随时间怎么走：按本机日历的哪一天、或者哪个钟头，每个型号各加各的；不知道价的那几笔算 0", () => {
  const history = openHistory(join(dir, "history.db"));
  // 按本机时间写：跨过本机的午夜就是另一天，不管 UTC 那边是几号
  const at = (...parts) => new Date(...parts).toISOString();
  history.addCall(call({ audioId: "a", createdAt: at(2026, 9, 13, 23, 50), costUsd: 0.001 }));
  history.addCall(call({ audioId: "b", createdAt: at(2026, 9, 14, 0, 10), costUsd: 0.002 }));
  history.addCall(call({ audioId: "c", createdAt: at(2026, 9, 14, 0, 40), costUsd: 0.004 }));
  const deepseek = { provider: "deepseek", model: "deepseek-flash" };
  history.addCall(call({ audioId: "d", createdAt: at(2026, 9, 14, 9, 5), ...deepseek, costUsd: null }));
  assert.deepEqual(history.usageOverTime({ unit: "day" }), [
    { slot: "2026-10-13", provider: "gemini", model: "gemini-3.6-flash", costUsd: 0.001 },
    { slot: "2026-10-14", ...deepseek, costUsd: 0 },
    { slot: "2026-10-14", provider: "gemini", model: "gemini-3.6-flash", costUsd: 0.006 },
  ]);
  assert.deepEqual(history.usageOverTime({ since: at(2026, 9, 14), unit: "hour" }), [
    { slot: "2026-10-14 00", provider: "gemini", model: "gemini-3.6-flash", costUsd: 0.006 },
    { slot: "2026-10-14 09", ...deepseek, costUsd: 0 },
  ]);
  history.close();
});

test("还没记过账时用量全是 0，等待时间是空的", () => {
  const history = openHistory(join(dir, "history.db"));
  assert.deepEqual(history.usage(), {
    calls: 0,
    checks: 0,
    dictations: 0,
    lookups: 0,
    inputTokens: 0,
    audioTokens: 0,
    cachedTokens: 0,
    outputTokens: 0,
    thinkingTokens: 0,
    costUsd: 0,
    cacheCostUsd: 0,
    unpricedCalls: 0,
    latenciesMs: [],
    models: [],
  });
  history.close();
});

test("记账只取表里有的那几项：适配器以后多带一项用量也记得进去", () => {
  const history = openHistory(join(dir, "history.db"));
  history.addCall({ ...call(), reasoningSummary: "多出来的一项" });
  assert.equal(history.usage().calls, 1);
  history.close();
});

test("提示词缓存的钱（建缓存、存着）记成单独的一类，汇总里另报；不算哪次听写", () => {
  const history = openHistory(join(dir, "history.db"));
  history.addCall(call({ audioId: "a" }));
  history.addCall(call({ purpose: "cache", audioId: null, inputTokens: 1350, outputTokens: 0, costUsd: 0.0012 }));
  history.addCall(call({ purpose: "cache", audioId: null, inputTokens: 0, outputTokens: 0, costUsd: 0.0001 }));
  const usage = history.usage();
  assert.equal(usage.calls, 3);
  assert.equal(usage.dictations, 1);
  close(usage.cacheCostUsd, 0.0013);
  close(usage.costUsd, 0.0023);
  // 等待时间只算听写的
  assert.deepEqual(usage.latenciesMs, [1700]);
  history.close();
});

test("账的用途只能是听写、划词、验证 key 或者提示词缓存", () => {
  const history = openHistory(join(dir, "history.db"));
  assert.throws(() => history.addCall(call({ purpose: "other" })), /CHECK|constraint/i);
  history.close();
});

test("记账之前的版本建的库（版本 1）打开时升上来：原来的记录都在，账从零开始", () => {
  const path = join(dir, "history.db");
  const old = new DatabaseSync(path);
  old.exec(`CREATE TABLE history (
     id TEXT PRIMARY KEY, status TEXT NOT NULL CHECK (status IN ('completed', 'failed')),
     refined_text TEXT NOT NULL, error TEXT, duration REAL NOT NULL, audio_local_path TEXT, created_at TEXT NOT NULL);
   CREATE INDEX history_created_at ON history (created_at DESC);
   PRAGMA user_version = 1;`);
  old
    .prepare(
      "INSERT INTO history VALUES ('a1', 'completed', '我们后天开会。', NULL, 4.2, '/tmp/a1.webm', '2026-10-13T08:00:00.000Z')",
    )
    .run();
  old.close();

  const history = openHistory(path);
  assert.deepEqual(history.list(), [{ ...entry(), usage: null }]);
  assert.equal(history.usage().calls, 0);
  history.addCall(call());
  assert.equal(history.list()[0].usage.calls, 1);
  history.close();
});
