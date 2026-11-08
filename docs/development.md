# 开发

[README](../README.md) 讲的是怎么装、怎么用，这里是从源码跑、目录结构、打包发布，和每一版实际验证到了哪一步。和原版的对应关系、模型怎么选、提示词怎么调的，在[实现笔记](implementation-notes.md)里。

## 从源码跑

从源码跑需要 Node 22.13 以上（用 23 的话要 23.4 以上）和 Xcode 命令行工具（`xcode-select --install`）：

```bash
git clone https://github.com/zephyr4123/speakmore.git
cd speakmore
npm install
npm start                     # 就是 speakmore；子命令写在 -- 后面，比如 npm start -- status
npm run check                 # 代码检查 + 全部测试（不联网、不开窗口），含两个原生小帮手的测试（npm run test:native）
npm run test:electron         # 单测在 Electron 自带的 Node 上再跑一遍（只在 Mac 上用）：装到使用者手里的程序都跑在它上面
node scripts/dev/mac-hotkeys.mjs   # Mac 小帮手的回归：真的 tap 和 Carbon，合成按键全在末尾接住、不到任何应用；改了 native/mac/ 跑一遍（锁屏、别的应用开着安全输入时不发键）
node scripts/build/hotkey-fixtures.mjs   # 改了按键轨迹样例或键表后重新生成两个系统各一份（npm test 会查生成的和提交的一样）
npm run release               # 打发布：dist/release/ 下是更新用的块和清单、首次安装用的包和两个安装脚本，摆成下载地址上的样子
```

**发布新版本**：改 `package.json` 里的版本号和两份 README（中文 README.md、英文 README.en.md）里安装包的下载链接（测试会核对它们对得上）并提交，打一个同名的带说明的标签，只推标签（比如 `git tag -a v0.4.1 -m "…" && git push origin v0.4.1`；main 等包传完再推，不然 README 的下载链接会先 404），然后在本机运行 `npm run ship`。它先核对工作区干净、当前提交就是那个标签、标签已经推上去，再跑全部检查、打包（安装包要签名、公证，本机没配就不往下走，每个包等苹果公证几分钟），先和下载地址上现在的版本比一遍每种装法要下多少（`scripts/release/delta-report.mjs`：Electron 没换、却有哪种装法要下 20 MB 以上，多半是打包出了问题，拦下来），再传到下载地址 `dl.zephyrxiang.com/speakmore/`（腾讯云 COS + CDN），然后从下载地址核对 channel.json、各个包的校验值、两个安装脚本和五份更新清单，最后公开 GitHub 上这一版的 Release（`scripts/release/github-release.sh publish`）。GitHub 上的 Release 是代码层面的发版，只有源码和说明，不放安装包：推标签时 CI（`.github/workflows/release.yml`）在干净的 Mac 上跑一遍检查（和 PR、推 main 时跑的 `ci.yml` 是同一套，也和 ship 跑的一样），过了建成草稿，说明由 `scripts/release/release-notes.mjs` 从标签说明和上一个版本以来合进主干的分支、PR 生成（本机预览：`node scripts/release/release-notes.mjs v0.4.1`）。包齐了没有只在 ship 那头判断：公开前核对下载地址上有这一版最后传的那个文件，CI 还没跑完就等它；只有下载地址上的最新版标成 Latest。这一步没成不影响已经发好的包，ship 会说清楚，处理好后单独跑 `scripts/release/github-release.sh publish v0.4.1`；补发某个以前发过的版本也是这一行（CI 没给它跑过就在本机建草稿再公开）。桶和密钥从哪来写在 `.machine.env` 里。发布包只放在 COS 这一处；发布过的版本号不会被覆盖，要改就升版本号。传到一半断了，不要重新打包，再运行一次 `scripts/release/with-cos-key.sh npm run publish-release`，传好的会跳过。安装包交给苹果公证时连不上、超时（没拿到苹果的结论），隔 30 秒重交，最多三次；苹果判了不通过的不重交。应用本身那次公证由 @electron/packager 做，不重试。打包要用的 Electron 从国内镜像 npmmirror 下（`scripts/build/electron-mirror.mjs`，本机连 GitHub 太慢），按 electron 包自带的校验值核对；镜像出问题时设环境变量 `ELECTRON_MIRROR=https://github.com/electron/electron/releases/download/` 换回 GitHub。签名时每个文件都要向苹果要时间戳，偶尔一次没连上，签名库也不重试；打包时 PATH 最前面换成了 `scripts/build/codesign-retry/codesign`，碰到时间戳服务没连上就隔 5 秒重签，最多 5 次。发完再部署一次官网（`cd website && npm run deploy`，见[官网说明](../website/README.md#上线)），官网上的下载链接才指向新版本。最后验收线上的包，两份都不碰真在用的那一份：`scripts/release/accept-mac.sh` 下载 Apple 芯片的 dmg、核对校验值和公证，挂载后用隔离的家目录真启动一次，再照终端安装那一行装进临时目录、`update` 应说已是最新；`scripts/release/accept-win.sh` 在 Windows 开发机的隔离用户目录里先装上一个版本并开着，再照 `irm` 那一行升上来，看旧版本停掉、删掉，`update` 应说已是最新，起来看日志（经 ssh 跑，不碰桌面会话）。

**下载地址上的摆法**（`src/update/layout.mjs`，打包、上传、更新、安装脚本共用）：

- `channel.json`：最新的版本号、用哪个 Electron，每种装法用哪份更新清单。装法有五种：两种芯片的 Mac 终端安装、两种芯片的 SpeakMore.app、Windows。只缓存一分钟，传的时候最后传。
- `store/<sha256>`：块和清单，名字是原始内容的 sha256，存的是 zstd 压过的，传上去就不再变。打包时每棵目录树按内容切成平均 128 KiB 的块（FastCDC，`src/update/chunker.mjs`），同一块只存一份。
- `v<版本>/`：首次安装用的包和同名的 `.sha256`：Mac 终端安装的 `speakmore-darwin-<芯片>.tar.xz`、Mac 的 `SpeakMore-<芯片>.dmg`（ULMO）、Windows 一行命令装的 `speakmore-win32-x64.zip`、Windows 的安装程序 `SpeakMore-Setup-x64.exe`（身上带着 zstd 压的同一棵树）。
- `install.sh`、`install.ps1`：安装脚本。

**更新**只下本机缺的块：照新版本的清单拼出整棵树，本机装着的几份里有的块直接拷，每块写进去前核对 sha256，拼出来的和发布的逐字节相同，所以拼完照旧核对 App 的签名和开发者、照旧让安装脚本试跑。0.10.0 → 0.10.1 实测要下的：Mac App 1.31 MB、Windows 0.25 MB、Mac 终端 0.13 MB（整包是一两百兆）。换 Electron 的那一版要多下 Electron 里变了的部分。0.10.1 及以前的版本读的是已经不再更新的 `latest`，看不到之后的版本，要用一行命令或安装包重新装一次。

从源码跑的和装好的用的是同一个家目录（定位文件说的那个，没有定位文件就是 `~/.speakmore`），想分开就设 `SPEAKMORE_HOME`：它只管这一次，从不改定位文件。

**家目录放在哪、搬家**：程序、模型、数据全在一个家目录里，它可以在任何地方，在哪记在家目录以外唯一的一个文件里——定位文件（`src/storage/location.mjs`：Mac 是 `~/Library/Application Support/com.zephyrxiang.speakmore/location.json`，Windows 是 `%LOCALAPPDATA%\SpeakMore\location.json`）。只有装在默认位置以外才有它，只在明确选了位置时写：第一次安装时选的（Mac App 第一次打开的对话框 `src/app/first-run.mjs`、Windows 安装程序的对话框、安装脚本在终端里问的、`SPEAKMORE_INSTALL_DIR`）、搬家（`src/move/`）。找家目录的顺序是 `SPEAKMORE_HOME` → 定位文件 → 默认位置；定位文件说的目录不在（移动硬盘没接）就报错，不新建空的。装好的程序自己认得自己在哪：Mac 的启动脚本按自己所在的目录，Windows 的 App 按自己所在的 `versions\`，所以里面没有写死的路径。搬家（命令行 `speakmore move`、App 设置里的"存储位置"，同一套）：先检查新位置、试盘（exFAT 这类建不了套接字、符号链接、只给自己的权限），停掉正在运行的，只拷 SpeakMore 自己的东西，再交给新位置自带的安装脚本"换家"（`SPEAKMORE_PREVIOUS_HOME`：试跑、改命令链接、Path、开始菜单、开机启动、定位文件），最后旧目录放下 `MOVED.json`、只删我们的。提交之前任何一步出错都换回旧目录；断在半路的，下次启动时 `settleMove` 收拾好：从旧目录启动的把入口换回来、删掉拷了一半的（只认新位置 `run/move.json` 里同一次搬家的记号），从拷了一半的那一份启动的先把入口换回旧目录、说再打开一次；启动时换不回来不挡启动（旧目录完好），下次再收拾。搬家进行中，直接改家目录里文件的命令（`dict`、`config`、`key` 这些）不做。App 里搬家时另起一个自己的进程开进度窗口（`src/app/move-window.mjs`）。

要试搬家、第一次安装这些会写定位文件的，把 `HOME` 换成临时目录（Windows 是 `USERPROFILE`、`LOCALAPPDATA`）：定位文件、默认位置都跟着它走，不碰这台电脑上真的。这时用 Electron 本体起（`node_modules/electron/dist/Electron.app/Contents/MacOS/Electron .`）：`node_modules/.bin/electron` 换了 `HOME` 会卡住不动。只搬"记着的那一个"：`SPEAKMORE_HOME` 临时指到别处的家目录不让搬，免得定位文件被改指到它。例外是 0.11.0 及以前用 `SPEAKMORE_HOME` 装到别处的：没有定位文件、默认位置没装过、那里装着会换家的程序时认它。

要真调模型的命令需要环境里有那一家的 key（`GEMINI_API_KEY`、`OPENAI_API_KEY`、`DEEPSEEK_API_KEY`、阿里云百炼的 `BAILIAN_API_KEY`、Kimi 的 `MOONSHOT_API_KEY`、智谱的 `ZHIPU_API_KEY`、MiniMax 的 `MINIMAX_API_KEY`）。`scripts/dev/with-key.sh <厂商>` 可以按你自己机器上的配置把它只喂给一条命令，见 `.machine.env.example`。用哪家哪个模型由 `SPEAKMORE_MODEL` 定，默认 Gemini：

```bash
scripts/dev/with-key.sh gemini node scripts/dev/e2e.mjs 一段录音.wav   # 端到端：真的 Electron、录音编码、模型；麦克风和贴字是假的
SPEAKMORE_MODEL=openai scripts/dev/with-key.sh openai node scripts/dev/e2e.mjs 一段录音.wav   # 同上，换成 OpenAI
SPEAKMORE_MODE=local scripts/dev/with-key.sh deepseek node scripts/dev/e2e.mjs 一段录音.wav   # 本地转写加 DeepSeek 润色：新的数据目录，模型真从下载源下
SPEAKMORE_E2E_ELECTRON=dist/SpeakMore-darwin-arm64/SpeakMore.app/Contents/MacOS/SpeakMore …   # 同上，用打好的应用跑（npm run dist 打的，签了名时开着 hardened runtime）
SPEAKMORE_E2E_VOCABULARY="词1,词2" SPEAKMORE_E2E_EXPECT=词1 …   # 同上，带一份词典跑，成品里要有那个词；SPEAKMORE_E2E_MODELS=<已装好的模型仓> 免得每次重下本机模型
SPEAKMORE_MODE=private SPEAKMORE_LOCAL_MODEL_MEMORY=1m SPEAKMORE_E2E_ROUNDS=2 node scripts/dev/e2e.mjs 一段录音.wav   # 本机模型按需装载：听写两遍，中间等它空闲释放，第二遍验重新装载
scripts/dev/with-key.sh gemini node scripts/dev/eval-prompt.mjs --label v1   # 拿自己 Typeless 的历史录音评估提示词
SPEAKMORE_MODE=local scripts/dev/with-key.sh deepseek node scripts/dev/eval-prompt.mjs --label v1 --polish-prompt=候选.txt   # 评估润色的提示词：本机转写一次、存下原文，之后只调润色
scripts/dev/with-key.sh bailian scripts/dev/with-key.sh deepseek node scripts/dev/smoke-models.mjs --platform bailian --recording 一段录音.webm   # 跑通一个平台的每个模型：原生单独跑，转写后面固定 DeepSeek，润色前面固定本机 Qwen3 Q8
scripts/dev/with-key.sh gemini node src/server/main.mjs           # 单独启动听写服务，配合 SPEAKMORE_SERVER_URL 调试
node scripts/dev/replay.mjs 块1.ogg 块2.ogg                         # 把现成的录音发给单独启动的服务
```

加一家模型：在 `src/server/providers/` 下写一个适配器（请求怎么拼、收哪些录音格式、报错怎么认），在同目录的 `index.mjs` 里登记一行。交给模型的流程（重试、转格式、记账）各家共用，在 `src/server/refine/`。

加一件让模型做的事（任务，比如语音翻译）：在 `src/server/tasks/` 下新建它的目录，放它自己的提示词和成品怎么收，在 `index.mjs` 的 `TASKS` 里登记一行，再在动作目录（`src/hotkeys/actions.mjs`）加对应的动作。任务说自己能在哪几步上做（直出、整理、只转文字），识别方式按这个判断做不做得了，流水线和服务端都不认任务的名字。任务之间不互相引用。

加一个本地转写模型：
1. 在 `src/models/catalog.mjs` 加一项：原始地址钉在某一次提交上，每个文件写上大小和 sha256，注明许可（原文地址）和原作者的仓库。它用的运行库要在 `src/server/asr/engines/` 登记过。
2. 在 `bench/lib/candidates.mjs` 加一个候选，跑一轮评测（[说明](../bench/README.md)），把实测数字和标签填回配置表的 `measured`、`tags`。标签按实测打，`test/models/` 会查"标了适合哪类芯片，就要有在那类芯片上的实测"。
3. 传到国内源（魔搭 ModelScope 上配置表 `MODELSCOPE_OWNER` 名下的仓库，一个模型一个，仓库名就是模型 id）：`scripts/release/with-modelscope-key.sh npm run sync-models -- --from <本机模型仓> --download`。它逐个核对 sha256，带上 README.md（模型卡）、LICENSE 和 NOTICE 传上去，从魔搭上逐个核对大小和 sha256、照下载地址真取一次，最后报出每个模型该钉的提交，填进配置表那一项的 `mirror.revision`（地址钉在提交上，内容永远不变）。`npm run sync-models -- --check` 不用令牌，只核对配置表钉的提交都下得到、都对。
   - 传文件用魔搭的 Python SDK：`scripts/release/modelscope-sdk.sh` 第一次跑时用 uv 装进 `.tools/modelscope/venv`，版本钉在 `scripts/release/modelscope-requirements.txt`；登录态和缓存也放在那里，不写 `~/.modelscope`。令牌在魔搭的账号设置 › 访问令牌里拿，放进按需加载器，凭据名写进 `.machine.env` 的 `MODELSCOPE_CREDENTIAL`。

加一种界面语言：照着 `src/i18n/locales/en.mjs` 写一个文件，在 `src/i18n/index.mjs` 的 `LOCALES` 里登记一行（并列几样时不想用 `Intl` 的写法，比如中文全用顿号，登记时给 `separator`）。缺了哪句、参数对不上、单复数写法这种语言没有，`test/i18n/` 会指出来；设置、菜单栏、窗口、命令行都从这份清单里取，不用再改别处。只管界面：提示词和整理出来的文字不跟着变。繁体（`zh-TW`）不手写，由 `scripts/dev/make-zh-tw.mjs` 从简体转出来（opencc 的台湾用语，再修几处它转错的）：改了简体文案就运行 `npm run i18n:zh-tw`，忘了的话 `test/i18n/` 会指出来。

加一个能按快捷键做的动作：在 `src/hotkeys/actions.mjs` 加一行（两个系统都要有默认组合），文案加 `actions.<动作>.name`，中英各一份，再写它自己的处理代码。设置项 `hotkey.<动作>`、环境变量 `SPEAKMORE_HOTKEY_<动作>`、命令行、设置页的那一行、状态、下发给小帮手的绑定表都按这张表生成，不用另改（首次引导只演示、检查三个主功能，列在 `src/renderer/onboarding/flow.mjs`，新动作要进引导再加到那里）；漏了哪一处，`test/hotkeys/` 里按目录逐个动作查的测试会红。默认组合和已有的撞了的话，用户自己绑的优先，新动作这个组合不装、提示一句。

加一个推荐组合（引擎页标题行右边那个下拉）：在 `src/models/presets.mjs` 加一项（方式、带的设置、适合哪类芯片，排在哪按推荐的先后），文案加 `presets.items.<id>` 的名字和说明，中英各一份；删一个就删这两处。月成本不手写，按"每天 100 次、一个月 30 天"和一次典型口述的用量（`src/usage/estimate.mjs` 的 `TYPICAL`）现算，价目改了跟着变。用到还没量过用量的那一家时，`test/models/presets.test.mjs` 会说算不出月成本：用 `scripts/dev/measure-dictation.mjs` 在评测语料上量一下，把平均数填进 `TYPICAL`。那个测试还查引用的模型在不在清单里、设置属不属于那种方式、文案齐不齐。

词典（`src/vocabulary/`）：用户的词存在 `~/.speakmore/vocabulary.json`，每次听写开头读一次，交给识别的每一跳（原生、云端转写、本机转写、润色）。一个模型怎么收词分三层，各管一块：
1. **收不收、收多少**写在模型清单里，是数据：本机模型在 `src/models/catalog.mjs`，云端转写在 `src/server/asr/cloud/vendors.mjs`，每项一个 `vocabulary: vocabularySupport(做法, 上限)`。做法只有三种：`prompt`（写进提示词）、`context`（上下文）、`hotwords`（热词）。读提示词的原生识别和润色统一用 `PROMPT_VOCABULARY`。
2. **词多了挑哪些**各家共用（`fitTerms`）：按词典的先后挑，放不下的跳过、接着挑后面的。
3. **怎么放进请求**由各家适配器自己管，按做法查自己的表：语音输入的提示词在 `src/server/tasks/dictate/prompt.mjs`、`polish-prompt.mjs`，百炼在 `bailian.mjs` 的 `VOCABULARY`，智谱在 `zhipu.mjs`，本机运行库在各引擎的 `FAMILIES`。

给一个模型加上词典：在清单里写上做法和上限（上限照实测定，测法写进注释），它的适配器里已有这种做法的放法就完了，没有就在适配器的表里加一条。`test/models/catalog.test.mjs` 会查本机模型声明的做法引擎都放得进去。改讲词典的那段写法前，先用 `scripts/dev/eval-vocabulary.mjs` 在真实录音上比一比带不带词典；要逐轮试写法，用 `scripts/dev/climb-vocabulary.mjs`，做法和上一次的结果见 [bench/results/vocabulary-hillclimb-2026-10-19.md](../bench/results/vocabulary-hillclimb-2026-10-19.md)。

不发布也可以试安装脚本：`SPEAKMORE_INSTALL_BASE=$PWD/dist/release SPEAKMORE_HOME=/tmp/sm bash install.sh`，装进一个临时目录。

| 目录 | 内容 |
| --- | --- |
| `install.sh`、`install.ps1` | 安装脚本（macOS、Windows）：预检查、下载、校验、装进家目录（默认 `~/.speakmore`，Windows 是 `%USERPROFILE%\.speakmore`；第一次安装在终端里时先问装在哪）、启动。设了 `SPEAKMORE_INSTALL_FROM`（一棵准备好的程序树：`speakmore update` 拼好的、Windows 安装程序解出来的）就不下载，直接装它。输出只有英文，不跟界面语言 |
| `bin/`、`src/cli/` | `speakmore` 命令 |
| `src/app/` | 后台应用的主进程（Electron）：悬浮条、菜单栏、主窗口、首次引导；`keys/` 是 key 的保存和启用 |
| `src/renderer/`、`src/preload/` | 各个窗口的页面，一个窗口一个目录：`bar/`（悬浮条：状态机、录音、听写协议的客户端、画面）、`hub/`（主窗口：首页、历史记录、设置对话框）、`onboarding/`（首次引导：功能演示、检查快捷键、开权限，最后去引擎页；步骤在 `flow.mjs`，认按键在 `key-check.mjs`，演示在 `scene.mjs` 和 `demo/`），共用的样式、拼节点的小工具在 `shared/` |
| `src/themes/` | 主题：界面要哪些颜色（一组 token）、每套主题给的值、合不合格怎么查。加一套主题是加一个文件、登记一行（名字和介绍写进各语言的文案） |
| `src/i18n/` | 界面语言：每种语言一个文案文件（`locales/`），跟随系统时怎么挑、翻译函数。内核和主进程不写死哪种语言的话，交出一句"还没定语言的话"（名字加参数），由显示它的那一端（窗口、命令行）按自己的语言翻。回给命令行的，后台按命令行带来的语言翻成字：旧版本的命令行和 `status --json` 的读者只认字 |
| `src/server/` | 听写服务：`protocol/` 收分块音频，`refine/` 交给模型（各家共用的流程，每次调用记一笔账），`tasks/` 让模型做什么（每个任务一个目录：提示词、成品怎么收），`providers/` 每家模型一个适配器（`prices/` 是各家的价目表），`audio/` 把录音解成识别用的统一格式（16 kHz 单声道）、转成别家收的格式，`asr/` 是本地转写（每个运行库一个适配器、长录音分段、装着模型的转写进程），`modes.mjs` 是三种识别方式。平时跑在后台应用的进程里 |
| `src/models/` | 本地模型的配置表 `catalog.mjs`：全局只有这一份，下载源（国内源、原始地址）、每个模型的文件和校验值、许可、标签和实测数字都在这里，别处不另写；`store.mjs` 下载、校验、列出、删除模型；`describe.mjs` 把标签和实测写成话；`presets.mjs` 是引擎页的推荐组合 |
| `src/usage/` | 用量报表（今天、本月、累计、按型号）、首页的统计（字数、语速、连续天数、热力图）和数字的写法，命令和主窗口共用；`estimate.mjs` 估推荐组合的月成本 |
| `native/` | 按绑定表匹配热键、录键、贴字、说话时截住取消键和悬浮条上点击的小程序：`mac/` 是 Swift（纯逻辑和入口分开，`tests/` 直接用 `swiftc` 编出来跑），`windows/` 是 Go（只用标准库，在 Mac 上交叉编译）；`fixtures/hotkeys/` 是两边共用的按键轨迹样例 |
| `src/hotkeys/` | 快捷键：动作目录 `actions.mjs`（有哪些动作、默认组合，别处都按它生成）、键表、组合的写法、哪些组合不让绑、录键的定稿规则、下发前的校验 |
| `assets/` | 图标：`icon.svg` 是那方印，`tray.svg` 是菜单栏上的五道；`.icns`、Windows 用的 `icon.ico` 和 `trayTemplate*.png` 由 `scripts/build/make-icon.sh` 从它们生成 |
| `src/storage/` | 家目录里的东西：放在哪（`paths.mjs`、定位文件 `location.mjs`）、设置、历史库、词典、旧数据的迁移。命令和后台应用共用 |
| `src/move/` | 搬家：检查新位置（`target.mjs`）、试盘（`probe.mjs`）、只拷我们的（`copy.mjs`）、交给安装脚本换家（`installer.mjs`）、整个流程和断在半路的收拾（`index.mjs`）。命令行 `speakmore move` 和 App 的"存储位置"只调这里 |
| `src/vocabulary/` | 词典：词怎么规整、导入怎么解析，各模型收词的三种做法和挑词（`fitTerms`） |
| `src/update/` | 版本检查和更新，命令行（`speakmore status`、`update`）和 App（设置 › 通用 › 软件更新）只调这里，壳里不写更新的逻辑。查新版本一天最多问一次下载地址，记在 `run/update-check.json`，两边共用；更新进行到哪、失败原因记在 `run/update.json`，`run/update.lock` 不让两边同时换。更新把本机装着的每一份都换成最新：家目录里的那一份（`home.mjs`，拼好后交给新版本自带的安装脚本装），Mac 上还有 SpeakMore.app（`bundle.mjs`，拼在旁边，核对签名和开发者后对调）。拼（`assemble.mjs`）只下本机缺的块，下到的块放在 `run/update-cache`，换成了才删。下载和核对都在停掉正在运行的那个之前做完，停着的只有换程序那几秒；换完只重新打开原来在运行的那个。App 点了更新另起一个进程（`background.mjs`，借 App 自己的 Electron 当 Node 跑）：它要让 App 退出、换掉、再打开。下载地址上的摆法在 `layout.mjs`，打包和更新共用 |
| `src/control.mjs`、`src/instance.mjs`、`src/log.mjs` | 命令和后台应用之间的控制通道；问正在运行的那个的状态、请它退出（命令行和更新共用）；日志 |
| `test/` | 自动测试，目录和 `src/` 对应 |
| `.github/workflows/` | CI：`ci.yml` 在 PR、推 main 时跑检查（Mac 上，和 `npm run ship` 发版前跑的同一套）；`release.yml` 推版本标签时检查过了建 GitHub 上的 Release |
| `scripts/` | 开发用的脚本，按用途分五组：`build/` 编译小程序、打 .app；`release/` 发新版本（`ship.sh`：把关、打包、上传、核对、公开 GitHub 上的 Release）、把本地模型传到国内源（`sync-models.mjs`）；`dev/` 端到端、评估提示词、回放录音、按本机配置加载 key、在 Windows 开发机上跑（`win-*.sh`，见上面的 Windows 一节）；`checks/` 核对 GitHub 账号、检查本机信息有没有漏进仓库（配置样板是 `.machine.env.example`）；`ops/` 看下载量和余额（`stats.mjs`）、下载地址按小时封顶（`cdn-cap.mjs`） |
| `bench/` | 评测（[说明](../bench/README.md)）：本地转写这一跳（洗样本、跑参照和各个本地模型、判分、出报告），词典的判法（`lib/vocabulary.mjs`），各轮的记录在 `results/` |
| `docs/` | [实现笔记](implementation-notes.md)、这份开发说明、README 的图在图片桶上的清单（`media.json`，见下面的"README 的图"） |
| `website/` | 官网（[说明](../website/README.md)）：React + Tailwind CSS v4 的单页静态站，中英双语，Docker 部署；截图从 App 的真页面离屏截、放在单独的 COS 桶 |
| `targets/typeless/` | 对 Typeless 的[逆向分析](../targets/typeless/README.md)，18 篇文档。SpeakMore 是照着它做的 |
| `AGENTS.md`、`.memory/` | 和 AI 编程助手协作时用的工作约定和项目记忆 |
| `.claude/`、`.mcp.json` | 逆向用的工具 [REA](https://github.com/morluto/rea) 的项目级配置。`.claude/skills/` 下是 REA 自带的说明文件，版权归它的作者，MIT 许可 |

## 打成 .app

安装包里的应用就是这样打出来的。改了代码想自己装一个：

```bash
npm run install-app     # 打包并装进“应用程序”，然后打开
```

本机配了签名证书和公证档案时（`.machine.env` 里的 `MAC_SIGNING_IDENTITY`、`MAC_NOTARY_PROFILE`，怎么配见 `.machine.env.example`），打出来的应用用 Developer ID 签名、开 hardened runtime，交给苹果公证并钉上票据，连公证一共五六分钟。系统按应用标识（`com.zephyrxiang.speakmore`）和证书的团队认它，重新打包不再被当成新应用；拷到别的 Mac 上也能直接打开。没配就是不带身份的本机签名：每次重新打包系统都把它当成一个新应用，权限要重新给，key 要重新填。

它不在 `~/.speakmore` 里，`speakmore uninstall` 不会删它。

.app 在运行时，`speakmore status`、`history`、`key`、`stop` 照常能用。`speakmore restart` 和 `config set` 不会代它重启：从命令行起来的是终端启动的那一个，权限和 key 是另一套。按提示从菜单栏退出，再打开一次。

## Windows

Windows 版和 Mac 版是同一份代码，差别关在几处：听热键、贴字的小帮手是 `native/windows/`（Go，只用标准库，协议和 Swift 那个一字不差）；控制通道是 named pipe；家目录的权限用访问控制表只给本人和 SYSTEM；key 用 DPAPI 加密（Electron 的 safeStorage）；系统朗读用 System.Speech；安装、升级、卸载是 `install.ps1` 和 `src/windows-system.mjs`。文案里按系统说的话写在各语言文案的 `windows` 一节，名字照抄通用的那句（`test/i18n/` 会查盖的那句存在、参数一样）。

装好的样子和 Mac 一样全在 `%USERPROFILE%\.speakmore` 里，只是程序按版本放：`versions\<版本>-<编号>\` 里是 `app\` 和 `runtime\`（原版 Electron），`current` 一行字记着现在用哪个，`bin\speakmore.cmd` 照它找程序；数据、日志、模型和 Mac 一样。装新版本是解进一个新目录、试过能跑再改 `current`，不挪、不覆盖任何已有的文件，换下来的旧版本没人用了再删（0.9.2 及以前直接放在 `app\`、`runtime\`，升级时一并删掉），现在删不掉的交给一个隐藏的 PowerShell 隔几秒再试。同一个家目录同时只装一个（按家目录取名的系统互斥量）。0.9.3 以前的版本不认这种放法，install.ps1 不装它们。家目录以外只动两处、都记在 `bin\links`：用户 Path 里的 `%USERPROFILE%\.speakmore\bin`，开始菜单的 SpeakMore 快捷方式；App 设置里开了开机启动的话还有注册表 Run 里的一条。`speakmore uninstall` 照着删。升级时开机启动那一条、用户固定到任务栏或发送到桌面的快捷方式副本，凡是指着这个家目录里旧版本的，都改指到新版本。

**在 Mac 上开发、在 Windows 上验**：Windows 开发机经 SSH 操作，连哪台、用哪把钥匙写在 `.machine.env` 的 `WIN_SSH_TARGET`、`WIN_SSH_KEY`。开发机上的东西全在 `%USERPROFILE%\speakmore-dev` 里，不用了整个删掉，再删掉计划任务 `speakmore-dev*`。

```bash
scripts/dev/win.sh 'Get-Date'                 # 在开发机上跑一段 PowerShell（编成 -EncodedCommand，输出按 UTF-8 拿回来）
scripts/dev/win-sync.sh                       # 把工作区同步到 speakmore-dev\repo（node_modules、build、bench\_work 留着）
scripts/dev/win-test.sh [测试文件…]            # 同步后在开发机上跑单测，日志拉回本机，按文件列出失败的
scripts/dev/win-desktop.sh '<PowerShell>'     # 在桌面会话里跑（热键、剪贴板、麦克风、窗口只有这里碰得到）；JOB=名字 另起一个任务并行跑
scripts/dev/win-app.sh [stop]                 # 从源码起 App（家目录 speakmore-dev\home，调试端口 9333），或者停掉
scripts/dev/win-screenshot.sh 截图.png         # 截开发机的整个主屏
node scripts/build/build-native.mjs --windows # 交叉编译小帮手 build/key-helper.exe；Go 由 scripts/build/go.sh 钉版本、核对校验值后装进 .tools/
node scripts/release/release.mjs windows      # 只打 Windows 的（更新清单、zip 和 Setup.exe），连同 install.ps1 摆进 dist/release
```

不发布也可以在开发机上试安装：把 `dist/release` 传过去，`$env:SPEAKMORE_INSTALL_BASE = '<那个目录>'` 后照 README 那一行跑（`SPEAKMORE_NO_START=1` 只装不启动，`SPEAKMORE_VERSION` 指定版本）。小帮手的真机检查是 `native/windows/e2e.ps1`，要在桌面会话里跑：`WAIT=150 scripts/dev/win-desktop.sh - < native/windows/e2e.ps1`。它用 SendInput 按扫描码合成按键，没被吞掉的会落到前台窗口，跑之前确认那台电脑没人在用。

真机上踩过的坑，改相关代码前先看一眼：

- **Windows PowerShell 5.1**：没有 BOM 的 `.ps1` 按系统编码（中文系统是 GBK）读，所以下载来的脚本要按 UTF-8 读进来再当脚本块跑；`Add-Content -Encoding UTF8` 写的文件开头带 BOM、按 CRLF 换行，读的那一边要去掉 BOM、按 `\r?\n` 切（`bin\links` 就因为这个没删干净过）；`$ErrorActionPreference = 'Stop'` 时外部程序往标准错误写一行就会被当成异常，调外部程序前要放宽；输出被重定向时 `Write-Host` 会变成一大段 CLIXML。
- **`powershell -Command` 的退出码看最后一条命令**：最后一条是 `-ErrorAction SilentlyContinue` 的"没找到"时退出码是 1。`windows-system.mjs` 的几段统一出错就停、正常跑完明确 `exit 0`。
- **Node 起的子进程**：直接起的会被放进 libuv 的"父进程退出就全部结束"的作业对象，父进程一退出它就没了；加 `detached` 能躲开，可那样起的 PowerShell 没有控制台，一行都不跑就以 0 退出。要活过父进程就隔一层：同步跑一个 PowerShell，由它 `Start-Process` 干活的那个（孙进程不在那个作业对象里）。
- **刚落地的文件挪不动、删不掉**：杀毒软件（还有索引、备份这类）会扫刚写出来、刚跑过的文件，扫的时候开着它又不许别人改名或删除，这时改名报"另一个进程正在使用此文件"（issue #5：0.9.2 的 install.ps1 解到临时目录再挪进 `app\`，在开着实时防护的机器上装不上；占住一个刚解出来的文件就能原样复现）。开发机的 Defender 实时防护是关着的，在它上面试不出来。所以安装不挪新文件：解进 `versions` 下的新目录，切换只改 `current`；下载的包也只放在内存里，不留要删的临时文件。下载不用 `Invoke-WebRequest`：5.1 会把整个响应再拷成字节数组、再转成好几份字符串，约 200 MB 的包要占一两 GB 内存。
- **跑着的 Electron（哪怕只当 Node 用）一直占着自己所在的目录**：目录改不了名，里面的文件和子目录却挪得动；正在跑的 exe 删不掉，但能挪走。按版本放之后升级不碰正在跑的那个版本的目录，它退出后再删（install.ps1 看哪些进程的程序在那个目录里，交给一个隐藏的 PowerShell 等它们退出）。普通的 exe 不占目录，拿它试会试错。
- **正在跑的批处理文件被改写**：cmd 等它调的程序退出后，从原来读到的那个字节位置接着读这个文件。所以 `bin\speakmore.cmd` 内容不随版本变；从 0.9.2 升上来那一次要改写（那时它可能正在跑 `speakmore update`），新内容不比旧的长，cmd 接着读到的就是文件末尾。以后再改它，也不能比发出去过的任何一版长（现在最短的是 0.9.3 的 303 字节；`test/install/install-ps1.test.mjs` 查长度，在 Windows 上真跑一遍）。
- **`bin\speakmore.cmd` 正在跑命令时不能删**：cmd 等 Electron 退出后还要回头读这个批处理文件，删了会报"找不到批处理文件"、退出码变成 1；同一行接 `exit /b` 也躲不开，`(goto)` 能压住报错但退出码丢了。卸载时 bin 留到退出后再删。
- **固定到任务栏、发送到桌面的是快捷方式的副本**：任务栏的在 `%APPDATA%\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar`，记着当时的目标。按版本放之后程序的路径每个版本都变，旧版本删掉后这些副本就打不开了，所以升级时一并改指（Squirrel 那一类安装程序也这么做）。按程序路径记的东西（比如系统图形设置里给某个 exe 指定显卡、显卡驱动按程序缓存的着色器）每个版本要重来一次。
- **快捷方式（.lnk）里的目标路径不是连续的一段**：本地编码那份拆成几截，UTF-16 那份是相对路径。认是不是我们的，要请 WScript.Shell 读出目标。
- **从 SSH 起的程序进不了桌面**，断开就被收掉：要碰热键、剪贴板、麦克风、窗口的，用计划任务（只在用户登录时、以交互方式运行）在桌面会话里起，`win-desktop.sh` 就是这么做的。同一个任务正跑着时再起会被忽略，长任务用 `JOB=` 另起一个。PowerShell 里直接 `& electron.exe` 不等它跑完（它是窗口程序），要等就经 `cmd /c` 或者把输出接住。
- **显卡**：本机模型在显卡上（Vulkan）第一次转写要先编显卡程序，RTX 4060 Ti 上 6.8 秒，之后驱动按可执行文件缓存在磁盘上；所以装上模型就先预热一遍。显卡上没装起来（报错或者驱动把转写进程弄崩）会自动换 CPU 再装，设置里也能选只用 CPU（`acceleration`）。

## README 的图

README 里的图不进仓库，和官网的截图放在同一个 COS 图片桶里（官网、宣传片也用），在 `readme/` 下；传上去的记在 `docs/media.json`，测试会查 README 引用的都在这份清单里、中文版只用中文的图。

1. 截图：在 `website/` 下 `../scripts/dev/with-key.sh gemini ../scripts/dev/with-key.sh deepseek ../scripts/dev/with-key.sh bailian node scripts/readme-shots.mjs <截图目录>`。它用 `/tmp` 下的临时家目录（靛青主题、默认热键、造好的历史和词典）中英文各起两次 App：一次不带 key，从首次引导一步步点下去；一次带 key（引擎页才显示成配好、检查过的样子），截主窗口各页和设置。存成两倍图的 PNG，文件名 `<en|zh>-<序号>-<名字>.png`（01–09 是首次引导，`settings-` 开头的是设置对话框）；同时记下官网要的局部怎么裁（`photos.json`，边上会露半截东西的先藏起来另拍到 `crops/` 下）。App 的日志也写在这个目录里，截不对时看它。
2. 加窗口外框、画下载速度对比和厂商标志墙：`../node_modules/.bin/electron scripts/readme-media.mjs -- <截图目录> <输出目录>`。
3. 功能配图和官网的局部：`../node_modules/.bin/electron scripts/readme-scenes.mjs -- <photos.json> <输出目录>`。语音输入、语音翻译两张是代码画的场景；局部按 `photos.json` 裁、加圆角和阴影（引导各步 `setup-*`、引擎页 `polish-crop`/`polish-card`，窄屏用的带 `-sm` 或 `-card`）。划词那几张是在 Mac 上截的全屏实拍，不在仓库里：要重做就重截，把它们的裁法写进另一份 `photos.json`、合在一起跑；2026-11 卡片改版时没重截，是把新版卡片页离屏画出来、贴回原来的实拍上的。
4. 上传（第 2、3 步的输出目录各传一次）：`../scripts/release/with-cos-key.sh node scripts/upload-media.mjs <输出目录> --prefix readme --manifest ../docs/media.json`。对象名带内容指纹，图变了地址就变，README 里的地址照新的清单换。推上 GitHub 后把页面上每张图（经 camo 代理）取一遍，字节数和桶上的那张比：代理第一次从桶上取图偶尔拿到空的或者只拿到一半（0.17.0 时词典页那张只缓存了 66 KB 里的 24 KB），还会缓存一年，光看"不是空的"查不出来。对不上的就在那张图的地址后面加 `?v=2` 之类的查询串让它重取。

## 下载量与流量

`scripts/release/with-cos-key.sh npm run stats` 一次出齐（只读，不改云上任何配置）：

- **下载量**：从下载地址的 CDN 访问日志算，按"传出去的字节 ÷ 包的大小"折算成完整下载次数，分段下载、下到一半断掉、安全软件预扫都不会把数撑大。同一个 IP 同一种包一天最多算一次（不分版本）：多线程下载器会分段重复拉同一个包，不封顶会被算成十几次；代价是公司、学校这类多人共用出口的，同一天同一种包只算一次。自测的下载会被扣掉，单独列出来；另外报按天、按包的数字，真实来源 IP 有多少，有多少次是在手机上点的，以及真用户拿到的 404。更新按块下（`store/`），只按字节加起来、报来自几个 IP，不折算次数。0.10.1 及以前更新也是整包下 `tar.gz` 和 `zip`，那时的"终端安装"里含着更新。
- **流量**：两个 CDN 域名（发布包、图片）最近 14 天每天的境内和境外流量、请求数、4xx、5xx、回源流量、回源失败，以及用量封顶的配置。还会报两个 COS 桶的文件数和存储量。GB 和腾讯云控制台一样按 1024 算。本机模型从魔搭下，不经过这里（老的 COS 国内源 2026-10-20 已撤掉）。
- **告警**：
  - 封顶按天时，今天的流量到了每天封顶的七成会提醒，到顶会告警（封顶按境内、境外分别算，到顶后返回 404）。下载地址现在是按小时封顶（`scripts/ops/cdn-cap.mjs`：每小时 4 GB，到下一个小时自动恢复），按天的流量对照不了，只报最近触发过没有。
  - 没开封顶会提醒，最近触发过封顶会告警。
  - 出现 5xx 会提醒；回源失败平时也有零星几次，某天至少失败 10 次、失败率到 5% 才提醒。
  - 同一个不存在的文件有两个以上真用户点到，而且昨天以来还有人点到，会提醒，多半是哪里的链接写坏了。报告里会列出它最近一次被点到的时间，改好之后看这个时间不再往后走就行。

选项：`-- --days 30` 流量看更多天（最多 90）；`-- --offline` 不连云，只拿缓存重算下载量，不用密钥；`-- --json` 输出 JSON。

自测靠下面四条特征认出来源 IP，命中的 IP 在整段时间里都算自测（算法和单测在 `scripts/ops/stats-core.mjs`）：

| 特征 | 来自哪 |
|---|---|
| curl 在两分钟内拉了至少 4 个不同的 `.sha256` | ship 收尾时从下载地址逐个核对校验值 |
| 请求了预发版（版本号带 `-`） | 发正式版前试链路 |
| 不带 UA 拉 `SpeakMore-Setup-x64.exe.sha256` | Windows 开发机上的验收脚本用 WebClient 核对校验值 |
| 这台电脑的出口 IP | 每次跑都记一次（只存哈希） |

往后加了新的自测方式，比如换一种验收脚本，先看它在日志里留下什么痕迹，在 `findSelf` 里补一条特征和测试。不然它的下载会被当成真用户。正式版本号哪怕没发过，也不算自测特征：README 指错版本时真用户拿到的 404 要报出来。

缓存在 `.stats/`，不进仓库：日志里有真实用户的 IP，自己的出口只存哈希。CDN 的访问日志只留 30 天，缓存一直在，所以一个月内跑一次，下载量就能一直往前算。日志按小时出包，大约晚一两个小时才有，所以最近一两个小时的下载还没进来；流量统计晚几分钟。

## 验证到哪一步

- 自动测试 818 条（单测 799 条、安装脚本 19 条），在 Node 26.0 上全过；Node 24.21（Electron 自带的版本，程序就跑在它上面）上全过的是更早的 754 条单测（之后加的没在 24 上重跑）；Node 22.13 上跑过的是更早的 269 条（之后加的没在 22 上重跑）。其中 19 条是安装脚本的，17 条拿假的发布包真的跑安装脚本：全新安装、升级、指定版本、各项预检查不过、校验不过、停不掉、路径里有空格和引号。
- 用真的发布包走过一遍，装在临时目录里，`PATH` 里没有 Node：
  - 安装脚本从管道读入，装完直接启动并问 key，输入不显示。
  - 启动、状态、设置、重启、停止；合成的语音经过录音编码、Gemini、存历史，成品正确。
  - 再装一次（升级），历史还在。
  - `speakmore uninstall` 之后目录、命令链接、后台进程、钥匙串里的那一条都没了。
- Intel 的那一份只在 Apple 芯片的机器上借 Rosetta 跑过（命令、后台、小程序都起得来），**没有在真的 Intel 机器上试过**。
- 上一版在真机上走过的那些路（多行 key 被拒、后台卡住时强行结束、同时启动、模型名写错）这一版重跑了自动测试，没有逐条重走。
- 照上面那一行从真的下载地址装过一遍（0.2.0，装进临时目录，`PATH` 里没有 Node）：下载、校验、安装、`--version`、卸载都正常。
- 0.3.0 发布后同样从真的下载地址装进临时目录核对过（这次 `PATH` 里有 Node，只装不启动）：`--version` 是 0.3.0，`speakmore theme` 列得出三套主题，卸载删干净了。第一次下载中途断了（`curl` 报 HTTP/2 的流没有正常关闭），安装脚本报"下载中断了"、原来的东西没动，再运行一次就装好了。
- 0.4.0 是从本机发的：当时推标签由 GitHub 的机器发布，检查和打包都过了，往 COS 传了 32 分钟，第一个包还没传完，COS 回 "User network is too slow"，什么都没传上去。同一个提交在本机打包、传两个包用了 2 分 15 秒。之后发布改成只从本机发（`npm run ship`），GitHub 上的发布流程删掉了。发布后从真的下载地址装进临时目录核对过（只装不启动）：`--version` 是 0.4.0，图标在包里，音频解码只剩 `decode-webm`、没有 `codec-parser`，卸载删干净了。
- 主题和新的悬浮条（下面这些是从源码跑的；发布包里的只核对了上一条那几项，没有启动过）：
  - 画面：用真的页面和样式离屏截图看过，三套主题下悬浮条的七种样子（浅色、深色背景各一张）、两个窗口（跟随系统的浅色深色各一张）；报给小帮手的按钮位置和页面上画出来的位置差在 1 个像素以内。
  - 截住 `esc` 和点击：给真的小帮手发合成的按键和鼠标事件，下游另挂一个监听看有没有漏。`esc` 和落在划定区域里的点击都被吞掉并报上来，长按 `esc` 时松开的那一下也吞掉，不截的时候监听是关着的。15 项全过。
  - 真的后台应用连着真的小帮手和麦克风走过一遍：换主题当场生效；合成一次热键开始说话，合成 `esc` 取消。说话时和取消后最前面的应用都没变，`esc` 没有漏给它，取消的那次没有进历史。
  - 合成的语音经过新的悬浮条、录音编码、Gemini、存历史，成品正确。
  - 按着真键盘、对着真麦克风、用真鼠标试过一轮：说了三段都贴进了输入框，点 ✓ 完成、点 ✕ 取消各一次都截到了，日志里没有警告和错误。声波的高度是照这三段录音的音量标定的（原来的算法下竖条大多只有两三成高）。
  - 声波后来改成和原版一样原地跳：原来是一排向左流的音量，嫌没有动感；现在每个字从正中间激起一道波传到两边，中间高、两边低，每帧都在抖。拿一段真实录音的 5 秒在真的页面里放过：没有报错，说话时中间那根平均 0.64、最边上 0.22，几乎每帧都在变，只有 2% 的帧顶到满格。**还没有对着真麦克风看过**。
  - 真键盘按 `esc` 取消也试过：截到了，这一次没有进历史，取消之后监听是关着的。
- 换模型（从源码跑的，发布包里还没试过）：
  - 合成的语音经过悬浮条、录音编码、模型、存历史，Gemini 和 OpenAI 各走通一遍；OpenAI 那一遍录音在本机从 WebM 转成 WAV 用了 56 毫秒。
  - 在临时目录里用真的后台和真的 key 走过一遍命令：列模型、查 Gemini、查没有 key 的 OpenAI、从管道给 OpenAI 存 key、查两个 OpenAI 模型（一个能用、一个不存在）、换到 OpenAI 并重启、看状态、没有 Gemini 的 key 时换回去被拦下、删 key。
  - 设置窗口里 key 那一块的说法，用真页面离屏截图核对过两家。
  - 换成策略之后，Gemini 拿同一批 60 条真实录音回归过，和之前两次的数字在同一个波动范围里（见[实现笔记](implementation-notes.md#不止一家模型)）。
- 图标（从源码跑的）：
  - 菜单栏图标在真的 Electron 里读得出来，16 和 32 两种尺寸都在，系统认作随菜单栏深浅反色的那种。在临时目录里起了一个真的后台，菜单栏上它那一项没有文字、宽 34 点（写着"听写"的旧样子是 48 点）；没有截屏亲眼看，因为终端没有录屏权限。
  - 设置和历史窗口顶部的图标和产品名，用真页面离屏截图看过浅色深色。
  - 按发布包的清单实际摆过一遍，`assets/` 在里面。
- 记账（从源码跑的，发布包里还没试过）：
  - 两家的价格照官方价目页抄，用量字段对着真的回话写：拿真的 key 各发过一次听写请求、看过回话里的用量；Gemini 开 HIGH 思考再发一次，确认思考的 token 单独报、不在输出里。
  - 合成的语音经过悬浮条、录音编码、模型、存历史、记账，Gemini 和 OpenAI 各走通一遍：账对上了那条历史，花费和照价目表手算的一致（见[实现笔记](implementation-notes.md#记账花了多少钱多少-token等了多久)）。
  - 历史窗口的用量表和每条的花费，用真页面和造的数据离屏截图看过浅色、深色和最窄的宽度。
  - 旧的历史库（版本 1）升上来、原来的记录都在，只在自动测试里试过；真用着的那个库还没升过。
  - 提示词缓存（Gemini）：合成的语音端到端走过一遍，开口时建好缓存，整理时命中 1350 个 token，这一句从 $0.0012 降到 $0.00028，成品一样；拿真的 key 连着走两轮"开口、整理"，第二次开口只续期、两次整理都命中。缓存半路没了、型号建不了、建的时候没网这几种只在自动测试里（假的 SDK）试过。
- 第一次用时选哪家、设置窗口里换一家（从源码跑的，临时目录、右 Control 当热键）：
  - 在伪终端里跑第一次启动：选 2（OpenAI）、粘贴 key，启动后用的是 OpenAI，设置文件里记着它，key 没有出现在屏幕上；选的时候按 Ctrl-C，key 也不问了，照默认的 Gemini 启动，面板里说还差 key。
  - 用调试协议驱动真的设置窗口：两家都有 key 时点"改用 OpenAI"，命令行看到的、设置文件里的都换成了 OpenAI，接着发一段录音给内置服务，先转成 WAV 再交给 OpenAI，4 秒回来；换回 Gemini；删掉 OpenAI 的 key 后粘贴一把错的，说 key 无效、还是 Gemini；粘贴对的，存好并换过去。重启后台后用的仍是 OpenAI。
  - 安装脚本的预检查真跑过一次（本机打的包、临时目录、只装不启动）：两家都打了勾。两家连不上时的样子只在自动测试里（假的 curl）看过。
- 签名、公证和安装包（Apple 芯片）：
  - `npm run dist` 打出来的应用 Developer ID 签名、hardened runtime、安全时间戳都在，主程序和小帮手只有 JIT、麦克风两项权限；苹果公证 Accepted、没有问题项，票据钉上了，`spctl` 判定 Notarized Developer ID。
  - 装进"应用程序"真用过一轮（新的观感和文案改之前打的那一版）：日志里看得到第一次打开缺 key 和输入监控、自己打开首次引导；给了权限、填了 key 并验证通过；测快捷键那一步收到了真按键；说一句那一步录了 3 块、整理出 24 个字贴了出去；走完引导，换了两次主题。
  - `npm run release -- arm64` 打出的安装包 155 MB，本身也签了名、过了公证、钉了票据，`.sha256` 对得上。给它打上浏览器下载的来源标记，`spctl` 照样放行；挂载后里面是应用和"应用程序"的替身。
  - 把安装包里的应用装进"应用程序"、换掉上面那一版：打开后三项权限都在，存着的 key 读得出来、验证通过，不用重给。
  - 0.5.0 发布后从真的下载地址取回两个安装包：校验值都对得上，打上浏览器下载的来源标记后 `spctl` 都放行，Intel 那个里面是 x86_64。安装脚本从下载地址装进临时目录（只装不启动），`--version` 是 0.5.0。
  - 0.6.0 发布后同样核对过：两个安装包校验值对得上、`spctl` 放行（来源是公证过的 Developer ID），里面的版本是 0.6.0，芯片各是 arm64 和 x86_64；安装脚本从下载地址装进临时目录，输出是英文，`--version` 是 0.6.0，`speakmore update` 说已经是最新的。
  - 0.6.1 发布后：arm64 安装包从下载地址取回、校验值对得上、`spctl` 放行，里面的版本是 0.6.1，换掉"应用程序"里的 0.6.0 后三项权限都在、key 验证通过；命令行那份用安装脚本从 0.6.0 升到 0.6.1，`speakmore update` 说已经是最新的。
  - 0.6.2 发布后，在作者的电脑上从真的下载地址跑了一遍新的 update：命令行那一份先用安装脚本升到 0.6.2，再打开 0.6.1 的 App 跑 `speakmore update`，它让 App 退出、下载 arm64 的 dmg 换成 0.6.2、重新打开，6 秒起来，三项权限和 key 都在，`spctl` 放行；再跑一次说已经是最新的。
  - **没验证的**：用浏览器下载、在访达里拖进去（这次是用命令拷的；带着来源标记、没经访达挪动的应用，系统会把它挪到一个临时位置运行，去掉标记后正常）、装好的应用里开机启动开不开得了、Intel 版。
- 主窗口和首次引导（从源码跑的，发布包里还没试过）：
  - 画面：用真页面和造的数据离屏截图看过三套主题、浅色深色下的首页、历史记录、设置四页和"还差什么"的横幅；首次引导六步（朱砂浅色全部、墨深色四步）；历史记录往下滚时，顶上那条玻璃把滚上去的字模糊了。
  - 临时目录里起真的后台（右 Control 当热键），用调试协议驱动真窗口：缺 key 时自己打开首次引导；在引导里填 key，真的验证通过；走完打开主窗口首页；设置里换热键、换主题当场生效；`speakmore settings` 停在缺东西的那一页。这一轮是在换观感、改文案之前跑的，之后只改了样式和字，没有重跑。
  - 端到端的听写（合成的 7.4 秒语音，真的 Gemini）：录音分 3 块上传，2.7 秒整理完，缓存命中 1350 个 token，花费 $0.00032，成品“我们后天下午 3 点开会，记得把上周的数据带上”，贴字、存历史、记账都走通了。
  - **没验证的**：测麦克风那一步的电平条跟不跟真声音动（当时内置麦克风几乎收不到声音）、测快捷键时按下去键帽变不变色（合成不了那个按键；装好的应用里真按过，日志只记了按键送到了引导窗口）、"说一句"那一步的字是不是落进了笔记框（日志只记了贴出去）；审查后改的几处主进程行为没在真窗口里重跑：命令行第一次启动打开首次引导、测快捷键那一步切到别的应用时热键照常听写、设置对话框左栏不再被侧栏的拖动区盖住（要真鼠标点）、拖文件进窗口不会跳走。
- 界面语言（从源码跑的，临时目录、右 Control 当热键，系统语言是英文）：
  - 第一次启动跟随系统用英文：首次引导六步、主窗口首页、历史、设置四页、"还差什么"的横幅都是英文，粘贴一把带空格的 key 当场说 "This key has spaces or line breaks…"；悬浮条上最长的英文提示 220 像素宽，放得下（窗口 380）。
  - 设置里把语言换成简体中文：主窗口按中文重新加载、停在"通用"页，开着的首次引导和悬浮条也换成中文，设置文件里记的是 `zh-CN`；再用 `speakmore config set language en` 换回来，三个窗口当场换回英文，不用重启。日志里没有一条错误。
  - 命令行按终端的 `LANG` 挑语言、设置里写了就听设置的，自动测试里用真的 `bin/speakmore.mjs` 跑过；英文时把每个命令跑一遍，输出里一个汉字都没有。
  - 审查后补的几处也在真界面上试过：0.5 的命令行连这一版的后台，`status` 和以前一样（热键、还差什么都是字）；新命令行的 `status --json` 里也是字，语言跟着命令行；历史每一行的复制按钮有提示和读屏名称，换语言后跟着换；从命令行换语言时主窗口留在原来那一页、设置不会又弹出来；悬浮条一启动就是界面的语言；设置文件坏了时在中文界面里改主题，报错是中文。
  - **没验证的**：菜单栏菜单换语言后的样子（只看了日志）、装好的应用里换语言、繁体中文等我们没有的系统语言（按规则退回英文，只在自动测试里试过）；悬浮条正显示着一句话时换语言、首次引导停在测快捷键那步时换语言（只看了代码，真界面里不好造出这个时机）。
- `speakmore update`（本机打的包当下载地址、临时目录、命令链接放在临时目录）：装好后把版本号改旧，`status` 提醒有新版本；后台运行着时 `update`，安装脚本停掉它、换上新的，终端里（伪终端）装完自己启动了新版本，不在终端里时只说"Run speakmore to start"；再跑一次说已经是最新的。家目录经过符号链接（`/tmp`）时认不出是装好的那一份，是这次真跑才发现的，已修。
- `speakmore update` 连 SpeakMore.app 一起换（下载地址指向本机打好的 0.6.1 正式包，0.6.0 的 App 和命令行从下载地址取回）：
  - 什么都没在跑（临时家目录，`SPEAKMORE_APP` 指向临时目录里的 App）：两个都从 0.6.0 升到 0.6.1，谁都没启动；换上的 App 签名完好、`spctl` 放行，旁边没留下半截的东西；再跑一次说已经是最新的。
  - 作者自己的 App 换回 0.6.0、正在跑：`update` 让它退出、换成 0.6.1、重新打开，5 秒起来，三项权限和 key 都在。第一次真跑时没打开成：`open` 会把自己的环境变量交给打开的 App，命令行带着的 `ELECTRON_RUN_AS_NODE=1` 让 App 当成 Node 跑、一启动就退出。已修，有一条真去 `open` 的测试守着。
  - 只有自动测试的：App 和命令行都旧、App 正在跑（两步分别真跑过）；正在跑的是命令行那一份时由安装脚本重新启动它；Intel 的 dmg。
- 官网（`website/`，2026-10-15 第一版，当天上线）：
  - 自动测试 13 条全过（两种语言的文案结构一致、占位一致，选语言，地址拼法，图标里的引用，截图清单，页面上不出现 Typeless）；`npm run build` 通过，打包后的脚本 gzip 96 KB。
  - 在浏览器里看过：1440 和 390 两种宽度、系统浅色深色、中英两种语言，各段截图逐张看过，390 宽时没有横向滚动。生产构建（带内容安全策略）下没有报错，7 张图都加载出来，切语言后 `<html lang>`、标题、网址跟着变，换主题和深浅色时截图跟着换。
  - 演示里的成品是真的：用系统的合成语音（英文 Samantha、中文 Tingting）各说两三段，经当前提示词交给 Gemini 3.6 Flash，每段跑 3 次，页面上用的是其中一次的原样输出。英文这几段口头禅、改口、列表都处理对了，句首的 "So," 会留下。
  - 图片域名：从大陆的服务器上测，带官网的来源 200、陌生网站的来源 403、没有来源 200，http 跳 https；从本机经代理测时陌生来源也是 200（海外节点当时还没生效，没再追）。
  - 容器：本机 OrbStack 上构建、起过一遍：只读文件系统、64 MB 内存、0.25 核都生效，写文件报 Read-only，响应头和内容安全策略对，脚本和样式带一年缓存并且 gzip，不存在的 `/assets/` 文件 404；无头 Chrome 里中英两种语言都显示正常，截图从图片域名加载。验完删了容器和镜像。
  - 上线：`npm run deploy` 在服务器上构建 2 分 37 秒（多半是第一次拉基础镜像），打出来的文件名指纹和本机构建的一样；容器起来后占 3.5 MB 内存，同机另外两个站的容器、端口照旧、都回 200。宿主机站点文件换成 `host-nginx.conf`（原文件备份在服务器上），`nginx -t` 通过后 reload。从外网看：https 200，带 HSTS 和容器加的安全头，http 301 到 https，`/health` 200，截图带官网来源 200、陌生来源 403。
  - **没验证的**：Safari 和 Firefox（只在 Chromium 里看过；不支持滚动驱动动画的浏览器里各段直接显示、不浮上来，这是照代码说的，没实测）；线上的手机宽度（无头 Chrome 的窗口最窄 500 像素，390 宽只在第一版时用浏览器的设备模拟看过）。
- 两种识别模式、本地模型的配置表和国内源（2026-10-16，从源码跑的，发布包还没打）：
  - 单测 754 条在 Node 26.0 和 Electron 自带的 Node 24.21 上都全过，安装脚本的 19 条全过；lint 和本机信息检查都过。
  - 本地转写整条链路（[记录](../bench/results/e2e-local-2026-10-16.md)）：回放三条真实录音，松开到出字 1.5–1.75 秒；`scripts/dev/e2e.mjs` 在 App 里走一遍，新的数据目录、模型从国内源下（850 MB，91.7 秒），松开后 1.24 秒出字，贴字、存历史、记账都走通。
  - 打包：按 `npm run release` 的办法给两种芯片各摆一份，arm64 那份装的是 transcribe.cpp 的 Metal 版和 sherpa-onnx 的 arm64 版，x64 那份是 CPU 版和 x64 版，许可证检查通过。拿 arm64 那份（只有运行时依赖）跑 e2e，两个运行库各走通一遍：SenseVoice Q8 在 Metal 上、SenseVoice int8 在 CPU 上。改之前这两个运行库是开发依赖，打出来的包里根本没有它们，本地转写会装不上。
  - 国内源：四个模型传进模型桶，从 CDN 逐个核对过大小，预热了大陆的节点。下载速度见上面那份记录：Hugging Face 0.6 MB/s，国内源没预热时 3.3 MB/s、预热后 9–10 MB/s。
  - 设置里的"模型"一页，用调试协议驱动真窗口（临时目录，DeepSeek、Gemini 的 key 从环境变量来）：两种模式的标签、标签和实测数字、下载进度和"就绪 · Metal"；在 local 里换润色模型、换第一步的模型、换下载源都当场生效并写进设置；没有 Gemini 的 key 时"改用原生"被拒、说清原因、模式不变；自定义服务填一个连不上的地址，验证不过、设置不变；在原生里先点选第一步的模型再"改用本地转写"，那个模型一起带过去；切回原生，本地模型卸掉。中英文各看过一遍。
  - 签了名的应用（0.7.0，`npm run dist` 用 Developer ID 签、开着 hardened runtime，没公证）：转写子进程是应用自己以 Node 的身份跑，四个模型都装载、转写得了，Qwen3 Q8 和 SenseVoice Q8 在 Metal 上，两个 int8 在 CPU 上；`node_modules` 里两个运行库的原生库都签上了同一个团队。拿它跑 local 端到端（`SPEAKMORE_E2E_ELECTRON`，新的数据目录）：国内源下 850 MB 用 96.9 秒，装载 3.0 秒，松开后 1.3 秒出字。
  - Intel：x64 的应用同样签了名，在 Apple 芯片上用 Rosetta 跑，四个模型都装载、转写得了（transcribe.cpp 是 CPU 版），一段系统合成的中英夹杂录音转出来的字和 arm64 的一样，只有 Qwen3 int8 把 GitHub 听成了 "G Tech"。Rosetta 下的速度不代表 Intel 的机器。
  - 下载源换着下：拿一个国内源上没有的 id 造出真的 404，国内源回 404 之后自动改从 Hugging Face 下，200，校验通过、装好；同一个文件用真的 id 从国内源第一下就是 200。
  - `speakmore config set` 留作手动改设置的后门：照旧直接写设置、不经过模式那一层的检查；改模式管的几项时说平时用哪个命令换，写的不是现在这种模式的设置时说切过去才用上（真跑过一遍，中英文各看了）。
  - **没验证的**：公证（本机打发布包要把应用传给苹果公证，留到发版时 `npm run ship` 一起做）；真的 Intel 机器；超了每天 50 GB 封顶时 CDN 回的那个 404（造不出这么大的流量，只验了国内源 404 时会换源）。
- 模型手动下载、检查、按模型记账（2026-10-16，0.7.1 还没发，从源码跑的；作者自己那台用本机打的未公证包 `0.7.1-dev.1` 先用着）：
  - 单测 754 → 799 条全过，安装脚本 19 条全过；lint 和本机信息检查都过。
  - 本机模型改成用户点了才下：真后台加真命令行（临时目录），国内源下 253 MB 用 29.8 秒；中途取消、没下载时拒绝切过去、正在用的拒绝删除都对；`config set` 改成没下载的模型后重启，停在缺模型、不自己下。设置窗口里下载进度、取消、下完能选、两步删除都看过，中英文各一遍。
  - key 合成一份：临时目录里只放 0.7.0 App 那一份，命令行把它搬过来并通过 Gemini 验证；签名的新版 App 只靠共用的那一份也验证通过。
  - 检查：`speakmore transcriber check` 让系统朗读念一句交给模型，Qwen3 Q8 中英文都一字不差，转写 0.1–0.2 秒；没在用的 SenseVoice Q8 临时装上用了 0.3 秒、查完卸掉，正在用的照旧就绪（它把"三点"转成了"3点"）。设置窗口里本机模型、润色（DeepSeek）、原生（Gemini）的"检查"都点过，通过时只写"能用"；点选没有 key 的 OpenAI 不查、摆出输入框；拿一个不存在的 DeepSeek 模型名去查，回的是 DeepSeek 原话里列出的可用型号。
  - 记账：local 模式的 e2e（SenseVoice Q8 + DeepSeek flash，新的数据目录）一次听写记了 2 笔，模型耗时 1598 毫秒 = 本机转写 277 + 润色 1321。首页花费卡在复制来的历史库上看过：今天、本月、累计三段，每个模型一行（本机那行"免费"），合计一行，名字和数字整行居中；英文文案读出来对。
  - 装好的应用（本机打的 `0.7.1-dev.2`，Developer ID 签名、hardened runtime、没公证）：命令行和 App 都换上，三项权限和 key 都在；`speakmore transcriber check` 交给它查，系统朗读念的那句 Qwen3 Q8 一字不差，转写 0.2 秒。
  - **没验证的**：首页花费卡里本机那一行的真数据（真跑的那次在 e2e 的临时目录里，卡片上看的那两笔是手工插进临时库的）；Node 24.21 上的单测。
- 版本检查和更新挪进内核、App 里加上更新（2026-10-19，0.10.1 发版前）：
  - 单测 1100 条在 Mac 上全过、在 Windows 开发机上全过（Mac 专用的跳过），安装脚本 22 条全过；lint 和本机信息检查都过。对抗性审查一轮，报的 15 条里修了 10 条（中断后反复弹设置、锁的进程号被复用、更新进程早退没下文、下载期间打开或退出了 App、记录写不进去、卸载安装包失败留副本等），各有测试。
  - 测法：本机打两份测试发布包当下载地址（同一份代码，版本号 0.10.1、0.10.2；App 临时签名，dmg 自己打），装进临时家目录；命令链接、App 的位置都钉在临时目录（`SPEAKMORE_BIN_DIR`、`SPEAKMORE_APP`，不钉的话会找到"应用程序"里真的那个 App，第一次就是这样，被开发者核对挡住了），热键换成右 Control；用调试端口点设置里的按钮。
  - Mac 终端安装的那一份：设置里显示新版本可用，点更新后先下好、核对好，再停、换、用 `speakmore start` 重新启动，从点下到新版本起来约 6–8 秒，新版本一启动把设置的通用页亮出来说已更新到 v0.10.2，只说一次。安装脚本的输出完整进了日志。
  - Mac 的 SpeakMore.app：从设置里点更新，下载核对约 6 秒、对调 0.1 秒、`open` 重新打开，签名完好、旁边不留半截文件；审查改动后用命令行再换一次（App 装着没在跑，两份一起换）。临时签名的 App 被 `open` 打开时系统当成新应用，弹了麦克风授权，所以第二次没再从 App 里点。
  - Windows（作者的游戏电脑，桌面会话里像开始菜单那样起，临时家目录）：点更新约 9 秒，install.ps1 从本地镜像装好、切到新版本，`speakmore.cmd start` 起的新版本在桌面会话里，换下来的旧版本目录在更新进程退出后删掉了。审查改动后（子进程的输出经管道转进日志、只等退出）再跑一遍：点下到新版本起来约 8 秒，记下停掉的是家目录那一份，被重新打开的 App 说过结果，旧版本目录 3 秒内删掉，安装脚本的输出进了日志（PowerShell 经管道输出时 ✓ 变成了 ?，只是日志里的样子）。安装脚本改写的开始菜单快捷方式和用户 Path 事先备份、测完还原。
  - 也真跑过：没问到时的失败提示和"重试"、命令行的 `status` 提醒和 `update`、再跑一次说已是最新。
  - **没验证的**：签了名、过了公证的正式包之间的更新（0.10.1 是第一个有更新按钮的版本；0.11.0 换了下载地址的摆法，0.10.1 看不到它，正式包之间从 App 里升要等 0.11.1）；Intel 的 Mac；从访达打开的 App 拿到的是精简的 PATH 和没有代理的环境，大陆网络下安装脚本查各家模型能不能连上要多等十几秒。
- 按块更新、本机模型换魔搭、发布包瘦身（2026-10-20，0.11.0 发版前）：
  - 单测 1149 条：Mac 上 1145 过、4 条 Windows 专用的跳过；Windows 开发机上 1129 过、20 条 Mac 专用的跳过（头一遍有 2 条没照顾 Windows 的测试没过，已改）。安装脚本 27 条：Mac 上 25 过、2 条 Windows 专用的跳过，那 3 条在 Windows 上全过。Electron 自带的 Node 上跑更新和发版的 85 条全过。lint 和本机信息检查都过。对抗性审查一轮（五个角度并行），修掉的最重的一条是 Windows 上更新成功后会把刚装好的新版本删掉。
  - 测法：本机打两份测试发布（0.11.0-e2e.1、0.11.0-e2e.2，只差版本号；App 用 Developer ID 签名、不公证）当下载地址（`SPEAKMORE_INSTALL_BASE`），装进临时家目录，钉住 `SPEAKMORE_BIN_DIR`、`SPEAKMORE_APP`。按清单算两版之间要下的（含清单本身）：Mac 终端那份 0.13 MB、Windows 0.14 MB、App 1.34 MB。
  - Mac：install.sh 首装 7 秒；`speakmore update` 把终端那份和 App 一起换，5 秒，报"下了 1.3 MB，其余 701 MB 取自本机已有的文件"。换上的 App 照清单比和打出来的逐字节一样，签名有效、团队对得上，`Contents/Resources/app` 是 755；家目录和 App 旁边没留半截，缓存删了；再跑一次说已是最新；启动一次 started、helper_ready、零报错。
  - Windows（作者的游戏电脑）：照 `irm | iex` 的装法首装 4.5 秒；命令行 `update` 4.4 秒，下了 8 KB（当时还没把约 130 KB 的清单算进去，之后改了）。安装程序装进带中文和空格的家目录，装完打开 App（started、helper_ready），再在里面 `update`，curl 配置文件里的中文路径没出问题，解包的临时目录删干净了。另一个 `update` 拿着锁时重装：正拼着的目录留着、换下来的删了；锁放掉再装一次就删了。桌面会话里从设置点更新：检查、下载、退出、换、重开共 5.5 秒，新版本打开设置的通用页说"已更新到 v0.11.0-e2e.2"，旧版本目录删了。开始菜单快捷方式和用户 Path 事先备份、测完还原。
  - 实测大小：Mac 终端包 tar.xz 91.7 MB（Apple 芯片）、99.8 MB（Intel）；Windows zip 171.9 MB、安装程序 124.9 MB；dmg 改成 ULMO 后约 99–103 MB（不签名的测试包量的）。
  - 也看到的：install.ps1 的输出经管道转进日志时，中文路径和 ✓ 是乱码（PowerShell 往管道写的是系统编码），只是日志里的样子，在终端里直接跑是对的。
  - **没验证的**：签了名、过了公证的正式包之间的更新（要等 0.11.1）；Intel 的 Mac；下载到一半断网再接着下（只有单测）；下载地址被刷到按小时封顶时的样子。
- 存储位置可以放在任何地方、一键搬家、第一次安装时选（2026-10-20，0.12.0 发版前，issue #10）：
  - 单测 1233 条：Mac 上 1226 过、7 条 Windows 专用的跳过；Windows 开发机上 1170 过、63 条跳过（这个分支早先加的测试头一遍在 Windows 上有 10 条没过：9 条是测试按 macOS 的路径写的，1 条是家目录在到不了的网络路径上时被说成"已经搬走了"，都改了）。安装脚本 53 条：Mac 上 50 过、3 条 Windows 专用的跳过，那 4 条（含新加的"改写已有的定位文件"）在 Windows 上全过。Go 测试和 vet（含 `GOOS=windows`）过。
  - 对抗性审查一轮（六个角度、43 条，去重约 30 条），修了 26 条，每条先写出能复现的测试。最重的三条：Mac App 第一次打开选默认位置会一直重新启动；Windows 上改写已有的定位文件必失败（PowerShell 把 `$null` 当空字符串传给 `File.Replace`），搬到默认位置以外的都搬不成；断电后进程号被别的程序占了，App 和 `speakmore start` 一直说"正在搬"。有意不修的四条低危：新旧版本混着用时 0.11 读 0.12 写的历史只见录音的文件名；放在"应用程序"以外的 0.11 App 搬家时找不到；`~/.speakmore` 软链到超长路径的老用户升级不了（只改了提示）；外接盘默认忽略所有权，"只让自己进"在那里不起作用（key 仍由钥匙串加密）。
  - 测法：本机打的 0.12.0（App 用 Developer ID 签名、不公证）当下载地址。Mac 把 `HOME` 换成临时目录（定位文件、默认位置跟着走），钉住 `SPEAKMORE_BIN_DIR`、`SPEAKMORE_APP`，"外接盘"是 2 GB 的 APFS 内存盘；起 App 时连 `CFFIXED_USER_HOME` 一起换，不和正式的共用偏好设置。Windows 把 `USERPROFILE`、`LOCALAPPDATA`、`APPDATA` 换成临时目录并先建好"开始菜单\程序"和"桌面"（`GetFolderPath` 照 `%USERPROFILE%` 展开，目录在才交回），快捷方式落在假目录里；用户 Path 事先备份、测完还原。
  - Mac：从真的下载地址装 0.11.0 → `speakmore update` 到 0.12.0（没写定位文件，启动脚本里没有写死的路径）→ `speakmore move` 到内存盘（1,134 个文件 387 MB：换家、改链接、写定位文件、删旧目录）→ 往回搬时第 100 毫秒 `kill -9`，再 `speakmore start`：拷了一半的删了、定位文件去掉了 moving、链接没动 → 后台开着时搬回默认位置（旧目录里放了 `.DS_Store`，也整个删了；后台从新位置重新起来）→ 再搬过去、卸载，定位文件删了 → 全新安装时在终端里（expect）选内存盘，记进定位文件，卸载删掉。App 第一次打开（作者点的）：选别处（内存盘）写了定位文件、重新启动后在那里起来；选默认位置只问一次、建好只让自己进的默认目录、不写定位文件。
  - Windows（作者的游戏电脑，桌面会话）：照 `irm | iex` 装 0.11.0 → `update` 到 0.12.0 → `move` 到 D:（定位文件已在时改写、Path 和开始菜单改指、旧目录 2.5 秒内删干净）→ 后台开着时搬回默认位置（App 从新位置重新起来、D: 上的旧目录删干净、定位文件删了）→ 再搬到 D:、卸载（Path、快捷方式、家目录、定位文件都删了）→ `SPEAKMORE_INSTALL_DIR` 全新安装到 D:，同一个窗口里 `update` 没被挡，卸载。安装程序（作者点的）：中文对话框，选"选择其他位置…"、在文件夹选择框里选 D:\smsetup，装进去、记进定位文件、装完打开 App；在 App 的设置里"更改…"搬到 D:\smmove2，8 秒搬完，旧目录整个删了，App 从新位置重新起来。真的开始菜单快捷方式前后一样。
  - 端到端发现并修掉的：命令行、App 的搬家窗口都跑在 Electron 上，它把 `.asar` 文件当压缩包读，拷运行环境里的 `default_app.asar` 报 "Invalid package"，装着程序的家目录一个都搬不成（会照常回滚）；之前开发版 App 试搬的家目录里没有运行环境，没碰到。拷、量、核对时设 `process.noAsar`，加了用真 Electron 跑的测试。
  - 也看到的：测试起的 App 用的是假的用户目录，搜狗输入法往里写日志并一直开着，测试目录要等它退出才删得掉。测试脚本的两个坑：写给 Windows PowerShell 5.1 的脚本要带 BOM（不然中文注释吞掉换行，下一行跟着成了注释）；照 `irm | iex` 在同一作用域里跑 install.ps1，它的 `$script:Base` 会盖掉脚本里不分大小写同名的 `$base`。
  - **没验证的**：打好的 Mac App 里从设置"更改…"搬家（最后要 `open -n` 重新打开，在这台机器上会碰到正式装的那份，只在开发版里走过）；install.ps1 在 PowerShell 窗口里问装在哪（交互提问只在 install.sh 上用 expect 测过）；签了名、过了公证的正式包；Intel 的 Mac。
- 只有自动测试、没在真机上试的：启动时断网、从 0.1 版搬数据、重新检查权限时不再反复弹系统授权框。

- 引擎页、首页花费卡、界面逐页打磨（2026-10-21，0.13.0 发版前）：
  - 单测 1258 条：Mac 上 1251 过、7 条 Windows 专用的跳过；Windows 开发机上 1195 过、63 条跳过。安装脚本 53 条在 Mac 上 50 过、3 条跳过。
  - 对抗性审查一轮（六个角度 40 条，去重 33 条，按视角分组复核：确认 31、驳回 2），31 条全修。纯逻辑的两条先写了失败的测试（当天零点因夏令时不存在时本月的起点、Ctrl/⌘ + 滚轮一格的倍数）；界面上的在 Mac 开发窗口里用调试端口逐条核过（换方式时启用置灰、重画后焦点留在原处、设置里按 Esc 不收详情、密钥面板换页时收起、面板里的提示在最上层、流光不再触发 CSP、画布不会被滚走等），滚轮缩放、密钥面板在 Windows 开发窗口里也核过。
  - 测法：从源码起隔离家目录的 App，往历史库里灌假用量看花费卡（今天、本月、累计，只有没标价的云端时的那句话）；README 和官网的图也从隔离家目录里起的真 App 截。
  - **没验证的**：没切成的识别方式后来从别处换上、失败说明作废（主进程那边造不出切换失败，只核了代码路径）；Windows 上用真鼠标滚动（核的是调试协议合成的滚轮事件，deltaY 100，和 Chromium 在 Windows 上一格报的一样）。

- Windows 安装时清旧版本报"不能对 Null 值表达式调用方法"（2026-10-21，0.13.1 发版前，issue #11）：
  - 原因：install.ps1 的 `Remove-Old` 列进程、比路径时读了两次 `Path`。Windows PowerShell 5.1 里它是现算的（`$this.Mainmodule.FileName`），进程在两次读之间退出就读成空的。在 Windows 开发机上起一个 ping、列进程、停掉它再读 `Path`，得到的报错和 issue 里一字不差。
  - 测试：把 `Remove-Old` 原样拿出来跑，`Get-Process` 换成"列完就停掉一个进程"。旧写法在 Windows 上报同样的错，改成只读一次后照删旧版本、留下在用的这一版；install.ps1 的 5 条测试在 Windows 开发机上全过。
  - 旧写法在开发机上原样跑 100 次（每次约 0.84 秒、名单上 217 个进程）碰上 1 次：电脑上任何一个程序恰好在那一下退出就会触发，不只是刚停掉的旧版本。全新安装没有旧版本要删，碰不上。
  - 发版后的验收（0.13.0 的改动一起验）：Mac 下载线上 Apple 芯片 dmg，校验值对、过公证、App 版本 0.13.1，挂载后用隔离家目录真启动（started、helper_ready、零报错）；照终端安装那一行装进临时目录，`update` 说已是最新。Windows 开发机上把用户目录换成临时目录：装 0.13.0 并让它开着（5 个进程），照 `irm | iex` 升级，停掉旧版、升到 0.13.1、旧版本当场删掉、没报错；`update` 说已是最新，0.13.1 真启动零报错；用户 Path 已还原。
  - **没验证的**：真实安装里撞上这个时机（取决于哪个进程恰好在那一刻退出），只在上面那条测试里造过；Windows 安装程序（要点系统对话框）和 Intel 的 dmg 这次没装。

- 热键开放任意键和两键组合（2026-10-21，0.14.0 发版前，调研和决定见[热键调研报告](hotkey-research.md)）：
  - 单测 1373 条：Mac 上 1366 过、7 条跳过；Windows 开发机上 1308 过、65 条跳过。安装脚本 54 条在 Mac 上 50 过、4 条跳过。原生：Go 顶层 51 个测试全过，Swift 292 条全过（两边读同一套按键轨迹样例）。
  - 真的小帮手：Mac `node scripts/dev/mac-hotkeys.mjs --secure-input` 42/42（合成的键带记号、全在末尾接住，键盘空闲 30 秒以上才跑：第一次跑时有人在打字，录键那几项录到了真键）；Windows `e2e.ps1` 39/39（开发机上的 `build\key-helper.exe` 不随 win-sync 更新，要本机交叉编译后拷过去）。
  - 老用户升级、退回，两台各走一遍（隔离的家目录，钉住命令链接和 App 的位置）：从线上装 0.13.1，听写设成右 Control / 右 Ctrl，开着用本机打的测试包 0.14.0-e2e.1 升级（Mac `speakmore update`，Windows 在桌面会话里 `speakmore update`）：设置文件换成 `hotkey.dictate`、旧的 `hotkey` 删掉，合成一次右 Control / 右 Ctrl 照常报 `binding dictate#0`，status 里热键的名字和升级前一样，没有新的权限弹窗；照 README 从线上装回 0.13.1：起得来、用默认键，`hotkey.dictate` 留在文件里；Mac 上再升回，原来的键照旧生效。Mac 的 SpeakMore.app（本机临时签名）从 shell 直接起一次，旧设置当场换算并记 `settings_migrated`。
  - 真人在开发窗口里按：Mac 右⌥ 空格听写贴字；录键时按 ⌘W、⌘Q 被拦下（窗口没关、App 没退）；Windows 锁屏再解锁后钩子重装（`helper_relistened`，原因 unlock），右 Alt 听写、本机模型转写贴进记事本。
  - 对抗性审查一轮（五个方面 32 条，按方面分组复核：确认 21、可能 6、驳回 5），修了 24 条：确认的全修，可能的修了改起来便宜的三条（安全输入下顶替注册只动变了的、NumLock 假 Shift、退出时往小帮手写）。纯逻辑的都先写失败的测试；录键界面的几处在 Mac 开发窗口里用合成键核过（被拒的原因全部松开后还在、存好显示"已保存"）。单个 F12 在 Windows 上试登记一律报 1409（留给调试器，开发机实测），改成不让单绑。
  - **没验证的**：安全输入开着时按住组合、同时注销重注 Carbon 会不会丢掉松开（改成只动变了的，没在真机上造出这个时机）；权限在运行中被撤销会不会冻住整机（V26，只在虚拟机里做，这次没做）；管理员窗口在前台的提示（开发机的账户本身是管理员，触发不了）；锁屏期间拉起小帮手；NumLock 假 Shift、AltGr 假左 Ctrl 只在单测里按文档模拟；Intel 的 Mac；签了名、过了公证的正式包。

- 本机转写模型按需装载（2026-10-22，GitHub PR #14，外部贡献；审查后收成一项设置 `localModelMemory`，自定义服务的那套删掉，见[实现笔记](implementation-notes.md)）：
  - 单测 1384 条：Mac 上 1377 过、7 条跳过；Windows 开发机上 1319 过、65 条跳过。安装脚本 54 条在 Mac 上 50 过、4 条跳过。原生：Go 全过，Swift 292 条全过。
  - 端到端（`scripts/dev/e2e.mjs`，`SPEAKMORE_E2E_ROUNDS=2`，空闲 1 分钟释放，录音是 bench 里的一段真人录音）：Mac 数据隐私模式开口时装载 0.38 秒，最后一条消息后 60 秒释放（1.4 GB 的转写进程退出，下一遍换了新进程），第二遍重新装载 0.37 秒，两遍松开后 0.11、0.10 秒出字；常驻对照两遍都是 0.1 秒、中间不释放。Windows 开发机（i5-13400F，Vulkan）同样两遍：装载 1.29、1.27 秒，60 秒释放，松开后 0.35、0.40 秒出字。
  - 本机转写加本机 Ollama 润色（Ollama 0.40.8 装在 `.tools/ollama`，Qwen2.5 1.5B 用魔搭的 GGUF 导入）：额外参数写 `{"keep_alive":"1m"}`，每次润色后 Ollama 把模型留一分钟，到点自己卸掉，下一遍再装上，两遍都出字。LM Studio 1.0.7 的请求带 `"ttl": 10`，模型 10 秒后卸掉。
  - 开发窗口（隔离的家目录）：设置 → 通用里切到常驻，模型当场装上（0.37 秒）；切回空闲 1 分钟，60 秒后释放，`speakmore status` 那一行写"空闲时已释放，开口时再装"。
  - 对抗性审查一轮（三个方面 33 条，按方面复核：确认 31、可能 1、驳回 1）：自定义服务的空闲释放和四项设置整块删掉、收成一项；其余确认的都修了（悬浮条显示时热键绕过拦截、每次停止都读设置文件、计数漏减、按需装载没装上一直拦着热键、下载进度让状态来回翻、命令行状态少一行、文案用词）。服务的几条先改测试、看它失败再改代码；测试一次发完三条消息时碰出一个转写比开口准备先跑的顺序，改成说完时没装着也装一次。
  - **没验证的**：Intel 的 Mac 上冷启动多久；0.35 以前的 Ollama（只从源码看到它的 `/v1` 不认 `keep_alive`）；签了名、过了公证的正式包；真人在开发窗口里按热键听写。
