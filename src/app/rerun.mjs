import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { LocalizedError, msg, problemOf } from "../i18n/index.mjs";
import { findModel, MODELS } from "../models/catalog.mjs";
import { CHAT_VENDORS } from "../server/chat/vendors.mjs";
import { describeRoute, keyVendorsOf, taskProblem } from "../server/modes.mjs";
import { PROVIDERS } from "../server/providers/index.mjs";
import { findTask } from "../server/tasks/index.mjs";
import { findVendor } from "../server/vendors.mjs";
import { patchSettings, resolveSettings, routeOf, SETTINGS } from "../storage/settings.mjs";
import { hopsOf, needsOf } from "./model-plaza.mjs";

// 历史里"换个模型重跑"：拿存下来的录音按另一条路线再跑一次，结果另存一条，记下重跑自哪条（统计不数它）。
// 和一次正常听写只差在音频的来处：不是悬浮条，是录音目录里的那个文件；任务、提示词、收尾、记账走同一条路。
// 路线按"设置里换掉这几项"现拼（storage/settings.mjs 的 patchSettings、routeOf），不动正在用的那条；
// 一跳是谁、还差什么用引擎页那一套（app/model-plaza.mjs 的 hopsOf、needsOf），页面照引擎页的写法画。

const listed = (registry) => registry.flatMap(({ id, models }) => models.map((model) => `${id}/${model.id}`));

/** 重跑时每种方式能换的那几项设置：是路线上的哪一跳、能选哪些（设置里现在的不在其中时补在最前面） */
const CHOICES = {
  native: [{ name: "model", role: "native", values: listed(PROVIDERS) }],
  local: [
    { name: "transcriber", role: "transcribe", values: SETTINGS.transcriber.choices },
    { name: "polish", role: "polish", values: listed(CHAT_VENDORS.filter(({ id }) => id !== "custom")) },
  ],
  private: [{ name: "privateTranscriber", role: "transcribe", values: SETTINGS.privateTranscriber.choices }],
};

/** 缺的这一项是不是这一跳的：本机模型的下载、自定义服务的地址、这一跳那家的 key */
const needOfHop = (hop) => (need) => {
  if (need.kind === "download") return hop.platform === "local";
  if (need.kind === "url") return hop.platform === "custom";
  return need.platform === hop.platform;
};

/** 缺的那一项写成一句话，和引擎页说的一样 */
const needProblem = (need) =>
  msg(`home.mode.needs.${need.kind}`, {
    platform: findVendor(need.platform ?? "")?.name,
    model: findModel(need.model ?? "")?.name,
  });

/** 交给任务的参数：翻译照这条原来的目标语言，听写照现在设置里的成品字形 */
const parametersOf = (row, settings) =>
  row.kind === "translate" ? { output_language: row.outputLanguage } : { output_script: settings.outputScript.value };

/**
 * 历史里一条记录的录音：记录在、录音文件也在才有。回放和重跑共用
 * @param {{ history: { get(id: string): object | null }, recordingsDir: string }} where
 * @param {string} id
 * @returns {{ row: object, file: string }}
 */
export function recordingOf({ history, recordingsDir }, id) {
  const row = history.get(id);
  if (row === null) throw new LocalizedError(msg("history.notFound"));
  const file = row.audioFile === null ? null : join(recordingsDir, row.audioFile);
  if (file === null || !existsSync(file)) throw new LocalizedError(msg("history.noRecording"));
  return { row, file };
}

/**
 * @param {object} deps
 * @param {{ get(id: string): object | null, add(entry: object): void }} deps.history
 * @param {{ sources(): Record<string, string | null>, keyOf(id: string): { apiKey: string } | null }} deps.keys
 * @param {{ refineOnce(options: object): Promise<{ text: string, source: string | null }> }} deps.service
 * @param {{ status(id: string): { installed: boolean } }} deps.localModels
 * @param {string} deps.settingsFile
 * @param {Record<string, string | undefined>} deps.env
 * @param {string} deps.recordingsDir
 * @param {() => readonly string[]} deps.vocabulary
 * @param {(problem: object) => string} deps.describe 失败原因写成界面语言的一句话，存进失败的那条记录
 * @param {() => void} deps.changed 历史变了：让窗口重读
 * @param {{ info: Function, warn: Function }} deps.log
 * @param {() => string} [deps.uuid]
 * @param {() => Date} [deps.now]
 */
export function createRerun({
  history,
  keys,
  service,
  localModels,
  settingsFile,
  env,
  recordingsDir,
  vocabulary,
  describe,
  changed,
  log,
  uuid = randomUUID,
  now = () => new Date(),
}) {
  const settings = () => resolveSettings({ file: settingsFile, env });
  /** 每家的 key 在哪（不解密）、本机模型的状态：needsOf 要的 */
  const state = () => ({
    keys: keys.sources(),
    status: Object.fromEntries(MODELS.map(({ id }) => [id, localModels.status(id)])),
  });

  const taskOf = (row) => {
    const task = findTask(row.kind);
    if (!task) throw new Error(`历史里的 ${row.kind} 不是录音的功能，不能重跑`);
    return task;
  };

  /** 词典读不出来照样跑，和正常听写一样（server.mjs 的 vocabularyFor） */
  function vocabularyNow() {
    try {
      return vocabulary();
    } catch (error) {
      log.warn("vocabulary_unavailable", { error: String(error?.message ?? error) });
      return [];
    }
  }

  return {
    /**
     * 这条记录重跑时能选什么：三种方式各自做不做得了这个功能，能换的几项设置、每一项的候选（这一跳是谁、还差什么）。
     * 记录不在、录音不在时抛 LocalizedError
     * @param {string} id
     */
    options(id) {
      const { row } = recordingOf({ history, recordingsDir }, id);
      const task = taskOf(row);
      const current = settings();
      const known = state();
      const choiceOf = (mode, field, value) => {
        const route = routeOf(patchSettings(current, { [field.name]: value }), mode);
        const hop = hopsOf(route).find(({ role }) => role === field.role);
        return { value, hop, needs: needsOf(route, known).filter(needOfHop(hop)) };
      };
      const problemOfMode = (mode) => {
        try {
          return taskProblem(routeOf(current, mode), task);
        } catch (error) {
          return problemOf(error);
        }
      };
      return {
        mode: current.mode.value,
        modes: Object.fromEntries(
          Object.entries(CHOICES).map(([mode, fields]) => [
            mode,
            {
              problem: problemOfMode(mode),
              settings: fields.map((field) => {
                const chosen = current[field.name].value;
                const values = field.values.includes(chosen) ? field.values : [chosen, ...field.values];
                return {
                  name: field.name,
                  role: field.role,
                  current: chosen,
                  choices: values.map((value) => choiceOf(mode, field, value)),
                };
              }),
            },
          ]),
        ),
      };
    },

    /**
     * 按选的方式和那几项设置重跑，结果另存一条（录音还是原来那个文件）。选项这里再验一遍，不靠页面。
     * 跑到一半失败的也存一条：已经回了话的那几跳记过账，钱要有处可查
     * @param {{ id: string, mode: string, settings?: Record<string, string> }} request
     * @returns {Promise<{ ok: true, id: string } | { ok: false, problem: object }>}
     */
    async run({ id, mode, settings: changes = {} }) {
      let row;
      let file;
      let route;
      let bound;
      let apiKeys;
      try {
        ({ row, file } = recordingOf({ history, recordingsDir }, id));
        const current = settings();
        const foreign = Object.keys(changes).find((name) => !CHOICES[mode]?.some((field) => field.name === name));
        if (foreign) throw new TypeError(`重跑时 ${mode} 方式换不了 ${foreign}`);
        route = routeOf(patchSettings(current, { mode, ...changes }), mode);
        const task = taskOf(row);
        const [need] = needsOf(route, state());
        const problem = taskProblem(route, task) ?? (need ? needProblem(need) : null);
        if (problem) return { ok: false, problem };
        bound = task.bind(parametersOf(row, current));
        apiKeys = Object.fromEntries(keyVendorsOf(route).map(({ id: vendor }) => [vendor, keys.keyOf(vendor)?.apiKey]));
      } catch (error) {
        return { ok: false, problem: problemOf(error) };
      }

      const entry = {
        id: uuid(),
        kind: row.kind,
        outputLanguage: row.outputLanguage,
        duration: row.duration,
        audioFile: row.audioFile,
        // 重跑的再重跑，记的还是说出来的那一条
        rerunOf: row.rerunOf ?? row.id,
      };
      const startedAt = performance.now();
      const facts = () => ({
        from: id,
        to: entry.id,
        route: describeRoute(route),
        ms: Math.round(performance.now() - startedAt),
      });
      try {
        const result = await service.refineOnce({
          route,
          keys: apiKeys,
          audio: readFileSync(file),
          task: bound,
          mimeType: "audio/webm",
          audioId: entry.id,
          vocabulary: vocabularyNow(),
        });
        history.add({
          ...entry,
          status: "completed",
          refinedText: result.text,
          sourceText: row.kind === "translate" ? result.source : null,
          error: null,
          createdAt: now().toISOString(),
        });
        log.info("history_rerun", facts());
        return { ok: true, id: entry.id };
      } catch (error) {
        const problem = problemOf(error);
        history.add({
          ...entry,
          status: "failed",
          refinedText: "",
          error: describe(problem),
          createdAt: now().toISOString(),
        });
        log.warn("history_rerun_failed", { ...facts(), error: String(error?.message ?? error) });
        return { ok: false, problem };
      } finally {
        changed();
      }
    },
  };
}
