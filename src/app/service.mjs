// 内置的听写服务：就是 ../server 那个服务端，跑在主进程里，这样用的人不用另开一个终端。
// 页面和它之间仍然走 WebSocket，服务端照旧可以单独启动（调试、回放录音、评估提示词）。
// 走哪条识别链路、用哪些模型由"路线"定（../server/modes.mjs），设置里改了当场换。
// 本地转写链路要的本地模型由这里装卸：下载好了的装进转写进程，换模型或改走原生链路时卸掉。
// 设置成按需装载的（localModelMemory 不是 resident）开口时才装，空闲到点就释放，省下转写进程占的那一两 GB 内存。
// 下载不归这里：下不下由用户点（models/library.mjs），没下载的就停在 missing，说清楚去哪下。
import { LocalizedError, msg, problemOf } from "../i18n/index.mjs";
import { findModel } from "../models/catalog.mjs";
import { startTranscriber } from "../server/asr/start.mjs";
import { createModeRefiner, describeRoute, keyVendorOf, usesLocalModel } from "../server/modes.mjs";
import { startServer, WS_PATH } from "../server/server.mjs";

/** 设置里的 localModelMemory 换成空闲多久释放（毫秒）："5m" 是五分钟；常驻（resident）是 null */
const releaseAfterMs = (memory) => (memory === "resident" ? null : Number.parseInt(memory, 10) * 60_000);

/**
 * 启动内置服务。端口由系统分配，所以不会和别的程序（或单独启动的服务端）抢端口。
 * 没有 key 时服务照样在听，只是每次整理都会失败并说明原因；这样页面连的地址始终不变，填了 key 立刻能用。
 *
 * @param {object} options
 * @param {{ info: Function, warn: Function, error: Function }} options.log
 * @param {object} options.route 一开始走哪条路线（设置里的 mode 和各项，storage/settings.mjs 的 routeOf）
 * @param {string} [options.modelsDir] 本地模型放在哪（storage/paths.mjs 的 modelsDir）
 * @param {{ isInstalled(id: string): boolean, status(id: string): { download: object | null } }} [options.models]
 *   本机的模型库（models/library.mjs）：哪些下载好了、正在下的下到哪。它变了要调 modelsChanged
 * @param {(record: object) => void} [options.onModelCall] 记账：每一次回了话的模型调用（听写和验证 key 都算），
 *   见 ../server/refine/meter.mjs
 * @param {() => void} [options.onLocalModel] 本地模型的状态变了（缺、装载中、装好了、出错、空闲释放了）
 * @param {"auto" | "cpu"} [options.acceleration] 本地模型用不用显卡（设置里的 acceleration），换了调 setAcceleration
 * @param {string} [options.localModelMemory] 本地模型常驻（resident），还是开口时装载、空闲多久后释放（1m、5m、10m、30m），
 *   设置里的 localModelMemory，换了调 setLocalModelMemory
 * @param {() => readonly string[]} [options.vocabulary] 用户的词典（storage/vocabulary.mjs 的 terms），服务端每次听写读一次
 * @param {boolean} [options.livePreview] 录音时在悬浮条上显示暂定文字（设置里的 livePreview），换了调 setLivePreview
 * @param {typeof createModeRefiner} [options.createRefiner] 测试时换成假的
 * @param {typeof startTranscriber} [options.startLocal] 测试时换成假的
 */
export async function startService({
  log,
  route: initialRoute,
  modelsDir,
  models,
  onModelCall,
  onLocalModel = () => {},
  acceleration: initialAcceleration = "auto",
  localModelMemory = "resident",
  vocabulary = () => [],
  livePreview: initialLivePreview = true,
  createRefiner = createModeRefiner,
  startLocal = startTranscriber,
}) {
  /** 正在走的路线。换一条当场换上（setRoute），要的 key 之后由 key 管理装上（useKey） */
  let route = initialRoute;
  /** 路线里另一家（第一跳交给的云端）缺 key 时是那一家（forgetKey 的 missing）：听写时点名它，不点名主的那家 */
  let missing = null;
  const noKey = () =>
    new LocalizedError(
      missing
        ? msg("key.noKeyServiceFor", { provider: missing.name, id: missing.id })
        : msg("key.noKeyService", { provider: keyVendorOf(route).name }),
    );
  /** 通过了验证、正在用的那一个；没有 key 时是 null */
  let refiner = null;
  /** 换过几次路线（setRoute）：验 key 的途中换过，那一把是按旧路线验的，不装 */
  let switches = 0;
  /** 录音时要不要在悬浮条上显示暂定文字（设置里的 livePreview）。改设置不用重启，下一次录音就按新的来 */
  let livePreview = initialLivePreview;

  // ---------- 本地模型 ----------

  /**
   * 本地转写链路要的那个模型现在怎样：
   *   off（没走本地转写）/ idle（按需装载，现在没装着，开口时再装）/ missing（还没下载）/ loading / ready /
   *   failed（problem 是原因）
   */
  let local = { state: "off" };
  let acceleration = initialAcceleration;
  /** 正在装载或已经装好的那一次：换模型时用 transcriber 卸掉模型；ready 是装载的那个 Promise，检查时等它 */
  let loading = null;
  /** 按需装载时空闲多久释放；常驻是 null */
  let releaseMs = releaseAfterMs(localModelMemory);
  let idleTimer = null;
  /** 正在用本地模型的几件事（整理、检查转写器）：用着的时候不释放 */
  let busy = 0;

  function setLocal(next) {
    local = next;
    onLocalModel();
  }

  /**
   * 让本地模型跟着路线走：要的是别的模型就换，不走本地转写就卸掉；没下载的停在 missing；上次没装上的再装一次。
   * 按需装载的不在这里装，停在 idle 等开口（loadOnDemand）
   */
  function followRoute() {
    // 第一跳交给云端时没有本地模型要装
    const wanted = usesLocalModel(route) ? route.transcriber : null;
    if (wanted && !models.isInstalled(wanted)) {
      releaseLocal();
      if (local.state !== "missing" || local.model !== wanted) setLocal({ state: "missing", model: wanted });
      return;
    }
    if (loading?.model === wanted && local.state !== "failed") return;
    if (releaseMs !== null && local.model === wanted && ["idle", "failed"].includes(local.state)) return;
    releaseLocal();
    if (!wanted) return;
    if (releaseMs === null) loadLocal(wanted);
    else setLocal({ state: "idle", model: wanted });
  }

  /** 按需装载的开口时装上：空闲释放了的、上次没装上的都在这时再装 */
  function loadOnDemand() {
    if (releaseMs !== null && ["idle", "failed"].includes(local.state)) loadLocal(local.model);
  }

  /** 按需装载时从现在起重新算空闲，到点前没人用就释放。还没装好的、正用着的不算 */
  function restartIdleTimer() {
    clearTimeout(idleTimer);
    if (releaseMs === null || busy > 0 || !loading?.transcriber) return;
    idleTimer = setTimeout(() => {
      const { model } = loading;
      log.info("local_model_idle_released", { model, idle_ms: releaseMs });
      releaseLocal({ state: "idle", model });
    }, releaseMs);
    // 只剩这个计时器时不拦着进程退出
    idleTimer.unref();
  }

  function loadLocal(model) {
    const job = { model, transcriber: null, ready: null };
    loading = job;
    setLocal({ state: "loading", model });
    job.ready = startLocal({ modelId: model, modelsDir, log, acceleration });
    job.ready.then(
      (transcriber) => {
        if (loading !== job) {
          // 等它装好的这段时间里用户已经换了模型
          transcriber.dispose();
          return;
        }
        job.transcriber = transcriber;
        setLocal({ state: "ready", model, backend: transcriber.backend });
        restartIdleTimer();
      },
      (error) => {
        if (loading !== job) return;
        log.error("local_model_failed", { model, error: String(error?.stack ?? error) });
        setLocal({ state: "failed", model, problem: msg("local.modelFailed", { reason: problemOf(error) }) });
      },
    );
  }

  /** 卸掉装着（或正在装）的模型，状态换成 next；什么都没装、也不在等开口时不动 */
  function releaseLocal(next = { state: "off" }) {
    clearTimeout(idleTimer);
    if (!loading && local.state !== "idle") return;
    loading?.transcriber?.dispose();
    loading = null;
    setLocal(next);
  }

  /**
   * 给外面看的本地模型状态：还没下载、但用户正在下它时带上进度。
   * 按需装载的装载中、没装上带 onDemand：装载是开口才开始的，没装上的下次开口再装，都不该拦着按热键（app/setup-state.mjs）
   */
  function localView() {
    if (releaseMs !== null && ["loading", "failed"].includes(local.state)) return { ...local, onDemand: true };
    if (local.state !== "missing") return local;
    const download = models.status(local.model).download;
    return download ? { ...local, received: download.received, total: download.total } : local;
  }

  /** 交给本地转写链路的转写器：模型还没装好时说清是怎么回事，不让这次听写干等。用户词典随 options 原样转过去 */
  const transcriber = {
    async transcribe(samples, options) {
      // 按需装载的开口时就开始装了（prepare），这里等它装完；没装上的 loadLocal 已经记了日志、换成 failed，下面照常报。
      // 说完时还没装着的（开口时还没下载完、开口时那次没装上）这时再装一次
      if (releaseMs !== null) {
        loadOnDemand();
        if (loading && !loading.transcriber) await Promise.allSettled([loading.ready]);
      }
      if (loading?.transcriber) return loading.transcriber.transcribe(samples, options);
      const view = localView();
      if (view.state === "missing" && view.total) {
        const percent = Math.floor((view.received / view.total) * 100);
        throw new LocalizedError(msg("local.modelDownloading", { percent }));
      }
      if (view.state === "missing") {
        throw new LocalizedError(msg("local.modelMissing", { model: findModel(view.model).name, id: view.model }));
      }
      if (view.state === "failed") throw new LocalizedError(view.problem);
      throw new LocalizedError(msg("local.modelLoading"));
    },
  };

  const build = (nextRoute, apiKey, keys, localFirstHop = transcriber) =>
    createRefiner({ route: nextRoute, apiKey, keys, transcriber: localFirstHop, log, onCall: onModelCall });

  followRoute();

  /**
   * 录音时的暂定文字：只解录音、跑本机转写，不润色、不记账、不写历史。
   * 按需装载的模型还没装好时不等：这一次没字看，下一块再说（开口时 prepare 已经让它开始装了）
   * @param {Buffer} audio 到现在为止累积的录音
   * @param {{ mimeType: string, audioId: string, vocabulary?: readonly string[] }} options
   * @returns {Promise<{ text: string } | null>} null 表示这一次没有文字可看
   */
  async function preview(audio, options) {
    if (!refiner || typeof refiner.preview !== "function") return null;
    if (releaseMs !== null && !loading?.transcriber) return null;
    // 预览也算用着模型：空闲释放不能跑到一半把转写器卸掉
    busy++;
    clearTimeout(idleTimer);
    try {
      return await refiner.preview(audio, options);
    } finally {
      busy--;
      restartIdleTimer();
    }
  }

  const server = await startServer({
    port: 0,
    log,
    vocabulary,
    // 页面的每条消息都算动静：录音时每三秒一块音频，比最短的一分钟空闲短得多；取消了就不再有消息，到点自然释放
    onActivity: () => restartIdleTimer(),
    refiner: {
      async refine(audio, options) {
        if (!refiner) throw noKey();
        // 整理里有本机转写，整理完才开始算空闲
        busy++;
        clearTimeout(idleTimer);
        try {
          return await refiner.refine(audio, options);
        } finally {
          busy--;
          restartIdleTimer();
        }
      },
      /**
       * 开口时先做的准备：按需装载的本机模型这时开始装（不等它，说完整理时再等），Gemini 建提示词缓存（带着词典）。
       * 还没有 key 时只装模型
       */
      async prepare(options) {
        loadOnDemand();
        await refiner?.prepare?.(options);
      },
      // 服务端只看这个是不是函数：预览关着、或者这条路线做不了时，连排都不排
      get preview() {
        return livePreview && typeof refiner?.preview === "function" ? preview : null;
      },
    },
  });

  return {
    url: `ws://127.0.0.1:${server.port}${WS_PATH}`,

    get ready() {
      return refiner !== null;
    },

    /** 正在走的路线 */
    get route() {
      return route;
    },

    /** 本地模型现在怎样，见上面的 local（还没下载、正在下时带着 received、total） */
    get localModel() {
      return localView();
    },

    /** 模型库变了（下好了、删了、下载进度）：要的那个刚下好就装上 */
    modelsChanged() {
      followRoute();
      if (local.state === "missing") onLocalModel();
    },

    /** 换内存设置：改成常驻就当场装上；改成按需装载、换了时长的从现在起重新算空闲 */
    setLocalModelMemory(value) {
      releaseMs = releaseAfterMs(value);
      if (releaseMs === null) followRoute();
      else restartIdleTimer();
    },

    /** 换加速设置：装着（或正在装）本地模型的话按新的设置重装一遍（按需装载的卸掉，下次开口按新的设置装） */
    setAcceleration(value) {
      if (value === acceleration) return;
      acceleration = value;
      if (!loading) return;
      releaseLocal();
      followRoute();
    },

    /** 换文字预览的开关：不用重启，下一次录音就按新的来 */
    setLivePreview(value) {
      livePreview = Boolean(value);
    },

    /**
     * 给正在走的路线换一把 key。先拿它发一个最小的请求：key 无效、模型名写错、连不上都会在这里抛出来（都是分好类的
     * ModelError），这时原来能用的那把继续用。这个请求同时是预热，之后的第一次听写不会慢。
     * 本地转写链路验的是润色那一家：本地模型在后台另外准备，不等它。
     * 验证途中路线被换掉了（setRoute，当场换、不排队）：这一个是按旧路线装的，不装，回 stale，由 key 管理作废
     *
     * @param {string | null} apiKey 路线主的那家的 key（server/modes.mjs 的 keyVendorOf）；路线不用 key（数据隐私模式）时是 null
     * @param {{ allowUnverified?: boolean, keys?: Record<string, string> }} [options]
     *   allowUnverified：只是暂时够不着那一家的话照样启用。启动时、换路线后用存着的那把时用：它当初是验证过才存的，
     *   不该因为开机时没网、或者对方一时回了 503 就被判成不能用。
     *   keys：路线要两家时另一家的 key（第一跳交给云端、润色交给别家），按厂商 id
     * @returns {Promise<{ verified: boolean, stale?: true }>} verified 为 false 表示先用着、还没验证
     */
    async useKey(apiKey, { allowUnverified = false, keys } = {}) {
      const at = switches;
      const candidate = await build(route, apiKey, keys);
      let verified = true;
      try {
        await candidate.warmUp();
      } catch (error) {
        if (!allowUnverified || error.kind !== "unavailable") throw error;
        verified = false;
      }
      if (switches !== at) return { verified, stale: true };
      refiner = candidate;
      missing = null;
      return { verified };
    },

    /**
     * 换一条路线，不验证：切模式、换模型都先走这里，当场换上。手里的 refiner 是按旧路线装的，作废；
     * 新路线要的 key 由 key 管理去找、去装（useKey），装上之前听写时说缺什么，和启动时一样。
     * 本地模型跟着新路线走：没下载的停在 missing，下好了自己装上
     * @param {object} nextRoute
     */
    setRoute(nextRoute) {
      switches += 1;
      refiner = null;
      missing = null;
      log.info("route_switched", { from: describeRoute(route), to: describeRoute(nextRoute) });
      route = nextRoute;
      followRoute();
    },

    /**
     * 只换 local 模式第一跳的本地模型（没装上的那个再选一次就是重试）。润色那一跳和 key 都不动，不用重新验证：
     * 转写器是按名字取的（上面的 transcriber），装好的 refiner 照用，新模型在后台装载；还没下载的停在 missing
     * @param {string} model 本地模型的 id（models/catalog.mjs），调用方校验过
     */
    switchTranscriber(model) {
      if (route.mode !== "local" && route.mode !== "private") {
        throw new Error(`现在是 ${route.mode} 模式，只有 local 和 private 模式有本地模型可换`);
      }
      // 换到云端、或从云端换回本机，润色前面那一跳就不是同一个东西了，要重新装 refiner、找 key：整条路线重换（setRoute）
      if (!usesLocalModel(route) || !usesLocalModel({ ...route, transcriber: model })) {
        throw new Error(`第一跳 ${route.transcriber} → ${model} 涉及云端模型，要整条路线重换（setRoute）`);
      }
      // 同一个、也好好的：不用动。上次没装上的话照样往下走，再装一次
      if (model === route.transcriber && local.state !== "failed") return;
      log.info("transcriber_switched", { from: route.transcriber, to: model, retry: model === route.transcriber });
      route = { ...route, transcriber: model };
      followRoute();
    },

    /**
     * 检查一个本机模型：拿一段样本转写一次，看它能不能正常出字。正在用的那个（装好了或正在装）直接用它；
     * 别的临时装一个，转完就卸掉，不碰正在用的。要下载好了的，调用方先查过（modes.mjs）
     * @param {string} model 本地模型的 id
     * @param {Float32Array} samples 16 kHz 单声道（asr/probe.mjs 念的那句）
     * @returns {Promise<{ text: string, transcribeMs: number, loadMs: number | null, backend: string }>}
     *   loadMs：临时装的那个装了多久；用的是已经装着的是 null
     */
    async checkTranscriber(model, samples) {
      let transcriber;
      let loadMs = null;
      if (loading?.model === model) {
        transcriber = loading.transcriber ?? (await loading.ready);
      } else {
        const startedAt = performance.now();
        transcriber = await startLocal({ modelId: model, modelsDir, log });
        loadMs = Math.round(performance.now() - startedAt);
      }
      // 用的是装着的那个时，检查途中不能被空闲释放
      busy++;
      clearTimeout(idleTimer);
      try {
        const startedAt = performance.now();
        const { text } = await transcriber.transcribe(samples);
        const transcribeMs = Math.round(performance.now() - startedAt);
        // 只记长度和耗时：转出来的是念的那句检查用的话，不是用户说的，但也没必要进日志
        log.info("transcriber_checked", {
          model,
          backend: transcriber.backend,
          load_ms: loadMs,
          transcribe_ms: transcribeMs,
          text_length: text.length,
        });
        return { text, transcribeMs, loadMs, backend: transcriber.backend };
      } finally {
        if (loadMs !== null) transcriber.dispose();
        busy--;
        restartIdleTimer();
      }
    },

    /**
     * 拿一段存下来的录音、按另给的路线再跑一次（历史里重跑，app/rerun.mjs）。不改正在走的路线：另外建一个 refiner，跑完就丢。
     * 正在走的就是这个本机模型时借装着的那个，途中不能被空闲释放；别的本机模型照 checkTranscriber 临时装一个，跑完卸掉
     * （同一时间两份模型，内存或显卡上多占一份）。记账照记，audioId 用这一次新记录的那个 id
     * @param {{ route: object, keys?: Record<string, string>, audio: Buffer, task: object, mimeType: string,
     *   audioId?: string | null, vocabulary?: readonly string[] }} options
     * @returns {Promise<{ text: string, source: string | null }>}
     */
    async refineOnce({ route: tried, keys = {}, audio, task, mimeType, audioId = null, vocabulary = [] }) {
      const borrowed = usesLocalModel(route) && route.transcriber === tried.transcriber;
      const temporary =
        usesLocalModel(tried) && !borrowed
          ? await startLocal({ modelId: tried.transcriber, modelsDir, log, acceleration })
          : null;
      if (borrowed) {
        busy++;
        clearTimeout(idleTimer);
      }
      try {
        const refiner = await build(tried, keys[keyVendorOf(tried)?.id], keys, temporary ?? transcriber);
        return await refiner.refine(audio, { task, mimeType, audioId, vocabulary });
      } finally {
        temporary?.dispose();
        if (borrowed) {
          busy--;
          restartIdleTimer();
        }
      }
    },

    /** 把正在用的那把再验一次，没通过就抛错。启动时没连上网的，之后靠它补上验证 */
    async verify() {
      if (!refiner) throw noKey();
      await refiner.warmUp();
    },

    /**
     * 拿一把 key 试某条路线，不换掉正在用的：给别家存 key 前验证、speakmore model check 都用它。
     * @param {{ route: object, apiKey: string, keys?: Record<string, string> }} options keys 同 useKey
     */
    async probe({ route: tried, apiKey, keys }) {
      await (await build(tried, apiKey, keys)).warmUp();
    },

    /**
     * 不再用手里那把 key（删了、没通过）。缺的是路线里另一家的时写上 missing（{ id, name }），听写时点名它
     * @param {{ missing?: { id: string, name: string } }} [options]
     */
    forgetKey({ missing: vendor = null } = {}) {
      refiner = null;
      missing = vendor;
    },

    async close() {
      releaseLocal();
      await server.close();
    },
  };
}
