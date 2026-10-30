import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { LocalizedError, msg } from "../i18n/index.mjs";

// 历史记录和记账。history 表取原版 history_v2 里听写用得到的那几列（docs/08-local-data.md），
// 列名保持一致；model_calls 表是每次调模型的账（原版没有，它是包月的）。
// 用 Node 自带的 SQLite，不用原版的 better-sqlite3：少一个要随 Electron 重新编译的原生模块。
// 后台应用负责写，命令行只读着看，两边用的是这同一份代码。

/**
 * 表结构的版本号，存在 PRAGMA user_version 里。以后改表时在 MIGRATIONS 末尾加一步，不改已有的。
 * 退回旧版本前要先把库降回去，旧版本见到比自己新的库不敢动、启动不了。从 2（记账）退回 1（0.4.2 及以前）：
 *   sqlite3 ~/.speakmore/data/history.db "DROP TABLE model_calls; PRAGMA user_version = 1;"
 * 只丢掉账，说过的话都在。
 * 从 3（语音翻译）退回 2（0.15 及以前）：
 *   sqlite3 ~/.speakmore/data/history.db "ALTER TABLE history DROP COLUMN kind; ALTER TABLE history DROP COLUMN source_text; ALTER TABLE history DROP COLUMN output_language; PRAGMA user_version = 2;"
 * 翻译的那几条只剩译文，看起来像普通的听写；别的都在。
 * 从 4（划词翻译）退回 3：
 *   sqlite3 ~/.speakmore/data/history.db "DELETE FROM model_calls WHERE purpose = 'lookup'; PRAGMA user_version = 3;"
 * 只丢掉划词的那几笔账（账表认的用途多一种，版本 3 不在乎）；划词的记录还在，再退回 2 时和翻译一样只剩译文。
 * 从 5（历史里重跑）退回 4：
 *   sqlite3 ~/.speakmore/data/history.db "ALTER TABLE history DROP COLUMN rerun_of; PRAGMA user_version = 4;"
 * 重跑出来的那几条还在，只是认不出是重跑，统计里会当成又说了一次。
 * 家目录搬过的照 speakmore status 里写的位置换路径。
 */
const MIGRATIONS = [
  `CREATE TABLE history (
     id               TEXT PRIMARY KEY,   -- audio_id
     status           TEXT NOT NULL CHECK (status IN ('completed', 'failed')),
     refined_text     TEXT NOT NULL,      -- 失败时是空字符串
     error            TEXT,               -- 失败原因，成功时为空
     duration         REAL NOT NULL,      -- 录音时长，秒
     audio_local_path TEXT,               -- 录音文件；失败的记录留着它，话不会白说。0.12.0 起只记文件名（见 fileNameOf）
     created_at       TEXT NOT NULL       -- ISO 8601
   );
   CREATE INDEX history_created_at ON history (created_at DESC);`,
  // 账和历史各记各的，不设外键：账在模型回话时就记了，历史要等成品贴出去才存；验证 key、提示词缓存
  // （建缓存、续存储，见 src/server/providers/gemini-cache.mjs）的那几笔不属于哪次听写
  `CREATE TABLE model_calls (
     id              INTEGER PRIMARY KEY,
     audio_id        TEXT,               -- 哪一次听写（history.id）；验证 key、提示词缓存的为空
     purpose         TEXT NOT NULL CHECK (purpose IN ('dictation', 'check', 'cache')),
     provider        TEXT NOT NULL,      -- gemini / openai / deepseek…；本机转写那一跳是 local
     model           TEXT NOT NULL,      -- 实际回话、按它算钱的型号
     input_tokens    INTEGER NOT NULL,   -- 输入，含音频和命中缓存的
     audio_tokens    INTEGER NOT NULL,   -- 其中音频
     cached_tokens   INTEGER NOT NULL,   -- 其中命中缓存
     output_tokens   INTEGER NOT NULL,   -- 输出，含思考的
     thinking_tokens INTEGER NOT NULL,   -- 其中思考
     cost_usd        REAL,               -- 按当时官方标准价算的美元；价目表里没有这个型号时为空
     latency_ms      INTEGER NOT NULL,   -- 发出请求到收齐回话
     created_at      TEXT NOT NULL       -- ISO 8601
   );
   CREATE INDEX model_calls_created_at ON model_calls (created_at);
   CREATE INDEX model_calls_audio_id ON model_calls (audio_id);`,
  // 语音翻译也进历史。原版在 history_v2 里用 mode（voice_transcript…）和一段 JSON（mode_meta）记，我们按功能分开：
  // kind 是动作目录的 id，老记录都是语音输入；翻译的原文和目标语言各一列，划词翻译以后也用这两列
  `ALTER TABLE history ADD COLUMN kind TEXT NOT NULL DEFAULT 'dictate';   -- 哪个功能：dictate、translate
   ALTER TABLE history ADD COLUMN source_text TEXT;                         -- 翻译的原文（refined_text 是译文）；不是翻译的为空
   ALTER TABLE history ADD COLUMN output_language TEXT;                     -- 翻译的目标语言（src/languages.mjs 的 id）`,
  // 划词翻译的账单独一类（lookup）：和听写分开数次数、等待时间。SQLite 改不了 CHECK，照原样建一张新表把账搬过去。
  // 划词的记录进 history：kind 是 lookup，refined_text 是译文、source_text 是选中的字，没有录音（audio_local_path 为空、
  // duration 是 0）
  `CREATE TABLE model_calls_v4 (
     id              INTEGER PRIMARY KEY,
     audio_id        TEXT,               -- 哪一次听写或划词（history.id）；验证 key、提示词缓存的为空
     purpose         TEXT NOT NULL CHECK (purpose IN ('dictation', 'lookup', 'check', 'cache')),
     provider        TEXT NOT NULL,
     model           TEXT NOT NULL,
     input_tokens    INTEGER NOT NULL,
     audio_tokens    INTEGER NOT NULL,
     cached_tokens   INTEGER NOT NULL,
     output_tokens   INTEGER NOT NULL,
     thinking_tokens INTEGER NOT NULL,
     cost_usd        REAL,
     latency_ms      INTEGER NOT NULL,
     created_at      TEXT NOT NULL
   );
   INSERT INTO model_calls_v4 (id, audio_id, purpose, provider, model, input_tokens, audio_tokens, cached_tokens,
                               output_tokens, thinking_tokens, cost_usd, latency_ms, created_at)
     SELECT id, audio_id, purpose, provider, model, input_tokens, audio_tokens, cached_tokens,
            output_tokens, thinking_tokens, cost_usd, latency_ms, created_at FROM model_calls;
   DROP TABLE model_calls;
   ALTER TABLE model_calls_v4 RENAME TO model_calls;
   CREATE INDEX model_calls_created_at ON model_calls (created_at);
   CREATE INDEX model_calls_audio_id ON model_calls (audio_id);`,
  // 历史里拿一条录音换个模型重跑，结果另存一条，记下是从哪条来的。统计（次数、字数、时长、听写的等待时间）
  // 不数重跑的：话只说了一次；钱照算，那一笔确实花了
  `ALTER TABLE history ADD COLUMN rerun_of TEXT;   -- 重跑的：原记录的 id；正常说的为空`,
];

/** 重跑那几次的账：用量里听写的次数、等待时间不数它们 */
const NOT_RERUN = "audio_id NOT IN (SELECT id FROM history WHERE rerun_of IS NOT NULL)";

function migrate(db) {
  const { user_version: current } = db.prepare("PRAGMA user_version").get();
  if (current > MIGRATIONS.length) {
    throw new LocalizedError(msg("storage.historyTooNew", { found: current, known: MIGRATIONS.length }));
  }
  for (let version = current; version < MIGRATIONS.length; version++) {
    db.exec("BEGIN");
    try {
      db.exec(MIGRATIONS[version]);
      db.exec(`PRAGMA user_version = ${version + 1}`);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}

/**
 * 录音在录音目录里叫什么。0.12.0 起历史里只记文件名，读的人按现在的录音目录拼完整路径：家目录整个搬了家也对得上。
 * 更早的版本记的是完整路径（macOS 的 / 或 Windows 的 \），只取最后的文件名。不改表结构：
 * Mac 上 App 和命令行可能是不同版本、共用这一个库，版本号一变，旧的那一份就起不来了
 */
const fileNameOf = (stored) => (stored === null ? null : stored.split(/[\\/]/).at(-1));

/**
 * 搜索的字 → LIKE 的模式：前后加 %，里面的 %、_、\ 按字面找（SQL 里配 ESCAPE '\'）。
 * 空的、没给的都是 null，不过滤
 */
function likePatternOf(query) {
  if (typeof query !== "string") return null;
  const text = query.trim();
  if (text === "") return null;
  return `%${text.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
}

/** 只看哪几个功能 → 交给 json_each 的 JSON 数组；不是数组是 null，不过滤 */
const kindsParam = (kinds) =>
  Array.isArray(kinds) ? JSON.stringify(kinds.filter((kind) => typeof kind === "string")) : null;

/** 只读着看的那一方不能替库升级，版本对不上时列可能不一样，所以不读 */
function openReadOnly(dbPath) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const { user_version: version } = db.prepare("PRAGMA user_version").get();
  if (version !== MIGRATIONS.length) {
    db.close();
    throw new LocalizedError(msg("storage.historyTooOld", { found: version, known: MIGRATIONS.length }));
  }
  return db;
}

/**
 * 打开历史库。默认没有就新建，并把表结构升到最新。
 * @param {string} dbPath
 * @param {{ readOnly?: boolean }} [options] 只读时不新建也不升级；库还不存在就返回 null
 */
export function openHistory(dbPath, { readOnly = false } = {}) {
  let db;
  if (readOnly) {
    if (!existsSync(dbPath)) return null;
    db = openReadOnly(dbPath);
  } else {
    mkdirSync(dirname(dbPath), { recursive: true });
    db = new DatabaseSync(dbPath);
    try {
      migrate(db);
    } catch (error) {
      // 打不开（比如库比程序新）也要把文件关掉：Windows 上开着的文件删不掉、挪不走
      db.close();
      throw error;
    }
  }
  // 另一个进程正好在写的时候等一下，不立刻报"库被锁住"
  db.exec("PRAGMA busy_timeout = 2000");

  const insert = db.prepare(
    `INSERT INTO history (id, kind, status, refined_text, source_text, output_language, error, duration,
                         audio_local_path, rerun_of, created_at)
     VALUES (:id, :kind, :status, :refinedText, :sourceText, :outputLanguage, :error, :duration, :audioFile,
             :rerunOf, :createdAt)`,
  );
  const insertCall = db.prepare(
    `INSERT INTO model_calls (audio_id, purpose, provider, model, input_tokens, audio_tokens, cached_tokens,
                              output_tokens, thinking_tokens, cost_usd, latency_ms, created_at)
     VALUES (:audioId, :purpose, :provider, :model, :inputTokens, :audioTokens, :cachedTokens,
             :outputTokens, :thinkingTokens, :costUsd, :latencyMs, :createdAt)`,
  );
  // 先取最近的几条再去对账，账再多也只按 audio_id 的索引查这几条的。
  // 一条里有一笔不知道价，这一条的钱就是 null：拿一半当全部会少算。
  // query 是搜索的字，按成品、原文、失败原因找；kinds 是只数这几个功能的；id 是只要这一条（都是 NULL 时不过滤）。
  // models 是这一条用到的型号，重跑时看得出是哪个模型出的
  const select = db.prepare(
    `WITH recent AS (
       SELECT * FROM history
       WHERE (:id IS NULL OR id = :id)
         AND (:query IS NULL OR refined_text LIKE :query ESCAPE '\\'
              OR source_text LIKE :query ESCAPE '\\'
              OR error LIKE :query ESCAPE '\\')
         AND (:kinds IS NULL OR kind IN (SELECT value FROM json_each(:kinds)))
       ORDER BY created_at DESC LIMIT :limit
     )
     SELECT recent.id, recent.kind, recent.status, recent.refined_text AS refinedText, recent.source_text AS sourceText,
            recent.output_language AS outputLanguage, recent.error, recent.duration,
            recent.audio_local_path AS audioFile, recent.rerun_of AS rerunOf, recent.created_at AS createdAt,
            group_concat(DISTINCT call.model) AS models,
            count(call.id) AS calls,
            sum(call.input_tokens) AS inputTokens,
            sum(call.output_tokens) AS outputTokens,
            CASE WHEN count(call.cost_usd) = count(call.id) THEN sum(call.cost_usd) END AS costUsd,
            sum(call.latency_ms) AS latencyMs
     FROM recent LEFT JOIN model_calls AS call ON call.audio_id = recent.id
     GROUP BY recent.id
     ORDER BY recent.created_at DESC`,
  );
  // kinds 是 JSON 数组，只数这几个功能的；为空时全数。entries 不管功能，是这段时间里所有记录的条数。
  // 字数按他说的那段数（翻译的是原文），和下面的 dictations() 一个口径：译成英文按字母数，语速会虚高三倍。
  // 重跑的不数：话只说了一次
  const summarize = db.prepare(
    `WITH picked AS (
       SELECT * FROM history
       WHERE created_at >= :since AND rerun_of IS NULL
         AND (:kinds IS NULL OR kind IN (SELECT value FROM json_each(:kinds)))
     )
     SELECT (SELECT count(*) FROM history WHERE created_at >= :since) AS entries,
            count(*) FILTER (WHERE status = 'completed') AS dictations,
            coalesce(sum(length(coalesce(source_text, refined_text))) FILTER (WHERE status = 'completed'), 0) AS characters,
            coalesce(sum(duration) FILTER (WHERE status = 'completed'), 0) AS seconds,
            count(*) FILTER (WHERE status = 'failed') AS failed,
            (SELECT coalesce(sum(cost_usd), 0) FROM model_calls WHERE created_at >= :since) AS costUsd,
            (SELECT count(*) - count(cost_usd) FROM model_calls WHERE created_at >= :since) AS unpricedCalls
     FROM picked`,
  );
  // 说了什么：翻译的是原文（他说的那段话），别的是成品。重跑的不算又说了一次
  const completed = db.prepare(
    `SELECT created_at AS createdAt, kind, coalesce(source_text, refined_text) AS text, duration FROM history
     WHERE status = 'completed' AND refined_text <> '' AND rerun_of IS NULL ORDER BY created_at`,
  );
  // 用量汇总的各列，总数和按型号分开的两处共用
  const USAGE_COLUMNS = `count(*) AS calls,
            count(*) FILTER (WHERE purpose = 'check') AS checks,
            count(DISTINCT audio_id) FILTER (WHERE purpose = 'dictation' AND ${NOT_RERUN}) AS dictations,
            count(DISTINCT audio_id) FILTER (WHERE purpose = 'lookup') AS lookups,
            coalesce(sum(input_tokens), 0) AS inputTokens,
            coalesce(sum(audio_tokens), 0) AS audioTokens,
            coalesce(sum(cached_tokens), 0) AS cachedTokens,
            coalesce(sum(output_tokens), 0) AS outputTokens,
            coalesce(sum(thinking_tokens), 0) AS thinkingTokens,
            coalesce(sum(cost_usd), 0) AS costUsd,
            coalesce(sum(cost_usd) FILTER (WHERE purpose = 'cache'), 0) AS cacheCostUsd,
            count(*) - count(cost_usd) AS unpricedCalls`;
  const usageTotals = db.prepare(`SELECT ${USAGE_COLUMNS} FROM model_calls WHERE created_at >= :since`);
  const usageByModel = db.prepare(
    `SELECT provider, model, ${USAGE_COLUMNS} FROM model_calls WHERE created_at >= :since
     GROUP BY provider, model ORDER BY costUsd DESC, calls DESC`,
  );
  // 花费随时间怎么走：按本机日历的哪一天（或哪个钟头）、哪个型号分开加。'localtime' 用的是这台机器的时区，
  // 和同一个进程里 Date 认的一致；在库里先分好组，不把每一笔都搬出来
  const usageSlots = db.prepare(
    `SELECT strftime(:format, created_at, 'localtime') AS slot, provider, model, coalesce(sum(cost_usd), 0) AS costUsd
     FROM model_calls WHERE created_at >= :since
     GROUP BY slot, provider, model ORDER BY slot, provider, model`,
  );
  const SLOT_FORMATS = { day: "%Y-%m-%d", hour: "%Y-%m-%d %H" };
  // 每次听写等了模型多久：夹着时间戳重来过的，几次加在一起才是用户等的；本机转写的两跳（local 那一笔加润色那一笔）
  // 也加在一起。按型号分开时各算各的。重跑的不算：没人在等它贴字，挑的又多是长的老录音
  const totalLatencies = db.prepare(
    `SELECT sum(latency_ms) AS ms FROM model_calls
     WHERE purpose = 'dictation' AND audio_id IS NOT NULL AND ${NOT_RERUN} AND created_at >= :since
     GROUP BY audio_id ORDER BY ms`,
  );
  const dictationLatencies = db.prepare(
    `SELECT provider, model, sum(latency_ms) AS ms FROM model_calls
     WHERE purpose = 'dictation' AND audio_id IS NOT NULL AND ${NOT_RERUN} AND created_at >= :since
     GROUP BY audio_id, provider, model ORDER BY ms`,
  );

  /** 一行记录 → 对外的样子：录音只留文件名；用量没记账是 null，有就几项加在一起，models 是用到的型号 */
  const rowOf = ({ models, calls, inputTokens, outputTokens, costUsd, latencyMs, ...row }) => ({
    ...row,
    audioFile: fileNameOf(row.audioFile),
    usage: calls === 0 ? null : { calls, inputTokens, outputTokens, costUsd, latencyMs, models: models.split(",") },
  });

  return {
    /**
     * @param {{ id: string, kind?: string, status: "completed" | "failed", refinedText: string, sourceText?: string | null,
     *   outputLanguage?: string | null, error: string | null, duration: number, audioFile: string | null,
     *   rerunOf?: string | null, createdAt: string }} entry
     *   kind：哪个功能（动作目录的 id），不写是语音输入；sourceText、outputLanguage：翻译的原文和目标语言，不是翻译的不写；
     *   audioFile：录音在录音目录（paths.recordingsDir）里的文件名，没存录音是 null；rerunOf：重跑的，原记录的 id
     */
    add({ kind = "dictate", sourceText = null, outputLanguage = null, rerunOf = null, ...entry }) {
      insert.run({ ...entry, kind, sourceText, outputLanguage, rerunOf });
    },
    /**
     * 最近的记录，新的在前。每一条带上它的用量 usage：{ calls, inputTokens, outputTokens, costUsd, latencyMs, models }，
     * 夹着时间戳重来过的几次加在一起；没记过账的（没调到模型就失败了，或者记账之前的版本存的）是 null。
     * 录音是 audioFile：录音目录里的文件名；重跑出来的带 rerunOf
     * @param {{ limit?: number | null, query?: string | null, kinds?: readonly string[] | null }} [options]
     *   limit 是 null 时不限条数；query：搜索的字，按成品、原文、失败原因找；kinds：只看这几个功能的。都是 null 时不过滤
     */
    list({ limit = 200, query = null, kinds = null } = {}) {
      return select
        .all({ id: null, limit: limit ?? -1, query: likePatternOf(query), kinds: kindsParam(kinds) })
        .map(rowOf);
    },
    /**
     * 按 id 取一条，形同 list() 的一项；没有是 null
     * @param {string} id
     */
    get(id) {
      return select.all({ id: String(id), limit: 1, query: null, kinds: null }).map(rowOf)[0] ?? null;
    },
    /**
     * 说了多少次、多少字、多长时间（只数完成的），失败了几次，以及花了多少美元（验证 key 的也算）。
     * 钱只加得上知道价的那几笔，不知道价的有几笔另报（unpricedCalls），给人看时要说"至少"。
     * entries 是这段时间里一共几条记录，不管功能、不管成没成
     * @param {{ since?: string, kinds?: readonly string[] }} [range] 只数这个时刻（ISO 8601）之后的；
     *   kinds：次数、字数、时长只数这几个功能的（命令行只数说话的那几个），不写是全部
     */
    stats({ since = "", kinds = null } = {}) {
      return { ...summarize.get({ since, kinds: kindsParam(kinds) }) };
    },
    /**
     * 所有完成了的记录，老的在前，只带首页统计要的几项（src/usage/insights.mjs）：字数、哪天说的要从文字和时间里数。
     * text 是他说的那段话：翻译的是原文，别的是成品。没听到声音的（模型回了空文字）不算：误按一下不该算一天活跃，
     * 也不该拉低语速。一条百来个字，几千条也就几百 KB，不在库里预先汇总
     * @param {{ kinds?: readonly string[] }} [filter] 只要这几个功能的（首页只数说话的那几个）；不写是全部
     */
    dictations({ kinds } = {}) {
      const rows = completed.all().map((row) => ({ ...row }));
      return kinds ? rows.filter((row) => kinds.includes(row.kind)) : rows;
    },
    /**
     * 记一笔账：一次回了话的模型调用（src/server/refine/refiner.mjs 的 onCall 给的样子）。
     * @param {{ purpose: "dictation" | "lookup" | "check" | "cache", audioId: string | null, provider: string, model: string, inputTokens: number, audioTokens: number, cachedTokens: number, outputTokens: number, thinkingTokens: number, costUsd: number | null, latencyMs: number, createdAt: string }} call
     */
    addCall(call) {
      // 只取表里有的几项：多给一项的话 SQLite 会报"未知参数"，适配器多带一项用量不该让账记不上
      insertCall.run({
        audioId: call.audioId,
        purpose: call.purpose,
        provider: call.provider,
        model: call.model,
        inputTokens: call.inputTokens,
        audioTokens: call.audioTokens,
        cachedTokens: call.cachedTokens,
        outputTokens: call.outputTokens,
        thinkingTokens: call.thinkingTokens,
        costUsd: call.costUsd,
        latencyMs: call.latencyMs,
        createdAt: call.createdAt,
      });
    },
    /**
     * 用量汇总：调了几次（几次是验证 key）、几次听写、几次划词、各项 token、多少美元（其中提示词缓存多少）、几次不知道价（没算进钱里），
     * latenciesMs 是每次听写等模型的毫秒数（从快到慢）；models 是按型号分开的同样几项，花得多的在前。
     * @param {{ since?: string }} [range] 只数这个时刻（ISO 8601）之后的
     */
    usage({ since = "" } = {}) {
      const latencies = dictationLatencies.all({ since });
      const latenciesOf = (provider, model) =>
        latencies.filter((row) => row.provider === provider && row.model === model).map(({ ms }) => ms);
      return {
        ...usageTotals.get({ since }),
        latenciesMs: totalLatencies.all({ since }).map(({ ms }) => ms),
        models: usageByModel
          .all({ since })
          .map((row) => ({ ...row, latenciesMs: latenciesOf(row.provider, row.model) })),
      };
    },
    /**
     * 花费随时间怎么走（首页花费卡的趋势图，src/usage/series.mjs 再分格）：每天或每个钟头、每个型号一行，
     * slot 是本机日历上的 YYYY-MM-DD 或 YYYY-MM-DD HH，老的在前。不知道价的那几笔算 0
     * @param {{ since?: string, unit: "day" | "hour" }} range 只数这个时刻（ISO 8601）之后的
     * @returns {{ slot: string, provider: string, model: string, costUsd: number }[]}
     */
    usageOverTime({ since = "", unit }) {
      const format = SLOT_FORMATS[unit];
      if (!format) throw new Error(`usageOverTime 的 unit 只能是 day 或 hour，现在是 ${JSON.stringify(unit)}`);
      return usageSlots.all({ format, since }).map((row) => ({ ...row }));
    },
    close() {
      db.close();
    },
  };
}
