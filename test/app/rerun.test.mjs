import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { createRerun } from "../../src/app/rerun.mjs";
import { createTranslator, LocalizedError } from "../../src/i18n/index.mjs";

const zh = createTranslator("zh-CN");

let dir;
let recordingsDir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "speakmore-rerun-"));
  recordingsDir = join(dir, "Recordings");
  mkdirSync(recordingsDir, { recursive: true });
  writeFileSync(join(recordingsDir, "a1.webm"), Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const row = (overrides = {}) => ({
  id: "a1",
  kind: "dictate",
  status: "completed",
  refinedText: "旧的成品",
  sourceText: null,
  outputLanguage: null,
  error: null,
  duration: 7.2,
  audioFile: "a1.webm",
  rerunOf: null,
  createdAt: "2026-10-29T10:00:00.000Z",
  usage: null,
  ...overrides,
});

/** 设置里写明各种方式现在用的（不靠出厂默认：默认常换） */
const SETTINGS = {
  mode: "native",
  model: "gemini/gemini-3.6-flash",
  transcriber: "qwen3-asr-0.6b-q8",
  polish: "deepseek/deepseek-flash",
  privateTranscriber: "sensevoice-small-q8",
  outputScript: "traditional-hk",
};

/**
 * 一套假的依赖：本机装了两个模型、填了 gemini、deepseek、bailian 的 key。
 * refineOnce 记下每一次的选项，回一句固定的成品（fail 给了就抛它）
 */
function setup({
  rows = [row()],
  installed = ["qwen3-asr-0.6b-q8", "sensevoice-small-q8"],
  keys = ["gemini", "deepseek", "bailian"],
  fail = null,
  vocabulary = () => ["Claude Code"],
} = {}) {
  const settingsFile = join(dir, "settings.json");
  writeFileSync(settingsFile, JSON.stringify(SETTINGS));
  const added = [];
  const calls = [];
  let changes = 0;
  const rerun = createRerun({
    history: {
      get: (id) => rows.find((entry) => entry.id === id) ?? null,
      add: (entry) => added.push(entry),
    },
    keys: {
      sources: () => Object.fromEntries(keys.map((id) => [id, "stored"])),
      keyOf: (id) => (keys.includes(id) ? { apiKey: `key-${id}` } : null),
    },
    service: {
      refineOnce: async (options) => {
        calls.push(options);
        if (fail) throw fail;
        return { text: "新的成品", source: "新的原文" };
      },
    },
    localModels: { status: (id) => ({ installed: installed.includes(id) }) },
    settingsFile,
    env: {},
    recordingsDir,
    vocabulary,
    describe: (problem) => zh.text(problem),
    changed: () => changes++,
    log: { info: () => {}, warn: () => {} },
    uuid: () => "new-id",
    now: () => new Date("2026-10-29T12:00:00.000Z"),
  });
  return { rerun, added, calls, changes: () => changes };
}

const choice = (options, mode, name, value) =>
  options.modes[mode].settings.find((setting) => setting.name === name).choices.find((each) => each.value === value);

test("选项：三种方式现在用的原样回来；每一项写清这一跳是谁、还差什么（混合也能选云端转写）", () => {
  const options = setup({ installed: ["qwen3-asr-0.6b-q8"], keys: ["gemini", "deepseek"] }).rerun.options("a1");
  assert.equal(options.mode, "native");
  assert.deepEqual(
    Object.entries(options.modes).map(([mode, { problem, settings }]) => [
      mode,
      problem,
      settings.map(({ name, role, current }) => [name, role, current]),
    ]),
    [
      ["native", null, [["model", "native", "gemini/gemini-3.6-flash"]]],
      [
        "local",
        null,
        [
          ["transcriber", "transcribe", "qwen3-asr-0.6b-q8"],
          ["polish", "polish", "deepseek/deepseek-flash"],
        ],
      ],
      ["private", null, [["privateTranscriber", "transcribe", "sensevoice-small-q8"]]],
    ],
  );
  assert.deepEqual(choice(options, "native", "model", "gemini/gemini-3.6-flash").needs, []);
  assert.deepEqual(choice(options, "native", "model", "openai/gpt-audio-mini").needs, [
    { kind: "key", platform: "openai" },
  ]);
  // 换转文字那一跳：润色那家缺不缺 key 不算在它头上
  const cloud = choice(options, "local", "transcriber", "bailian/qwen3-asr-flash");
  assert.deepEqual([cloud.hop.platform, cloud.needs], ["bailian", [{ kind: "key", platform: "bailian" }]]);
  const local = choice(options, "private", "privateTranscriber", "sensevoice-small-q8");
  assert.deepEqual(
    [local.hop.name, local.needs],
    ["SenseVoice Small (Q8_0)", [{ kind: "download", model: "sensevoice-small-q8" }]],
  );
});

test("选项：翻译的记录在离线方式里做不了，说清原因；记录、录音不在时直接报错", () => {
  const options = setup({ rows: [row({ kind: "translate", outputLanguage: "en" })] }).rerun.options("a1");
  assert.match(zh.text(options.modes.private.problem), /离线.*不支持语音翻译/);
  assert.equal(options.modes.native.problem, null);

  const { rerun } = setup({ rows: [row(), row({ id: "a2", audioFile: null })] });
  assert.throws(
    () => rerun.options("nope"),
    (error) => error instanceof LocalizedError && /找不到该记录/.test(zh.text(error.problem)),
  );
  assert.throws(
    () => rerun.options("a2"),
    (error) => /找不到录音/.test(zh.text(error.problem)),
  );
});

test("重跑：按选的方式和模型现拼路线，录音、任务（带现在的成品字形）、词典、key 交给它；结果另存一条，记下重跑自哪条", async () => {
  const { rerun, added, calls, changes } = setup();
  const result = await rerun.run({ id: "a1", mode: "native", settings: { model: "gemini/gemini-3.6-flash" } });
  assert.deepEqual(result, { ok: true, id: "new-id" });
  const [call] = calls;
  assert.deepEqual(call.route, {
    mode: "native",
    model: { provider: "gemini", model: "gemini-3.6-flash" },
    thinkingLevel: call.route.thinkingLevel,
  });
  assert.deepEqual(call.keys, { gemini: "key-gemini" });
  assert.deepEqual(
    [call.audio, call.audioId, call.vocabulary],
    [Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), "new-id", ["Claude Code"]],
  );
  assert.equal(call.task.native.finish("后天开会").text, "後天開會");
  assert.deepEqual(added, [
    {
      id: "new-id",
      kind: "dictate",
      status: "completed",
      refinedText: "新的成品",
      sourceText: null,
      outputLanguage: null,
      error: null,
      duration: 7.2,
      audioFile: "a1.webm",
      rerunOf: "a1",
      createdAt: "2026-10-29T12:00:00.000Z",
    },
  ]);
  assert.equal(changes(), 1);
});

test("重跑（混合，第一跳是云端转写）：两家的 key 都带上；重跑的再重跑，记的还是说出来的那一条", async () => {
  const { rerun, added, calls } = setup({ rows: [row({ id: "r1", rerunOf: "a1" })] });
  const settings = { transcriber: "bailian/qwen3-asr-flash", polish: "deepseek/deepseek-flash" };
  assert.equal((await rerun.run({ id: "r1", mode: "local", settings })).ok, true);
  assert.equal(calls[0].route.transcriber, "bailian/qwen3-asr-flash");
  assert.deepEqual(calls[0].keys, { bailian: "key-bailian", deepseek: "key-deepseek" });
  assert.equal(added[0].rerunOf, "a1");
});

test("重跑翻译：照原来的目标语言译，原文另存", async () => {
  const { rerun, added } = setup({ rows: [row({ kind: "translate", outputLanguage: "en" })] });
  await rerun.run({ id: "a1", mode: "native", settings: {} });
  assert.deepEqual([added[0].sourceText, added[0].outputLanguage], ["新的原文", "en"]);
});

test("不能重跑的几种：说清原因，不调模型、不存记录", async () => {
  const cases = [
    [{ keys: [] }, { mode: "native", settings: {} }, /Gemini 密钥未配置/],
    [{ installed: [] }, { mode: "private", settings: {} }, /SenseVoice Small \(Q8_0\) 未下载/],
    [{ rows: [row({ audioFile: null })] }, { mode: "native" }, /找不到录音/],
    [{}, { id: "nope", mode: "native" }, /找不到该记录/],
    [{ rows: [row({ kind: "translate", outputLanguage: "en" })] }, { mode: "private" }, /离线.*不支持语音翻译/],
    [{}, { mode: "native", settings: { transcriber: "qwen3-asr-0.6b-q8" } }, /native 方式换不了 transcriber/],
    [{}, { mode: "turbo" }, /native \/ local \/ private/],
    [{}, { mode: "private", settings: { privateTranscriber: "bailian/qwen3-asr-flash" } }, /./],
  ];
  for (const [deps, request, said] of cases) {
    const { rerun, added, calls } = setup(deps);
    const result = await rerun.run({ id: "a1", ...request });
    assert.equal(result.ok, false);
    assert.match(zh.text(result.problem), said);
    assert.deepEqual([calls.length, added.length], [0, 0], JSON.stringify(request));
  }
  rmSync(join(recordingsDir, "a1.webm"));
  const { rerun, calls } = setup();
  assert.match(zh.text((await rerun.run({ id: "a1", mode: "native" })).problem), /找不到录音/);
  assert.equal(calls.length, 0);
});

test("模型那边出错：照实说，存一条失败的（已经记过的账有处可查）；词典读不出来照样跑", async () => {
  const { rerun, added, calls, changes } = setup({
    fail: new LocalizedError({ key: "history.notFound" }),
    vocabulary: () => {
      throw new Error("词典坏了");
    },
  });
  const result = await rerun.run({ id: "a1", mode: "native" });
  assert.equal(result.ok, false);
  assert.deepEqual(calls[0].vocabulary, []);
  assert.deepEqual(
    [added[0].status, added[0].error, added[0].rerunOf, changes()],
    ["failed", zh.text(result.problem), "a1", 1],
  );
});
