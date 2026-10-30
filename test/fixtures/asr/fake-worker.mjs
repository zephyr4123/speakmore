// 假的转写进程：协议照真的走（worker.mjs 的 serveTranscriber），模型换成假的。
// 交来的样本个数决定它怎么做：1 个 → 进程崩掉，2 个 → 一直不回话，3 个 → 运行库报错，
// 4 个 → 先在 stderr 上说位置不够（同 sherpa-onnx 的 Qwen3）再照常回，10 个 → 跑 50 毫秒、回到这时为止最多几段同时在跑，
// 别的 → 回 "模型 id:样本数"，带了词表的再接上 ":词|词"
import { serveTranscriber } from "../../../src/server/asr/worker.mjs";

serveTranscriber(
  { on: (event, handler) => process.on(event, handler), send: (m) => process.send(m), exit: process.exit },
  async ({ model, options }) => {
    if (options.failLoad) throw new Error("模型文件坏了");
    let running = 0;
    let most = 0;
    return {
      backend: "fake",
      async transcribe(samples, { vocabulary = [] } = {}) {
        if (samples.length === 1) process.exit(3);
        if (samples.length === 2) return new Promise(() => {});
        if (samples.length === 3) throw new Error("运行库报错");
        if (samples.length === 10) {
          most = Math.max(most, ++running);
          await new Promise((done) => setTimeout(done, 50));
          running--;
          return { text: `most:${most}` };
        }
        if (samples.length === 4) {
          process.stderr.write("qwen3-asr: The max_total_len (512) caps prompt + audio KV. Reduce hotwords\n");
        }
        if (!(samples instanceof Float32Array)) throw new Error("样本不是 Float32Array");
        return { text: `${model.id}:${samples.length}${vocabulary.length > 0 ? `:${vocabulary.join("|")}` : ""}` };
      },
      dispose() {},
    };
  },
);
process.on("disconnect", () => process.exit(0));
