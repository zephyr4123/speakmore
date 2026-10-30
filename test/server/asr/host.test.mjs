import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { MODELS } from "../../../src/models/catalog.mjs";
import { spawnTranscriber } from "../../../src/server/asr/host.mjs";

const FAKE_WORKER = fileURLToPath(new URL("../../fixtures/asr/fake-worker.mjs", import.meta.url));
const MODEL = { id: "fake-model" };

function recordingLog() {
  const events = [];
  const record = (level) => (event, fields) => events.push({ level, event, ...fields });
  return { events, info: record("info"), warn: record("warn"), error: record("error") };
}

const spawn = (extra = {}) =>
  spawnTranscriber({ model: MODEL, dir: "/models/fake", log: recordingLog(), workerPath: FAKE_WORKER, ...extra });

test("在子进程里装上模型，样本原样（Float32Array）交过去，回的是文字；关掉以后不能再用", async () => {
  const log = recordingLog();
  const transcriber = await spawn({ log });
  assert.equal(transcriber.backend, "fake");
  assert.deepEqual(await transcriber.transcribe(new Float32Array(16_000)), { text: "fake-model:16000" });
  assert.deepEqual(await transcriber.transcribe(new Float32Array(8)), { text: "fake-model:8" });
  assert.ok(log.events.some((e) => e.event === "transcriber_loaded" && e.backend === "fake"));
  transcriber.dispose();
  await assert.rejects(transcriber.transcribe(new Float32Array(8)), /已经关了/);
});

test("一个子进程一次只转写一段：同时来的排着队，不让同一个模型同时跑两份推理（预览、整理、历史里重跑都走这里）", async (t) => {
  const transcriber = await spawn();
  t.after(() => transcriber.dispose());
  const results = await Promise.all([1, 2, 3].map(() => transcriber.transcribe(new Float32Array(10))));
  assert.deepEqual(results.at(-1), { text: "most:1" });
});

test("用户词典随这一次转写交给子进程", async () => {
  const transcriber = await spawn();
  assert.deepEqual(await transcriber.transcribe(new Float32Array(8), { vocabulary: ["Runzo", "埋点"] }), {
    text: "fake-model:8:Runzo|埋点",
  });
  assert.deepEqual(await transcriber.transcribe(new Float32Array(8), {}), { text: "fake-model:8" });
  transcriber.dispose();
});

test("配置表里的模型整项交给子进程装：带着词典的收法也复制得过去（2026-10-19 App 端到端里装不上过）", async () => {
  const model = MODELS.find((each) => each.vocabulary);
  const transcriber = await spawn({ model });
  assert.deepEqual(await transcriber.transcribe(new Float32Array(8), { vocabulary: ["Runzo"] }), {
    text: `${model.id}:8:Runzo`,
  });
  transcriber.dispose();
});

test("日志：带词典时记这一跳按模型的上限送了几个词；运行库说位置不够（会截掉录音）单独记一条警告", async () => {
  const log = recordingLog();
  const model = MODELS.find((each) => each.vocabulary);
  const transcriber = await spawn({ model, log });
  await transcriber.transcribe(new Float32Array(4), { vocabulary: ["Runzo", "埋点"] });
  // stderr 和回话走两条路，回话先到也不奇怪：等 stderr 跟上
  for (let i = 0; i < 50 && !log.events.some((e) => e.event === "transcriber_overflow"); i += 1) {
    await new Promise((done) => setTimeout(done, 20));
  }
  transcriber.dispose();
  assert.ok(
    log.events.some((e) => e.event === "vocabulary_fitted" && e.sent === 2 && e.of === 2 && e.model === model.id),
  );
  const overflow = log.events.find((e) => e.event === "transcriber_overflow");
  assert.equal(overflow?.level, "warn");
  assert.match(overflow.said, /Reduce hotwords/);
});

test("装不上模型：直接报错，说是哪个模型", async () => {
  await assert.rejects(spawn({ options: { failLoad: true } }), /装不上模型 fake-model：.*模型文件坏了/s);
});

test("运行库报错只丢这一次，进程还在，下一次照常", async () => {
  const transcriber = await spawn();
  await assert.rejects(transcriber.transcribe(new Float32Array(3)), /本地转写出错：.*运行库报错/s);
  assert.deepEqual(await transcriber.transcribe(new Float32Array(5)), { text: "fake-model:5" });
  transcriber.dispose();
});

test("子进程崩了：这一次报错并记日志，下一次自动重开、重新装模型", async () => {
  const log = recordingLog();
  const transcriber = await spawn({ log });
  await assert.rejects(transcriber.transcribe(new Float32Array(1)), /转写进程退出了（code 3/);
  assert.ok(log.events.some((e) => e.event === "transcriber_exited" && e.code === 3));
  assert.deepEqual(await transcriber.transcribe(new Float32Array(6)), { text: "fake-model:6" });
  assert.equal(log.events.filter((e) => e.event === "transcriber_loaded").length, 2);
  transcriber.dispose();
});

test("卡死不回话：到时候报错、结束子进程，下一次重开", async () => {
  const log = recordingLog();
  const transcriber = await spawn({ log, timeoutFor: () => 200 });
  await assert.rejects(transcriber.transcribe(new Float32Array(2)), /没有回话/);
  assert.ok(log.events.some((e) => e.event === "transcriber_timeout"));
  assert.deepEqual(await transcriber.transcribe(new Float32Array(7)), { text: "fake-model:7" });
  transcriber.dispose();
});

test("关掉时不记成崩溃", async () => {
  const log = recordingLog();
  const transcriber = await spawn({ log });
  transcriber.dispose();
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(log.events.filter((e) => e.event === "transcriber_exited").length, 0);
});
