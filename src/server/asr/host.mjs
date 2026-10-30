import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { fitTerms } from "../../vocabulary/support.mjs";
import { SPEECH_SAMPLE_RATE } from "../audio/pcm.mjs";

// 转写进程：本地模型装在单独的子进程里跑（另一头是 worker.mjs），接口和 loadTranscriber 装出来的一样。
// 为什么不在本进程里跑：
// - 模型常驻要占一两 GB 内存（第一轮评测实测 Qwen3 Q8 加 Metal 约 2 GB）。换模型、改用原生链路时结束这个进程，内存就全还回去了。
// - 运行库是原生代码，崩了会带走整个进程。关在子进程里，崩了只丢这一次转写，下一次自动重开。
// - 各个系统的运行库差别（Metal、Vulkan、CUDA）都关在子进程里，主进程只认这几条消息。
// 子进程用的是本进程同一个可执行文件：在 App 里就是自带的 Electron，以 Node 的身份跑（ELECTRON_RUN_AS_NODE）。

const WORKER = fileURLToPath(new URL("./worker.mjs", import.meta.url));
/** 子进程崩溃时 stderr 留最后几行进日志，够看出是哪里出的事 */
const STDERR_LINES = 20;
/** 一次转写最多等多久：录音时长再加 30 秒。只用 CPU 时也有十几倍实时（第一轮评测），等这么久还没回就是卡死了 */
const defaultTimeout = (samples) => 30_000 + Math.round((samples.length / SPEECH_SAMPLE_RATE) * 1000);

/** 运行库在 stderr 上说位置不够了（sherpa-onnx 的 Qwen3："max_total_len (512) caps prompt + audio … Reduce hotwords"） */
const OVERFLOW = /max_total_len|Reduce hotwords/;

/** 开一个子进程跑 worker。advanced 序列化：Float32Array 原样传过去，不用先转成数组 */
function forkWorker(workerPath) {
  return fork(workerPath, [], {
    serialization: "advanced",
    stdio: ["ignore", "ignore", "pipe", "ipc"],
    // 在 Electron 里 fork 起来的是 Electron 本身，要让它当 Node 跑
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  });
}

/**
 * @param {object} request
 * @param {object} request.model 配置表里的一项（models/catalog.mjs）
 * @param {string} request.dir 模型下载到的目录
 * @param {object} [request.options] 交给运行库的参数（backend、threads…）
 * @param {{ info: Function, warn: Function, error: Function }} request.log
 * @param {string} [request.workerPath] 测试时换成假的 worker
 * @param {(samples: Float32Array) => number} [request.timeoutFor] 一次转写最多等多少毫秒，测试时换成短的
 * @returns {Promise<{ backend: string,
 *   transcribe(samples: Float32Array, o?: { vocabulary?: readonly string[] }): Promise<{ text: string }>, dispose(): void }>}
 *   装好了才返回；装不上会抛错（模型文件坏了、运行库加载不了）
 */
export async function spawnTranscriber({
  model,
  dir,
  options = {},
  log,
  workerPath = WORKER,
  start = forkWorker,
  timeoutFor = defaultTimeout,
}) {
  /** 正在跑的子进程和它装好的模型；崩了以后是 null，下一次转写时重开 */
  let current = null;
  let disposed = false;
  let nextId = 1;

  function launch() {
    const child = start(workerPath);
    const stderr = [];
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk) => {
      const lines = chunk.split("\n").filter(Boolean);
      stderr.push(...lines);
      stderr.splice(0, Math.max(0, stderr.length - STDERR_LINES));
      // 运行库说提示词（词表）挤占了录音的位置：录音会被截掉，平时不退出就看不到，单独记一条
      for (const line of lines.filter((each) => OVERFLOW.test(each))) {
        log.warn("transcriber_overflow", { model: model.id, said: line.slice(0, 300) });
      }
    });
    /** 等着回话的转写：id → { resolve, reject, timer } */
    const pending = new Map();
    const state = { child, pending, backend: null };

    const loaded = new Promise((resolve, reject) => {
      child.on("message", (message) => {
        if (message.type === "loaded") {
          state.backend = message.backend;
          log.info("transcriber_loaded", {
            model: model.id,
            backend: message.backend,
            load_ms: message.loadMs,
            warmup_ms: message.warmupMs ?? null,
          });
          resolve(state);
        } else if (message.type === "failed") {
          reject(new Error(`装不上模型 ${model.id}：${message.message}`));
          child.kill();
        } else {
          const waiting = pending.get(message.id);
          if (!waiting) return;
          pending.delete(message.id);
          clearTimeout(waiting.timer);
          if (message.type === "result") waiting.resolve({ text: message.text });
          else waiting.reject(new Error(`本地转写出错：${message.message}`));
        }
      });
      child.on("error", reject);
      child.on("exit", (code, signal) => {
        if (current === state) current = null;
        const reason = `转写进程退出了（code ${code}，signal ${signal}）`;
        reject(new Error(reason));
        for (const { reject: fail, timer } of pending.values()) {
          clearTimeout(timer);
          fail(new Error(reason));
        }
        pending.clear();
        if (!disposed) log.error("transcriber_exited", { model: model.id, code, signal, stderr: stderr.join("\n") });
      });
    });
    try {
      child.send({ type: "load", model, dir, options });
    } catch (error) {
      // 交不过去（比如配置里混进了复制不了的东西）：刚开的子进程关掉，别让它挂着
      child.kill();
      throw error;
    }
    current = state;
    return loaded;
  }

  /** 正在跑的那个；崩过的话重开一个并重新装模型 */
  const ready = () => (current ? Promise.resolve(current) : launch());

  /** 交给子进程转写一段，等它回话；超时从发出去这一刻算 */
  async function send(samples, vocabulary) {
    if (disposed) throw new Error("转写进程已经关了");
    const state = await ready();
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        state.pending.delete(id);
        reject(new Error(`本地转写超过 ${Math.round(timeoutFor(samples) / 1000)} 秒没有回话`));
        // 卡死的运行库救不回来，结束掉。先摘下来：它退出之前又来的转写要交给新开的那个
        log.error("transcriber_timeout", { model: model.id, seconds: samples.length / SPEECH_SAMPLE_RATE });
        if (current === state) current = null;
        state.child.kill();
      }, timeoutFor(samples));
      state.pending.set(id, { resolve, reject, timer });
      // 刚好在这一刻崩掉的话通道已经关了，退出的处理会把它报成失败
      if (state.child.connected) state.child.send({ type: "transcribe", id, samples, vocabulary });
    });
  }

  /** 排在前面的那一段跑完（成没成都算）才发下一段 */
  let queue = Promise.resolve();

  const first = await ready();
  return {
    backend: first.backend,

    /**
     * vocabulary：用户词典，按先后，随这一次交给子进程（收多少由那边按模型挑）。
     * 一次只转写一段，同时来的排队：同一个模型同时跑两份推理，引擎里共用的那一份（session、recognizer）不保证对。
     * 录音时的预览、说完的整理、历史里重跑、检测都走这里
     */
    transcribe(samples, { vocabulary = [] } = {}) {
      // 子进程里按模型的上限挑词（engines/index.mjs 的 windowed），这里按同样的规矩数一下，记进日志
      if (vocabulary.length > 0) {
        const sent = fitTerms(vocabulary, model.vocabulary).length;
        log.info("vocabulary_fitted", { hop: "transcribe", model: model.id, sent, of: vocabulary.length });
      }
      const turn = queue.then(() => send(samples, vocabulary));
      queue = turn.catch(() => {});
      return turn;
    },

    /** 卸掉模型、结束子进程。之后不能再用 */
    dispose() {
      disposed = true;
      if (!current) return;
      const { child } = current;
      current = null;
      // 先请它自己收拾（释放 GPU 资源），两秒还没走就强行结束
      if (child.connected) child.send({ type: "dispose" });
      setTimeout(() => child.kill(), 2_000).unref();
    },
  };
}
