# SpeakMore 热键自由绑定调研报告

> 性质：纯调研。代码没动，未开始实施。成文日期 2026-10-20。
>
> 代码基线：`ui-polish` 分支。分路取证时 HEAD 为 `ab20c7e` 和 `7e9786e`，成文时为 `15afac0`，修订时复核到 `7c2cd6f`（0.13.1），第三版复核到 `0a2b29f`（`src/`、`native/` 与 `7c2cd6f` 相同）。`15afac0` 之后 `src/`、`native/` 没有改动；`README.md`、`README.en.md` 改过，文中 README 的行号已按 `cdd50f9` 改正；`docs/development.md` 只在文末追加，文中引用的行号不变。分路笔记里 `src/i18n/locales/zh-CN.mjs` 第 560 行以后、`en.mjs` 第 546 行以后的行号要加 1，本文引用的已经改好。
>
> 修订记录：第二版按一轮对抗性审查的 20 条意见改过。意见里引的源码、SDK 头文件和参考实现逐条对照过，20 条都成立。改动最大的是 4.1（两个 tap 怎么分工、单个 F 键怎么吞、安全输入用 Carbon 顶替）、5.2（设置怎么接进现有框架）、5.3（esc 与漏掉的松开）、5.8（协议补 `probe`、`info`）、5.9（写入路径统一、状态接口、退回旧版的步骤）。
>
> 第三版（2026-10-21）按主人新定的方向改：热键彻底做成配置驱动，内部不为旧写法留兼容层；老用户升级后无感，能感觉到的只有"热键能自己录、能组合了"。重写了 1.1、5.2、5.4、5.9 和第 6 节，改了 D2、D4、D7，新增 D13；3.3、3.4、5.3、5.5、5.7、附录跟着改。第二版的"听写存两处、`status` 加 `dictateCombo`、等第二个动作再把 `hotkeys` 升格、第一版只开放听写改键、实施中途保留 `--key`"都不要了。
>
> D1–D13 主人已于 2026-10-21 拍板，结果见 1.2 和 7.1。和建议不同的五条：D1 改成全部松开才算松开；D4 界面照 Typeless 一个动作列多个组合、能添加能删；D9 只认键盘，鼠标键一律不做；D10 新动作必须带默认键并在引导页讲到；D11 单按 Shift 也不开放。相关章节已跟着改。
>
> 真机实验（2026-10-21）：V1、V8、V19、V20 在本机（MacBook 自带键盘，macOS 26.5.2）跑完。程序和原始数据在 `.playwright-mcp/hotkey-research/experiments/`，只在本机。V8、V20 通过；V19 通过，但要求小帮手改用 NSApplication 跑；V1 不通过，D3 经主人重选，改为"触发 tap 同步打开吞键 tap"。改了 1.1、1.2、4.1、5.3、第 6 节第 7 步、7.1、7.2 和附录 B。
>
> 引用约定：
>
> - `文件:行` 指仓库根目录下的源码。
> - Typeless 逆向文档写成相对链接（本文预计放在 `docs/` 下）。
> - `R:main:行` 指 `targets/typeless/_work/readable/dist/main/index.js`；`R:<文件>:行` 指同一目录下 `renderer/static/js/<文件>`。`_work/` 被 `.gitignore:22` 排除，只在本机。
> - `SDK:<头文件>:行` 指本机 Xcode 自带 MacOSX 26.5 SDK 的头文件。
> - 外部开源代码写作 `项目@提交 文件:行`。只读副本和分路笔记的位置见附录 B。
> - 没能取证的写"未验证"，并给出验证办法。

---

## 1. 结论

### 1.1 推荐做法

1. **底层机制不换。** macOS 继续用 CGEventTap，Windows 继续用 `WH_KEYBOARD_LL`。系统热键接口（Carbon `RegisterEventHotKey`、Win32 `RegisterHotKey`、Electron `globalShortcut`）做不了单独修饰键，也分不了左右；Win32 `RegisterHotKey` 和 Electron `globalShortcut` 还没有松开事件。所以它们只做辅助：`RegisterHotKey` 做冲突探测；Carbon 用来吞 Mac 上的单个 F 键，并在安全输入期间顶替带普通键的绑定（4.1；V19、V20 已验证，前提是小帮手改用 NSApplication 跑）。第三方库一概不用。
2. **键用 W3C `KeyboardEvent.code` 名标识**，例如 `AltRight`、`MetaRight`、`Fn`、`Space`、`F13`。全项目只在 JS 里放一张键表，从 Chromium 的 `dom_code_data.inc`（BSD 许可）裁出子集，再补上 `Fn`。主进程把 code 换成原生码再下发，两个小帮手不再维护键名。现在的 4 份键表和 2 份按 id 写的文案，合并成这一处。
3. **匹配和吞键在小帮手里做。** 主进程用一条 `bind` 命令下发绑定表，可以随时整表替换，换键不再重启小帮手。小帮手只报"哪个绑定按下、松开、被打断"，不报别的按键，现有的隐私约定不变。录快捷键是一个限时模式，只有这段时间报原始按键。
4. **组合最多两个键，按集合精确匹配。** 修饰键之间不分先后。修饰键加普通键时，普通键必须最后按。只有按下能凑成组合，松开不能；组合里的键全部松开才算松开（D1）。组合按着时来了别的键，报 `interrupted`，取代今天的 `other_key`；新的键集合恰好是另一个绑定时，算一次"升级"。
5. **修饰键一律不吞，组合里的普通键整段吞掉**（按下、自动重复、松开）。Windows 上有 Alt 或 Win 参与时插掩码键，规则从"只管右 Alt"推广到全部 Alt 和 Win。macOS 上吞普通键要用能改事件的 tap，需要辅助功能权限。这个吞键 tap 平时关着，由一个只收修饰键事件的小主动 tap（触发 tap）在同步回调里打开：V1 实测，由只听 tap 事后再打开会漏键。触发 tap 只在存在"修饰键 + 普通键"绑定时才建。三个 tap 共用一个匹配器，按事件去重（V8）。
6. **动作目录是唯一的出处**（`src/hotkeys/actions.mjs`）：每个动作一行，写默认组合（按系统分）、生效场景、能否清空、长按阈值、交给谁处理。设置项、环境变量、命令行、设置页、状态、下发给小帮手的绑定表，全都按这张表生成。除了各动作自己的处理代码（和引导页专门教听写的那一步），没有一处按动作写死。第一版两个动作："听写"和"取消（只在说话时）"，两个都能改键，每个动作能绑多个组合（D4）。以后加功能（比如翻译），只改三处：目录里加一行（必须带默认键，D10）、两份文案里加名字和说明、写这个功能本身；设置页和引导页自动带上它。有测试按目录逐个动作查，漏了哪处就红（5.4）。
7. **一个动作一项设置**：`hotkey.dictate`、`hotkey.cancel`，设置文件里存成组合的列表（`["ControlRight+Space", "F13"]`，空列表是关掉），只存改过的。这正好落在现有设置框架的规矩里（一项一个键，读写列表用框架现成的 `json`、`store`），环境变量、`config set/unset`、"设置改了还没生效"都现成，不为热键开特例（5.2）。
8. **老用户无感**（5.9）：存的、报的、显示的一律是新写法，旧写法只在入口认。第一次启动时把设置文件里的 `"hotkey": "right_command"` 换成 `"hotkey.dictate": ["MetaRight"]`；旧的环境变量 `SPEAKMORE_HOTKEY` 和旧命令 `config set hotkey` 照样能用；六个旧键的键帽和名字逐字不变，用法、权限都不变。退回旧版照样能起来，热键回到默认键。
9. **实施顺序**：先写纯逻辑和一套 Go、Swift 共用的按键轨迹样例，再改协议，再做吞键和平台细节，最后做录键界面。每一步都能单独测试、单独提交。

### 1.2 需要主人拍板的事

2026-10-21 主人逐条拍板。每条的选项和理由见第 7 节。

| # | 问题 | 定了 |
| --- | --- | --- |
| D1 | 组合的"松开"按哪个键松开算 | 全部松开才算松开（同 Typeless） |
| D2 | 前缀共享（如 `AltRight` 与 `AltRight+Space` 分给两个动作） | 允许，保存时警告；运行时按下即触发，第二个键到来时升级 |
| D3 | macOS 上带普通键的绑定怎么做（修饰键 + 普通键、单个 F 键） | 修饰键 + 普通键：存在这类绑定时，常开一个只收修饰键事件的触发 tap，在它的同步回调里打开吞键 tap（V1 不通过后，主人 2026-10-21 改定）；单个 F 键走 Carbon，小帮手改用 NSApplication 跑（V19）；安全输入期间由 Carbon 顶替（V20） |
| D4 | 每个动作允许几个组合 | 多个，上限 4；设置页照 Typeless 列出每个组合，能删、能"添加另一个" |
| D5 | 默认键 | 不变：Mac 右 Option，Windows 右 Alt |
| D6 | 键帽上左右怎么标 | 一律标左右，单按和组合都标 |
| D7 | 命令行怎么改热键 | `config set hotkey.<动作> <组合>`，每个动作一项；旧的 `config set hotkey` 当成改听写 |
| D8 | Windows 管理员窗口在前台时热键失效 | 第一版只提示，不做"以管理员身份运行" |
| D9 | 鼠标侧键 | 不做：只认键盘，鼠标的任何键都不能当热键 |
| D10 | 以后新动作（如翻译）的默认组合 | 必须有默认键，不能留空；引导页要讲到。具体用哪个键，做那个功能时再定 |
| D11 | 单按 Shift、CapsLock 这类有系统副作用的键 | 都不开放（Shift 仍可和别的键组合） |
| D12 | 是否支持"任一侧"修饰键 | 不支持，只认分左右的具体键 |
| D13 | `status --json` 里的旧字段（`hotkey`、`hotkeyLabel`、`settings.hotkey`） | 保留一个版本、标弃用，再下一版删掉（AGENTS.md 红线 6） |

---

## 2. Typeless 是怎么做的

依据：本仓库已有的逆向材料。原生库 `libKeyboardHelper` 的 arm64 切片用 REA 命令行加项目内 Ghidra 反编译（REA 的 MCP 工具缺 Ghidra 路径，用不了），键名表用只读脚本按 Swift 字典布局解析。Evidence 编号见分路笔记 01。

### 2.1 三层分工

- **原生库**负责认键、精确匹配、吞键。回调签名是 `bool KeyboardCallback(int32_t, char*, int32_t, int32_t, char*)`（`R:main:11825-11832`），五个实参依次是键码、键名、按下或松开、是否被吞、当前按住的全部键的 JSON。回调是异步派到主队列执行的，所以 JS 的返回值决定不了吞不吞，吞键在原生层同步决定。
- **主进程**负责转发和下发目标。每次按键变化，原生层都把当前按住的全部键回传，包括字母；主进程 16 ms 节流、50 ms 补发，再广播给四个窗口（`R:main:12699-12701`、`12754-12763`、`12784-12790`）。
- **悬浮条渲染层**负责判定触发哪个功能、管理会话和长按。
- **平台分支**：macOS 在主进程里直接用 koffi 加载 `libKeyboardHelper.dylib`（`R:main:11798-11985`）；Windows `fork` 一个 Node 子进程加载 `KeyboardHelper.dll`（`R:main:2827-2840`、`12031-12045`），异常退出最多重连 3 次。分支由构建期常量决定（`R:main:81`、`12415-12424`）。这一点更正了 [docs/03](../targets/typeless/docs/03-process-architecture.md) 和 [docs/07](../targets/typeless/docs/07-native-helpers.md) 里"macOS 也在子进程里加载"的说法。
- **事件监听**：HID 层、主动式、插在最前，事件掩码 `0x6001c00`，含 keyDown、keyUp、flagsChanged、otherMouseDown/Up，一直开着（[docs/07](../targets/typeless/docs/07-native-helpers.md)「libKeyboardHelper：全局按键」）。

### 2.2 数据模型

- 设置项 `featureShortcutBindings: { 功能: string[] }`，每个字符串是 `"Fn+Space"` 这样用 `+` 连起来的键名（`R:main:4282-4284`）。
- 每个功能最多 4 条绑定（`R:DdHsgR7k.js:1740` 的 `Nt = 4`），用途是外接键盘没有 Fn 时另加一条。每条最多 3 个键，这个上限只在录制控件里；原生层不限键数。
- 保存后按键数升序排，键数相同保持原顺序（`R:DdHsgR7k.js:1805`）。一写设置，主进程立刻重新下发（`R:main:19453-19456`）。
- 下发给原生层的是 `[[String]]`，例如 `[["Fn"],["Fn","Space"],["Fn","LeftShift"]]`（`R:main:12800-12816`）。录音期间悬浮条再追加 `["Escape"]`（`R:qA149QP2.mjs:7737-7743`）。
- 模型是演化来的：旧版存 `keyboardShortcut{pushToTalk, handlesFreeMode, translationMode}`，单字符串、小写键名；两次一次性迁移各用一个标志位记"迁过了"（`R:main:20478-20642`）。因为存的是整张表，每加一个功能都要跟着迁移。

默认值（`R:main:4246-4265`，已核对原文）：

| 功能 | macOS | Windows |
| --- | --- | --- |
| 听写 `dictationMode` | `Fn` | `RightAlt` |
| 问任何事 `askAnythingMode` | `Fn+Space` | `RightAlt+Space` |
| 翻译 `translationMode` | `Fn+LeftShift` | `RightAlt+RightShift` |
| 再贴一次 `pasteLastTranscript` | `Ctrl+Cmd+V` | `LeftCtrl+RightShift+V` |

三个主功能共用同一个前缀键。Windows 上 Typeless 的默认听写键是右 Alt，和 SpeakMore 的 Windows 默认键相同。

### 2.3 键名体系

- 键的身份是**键名字符串**，不是键码。原生层有一张 79 项的特殊键表（按 macOS kVK）和一张 47 项的 QWERTY 表。
- 字母、数字、标点按**当前输入法布局**翻译成 `keyName`（`TISCopyCurrentKeyboardInputSource` 加 `UCKeyTranslate`），另给一个美式布局的 `enKeyName`。匹配时先用 `keyName` 比，不中再用 `enKeyName` 比。
- 表里没有的键叫 `unknown-<键码>`，照样能存、能下发、能匹配。鼠标中键和两个侧键编成 2002–2004，名字 `MouseButton2/3/4`。
- `Fn`（键码 63）和地球仪键（键码 179）都叫 `Fn`。`CapsLock` 不在修饰键掩码里，实际上不能当热键。
- 修饰键左右靠键码区分，按下松开看设备无关的标志位；两侧同一修饰键都按着时另有判断。
- 隐患（推断，未验证）：在 A 布局录的非拉丁字母绑定，换到 B 布局后两种名字都对不上，绑定会失效；某布局下产出 `+` 字符的键会把存储格式弄坏。验证办法：俄语、德语布局下录制再切换布局。

### 2.4 匹配与吞键

- **集合相等**：按住的键集合必须恰好等于某条绑定，与按下顺序无关，多一个键都不算，左右修饰键不同名（`isMatchShortcuts`，反编译证据见笔记 01 §5.1）。渲染层用 `Lo` 再比一次，规则一致（`R:UfR9-a2Z.js:852-859`）。
- **吞键**：集合精确命中、且按住的键不全是字母或主键区数字时，返回 `NULL` 吞掉这一次事件。按下和松开都吞。全是字母数字的组合永远不吞，保证打字不被劫持。
- **防卡键**：每次按下前清掉按下超过 10 秒还没松开的键（`cleanupStaleKeys`）。
- 以上吞键规则来自静态反编译。运行时没有验证（未验证；验证办法：装着 Typeless 时按 `Fn+Space`，看前台应用有没有收到空格）。分路笔记 05 把这一条记为"没读清"，笔记 01 后来读清了 `isShortcutMatch` 和 `handleEvent`，本文以 01 为准。

### 2.5 会话与按住

- 三个功能语义相同：按一下开始，再按一下结束；按住超过 600 ms 取消并提示"不要按住"。2.8.1 没有"按住说话"（[docs/10](../targets/typeless/docs/10-interaction-state-machine.md)「"按住说话"在这一版里不存在」）。
- 会话 reducer `la`（`R:qA149QP2.mjs:7390-7496`）：
  - 命中新的绑定，且会话里只命中过一次，就**升级**成新功能（如 `Fn` → `Fn+Space`）；第三次起忽略。
  - 新命中是当前绑定的真子集（松开 Space 只剩 Fn），忽略，不会"降级"（`R:qA149QP2.mjs:7684`）。
  - 有键不属于任何候选绑定，发 `wrongKeyDown` 取消会话。
  - **全部键都松开**才结束会话。
  - 600 ms 定时器从第一个键按下算起，升级时不重置（`R:qA149QP2.mjs:7509-7524`）。
- 听写键两次按下间隔不到 300 ms，第二次忽略（`R:qA149QP2.mjs:7551`、`7757-7763`）。我们没有这条。

### 2.6 录制控件

- 组件 `fo`（`R:DdHsgR7k.js:1741` 起）。点某行进入录制；实时显示按住的键；**按住的键数第一次减少时**，把此前的最大集合作为结果（判断在 `R:DdHsgR7k.js:1962`，整段 `1951-1971`）。
- 通过校验就自动保存（`R:DdHsgR7k.js:1880-1896`）。没通过就在该行下显示红字 2 秒（`R:DdHsgR7k.js:1781-1793`），等用户全部松开后可以直接重录。
- 没有确认、取消按钮，也不用 esc 取消（esc 会被当成要录的键，再被保留表拒掉）。点控件外、窗口失焦或关闭、另一个控件开始录制时放弃。
- 录制时整窗 `keydown` 一律 `preventDefault`，并通知录音机暂停，全局判定也暂停（`R:UfR9-a2Z.js:15037-15057`）。
- 校验 6 条（`R:DdHsgR7k.js:1820-1871`）：不能全是字母数字；最多 3 个键；不在系统保留表里；不能含字母表相邻的两个字母或相邻的两个数字；不能和别的绑定（排序后）相同。
- 系统保留表 60 条，Mac 和 Windows 共用（`R:UfR9-a2Z.js:1178`）。它只写了左侧修饰键，所以 `RightCmd+C` 能通过；它按原顺序比对，而查重按排序后比对，所以先按 C 再按左 Cmd 能绕过（静态推断，未验证）。

### 2.7 显示

键帽一个键一个框，用文字名，不用 ⌘⌥ 符号，不做本地化：`LeftShift` 显示成 `Left Shift`，`MouseButton4` 显示成 `Mouse 4`（`R:UfR9-a2Z.js:860`）。字母数字键显示按当前布局翻译出的大写字符。

### 2.8 "再贴一次"没有触发路径

主进程下发时显式排除了它（`R:main:12804`）；主进程全文 `globalShortcut` 出现 0 次（成文时复核）；菜单里的 accelerator 只有 `CmdOrCtrl+,` 和 `CmdOrCtrl+Q`。所以 2.8.1 里它是死配置。[docs/10](../targets/typeless/docs/10-interaction-state-machine.md) 第 123 行"推断用的是 Electron 全局快捷键"不成立，分路笔记 05 沿用了这句旧说法，本文以笔记 01 为准。运行时未验证（按 `Ctrl+Cmd+V` 看是否粘贴上一条）。

### 2.9 照搬什么，不照搬什么

| 照搬 | 理由 |
| --- | --- |
| 集合精确匹配，左右修饰键分开 | 简单、无歧义；避免 `Ctrl+Shift+Space` 误触 `Ctrl+Space` |
| 原生层匹配、原生层当场决定吞不吞 | 钩子和 tap 都要求当场返回，跨进程问 JS 来不及 |
| 一个动作对应组合数组 | 外接键盘另加一条的需求真实存在 |
| 升级与"不降级" | 两键以内，升级最多发生一次，规则自然收敛 |
| 录制时暂停全局判定；第一次松键定稿 | 两键以内，"第一次松键"和"全部松开"得到的结果相同，前者反馈更快 |
| 防卡键清理 | 丢失松开事件是真实问题 |

| 不照搬 | 理由 |
| --- | --- |
| 键名随布局翻译、用 `+` 连字符拼存储 | 换布局会失效；改存物理位置的 code 名 |
| 把全部按键广播给 JS 和四个窗口 | 等于键盘记录器，违背我们的隐私约定 |
| 常开 HID 层主动 tap | 回调慢会拖累全系统；HID 层常开的主动 keyDown tap 弄坏过第三方输入法（见 4.1） |
| 三键组合 | 主人定的上限是两键 |
| 存整张绑定表 | 改成只存改过的动作，新增动作不用迁移 |
| 只列左侧、按顺序比对的保留表 | 改成按规范化集合比对，左右都列 |
| 不用 esc 取消录制 | 各家（VoiceInk、Wispr、PowerToys）都用 esc 取消，用户习惯如此 |
| 不本地化、不用符号的键帽 | 我们已有"右⌥""右 Alt"这套写法（`src/i18n/locales/zh-CN.mjs:55-62`），沿用 |

对现有 Typeless 文档的修订建议（本次没改）：docs/03 和 docs/07 的"键盘子进程"只属于 Windows；docs/10 对"再贴一次"的推断不成立；docs/10 引的 `R:CeQePRHT.js:31869` 是共享的键盘 IPC 客户端，录制控件本身在 `R:DdHsgR7k.js:1741`；docs/08 的 `RightCmd` 是本机用户加的，不是默认值。详见分路笔记 01 §11。

---

## 3. 我们现在的样子与改动面

### 3.1 数据流

```
settings.json {"hotkey":"right_option"} 或 SPEAKMORE_HOTKEY
  → SETTINGS.hotkey.parse：按固定清单校验，不认就让 App 退出（settings.mjs:81-90；main.mjs:136-145）
  → main.mjs：一个 hotkey 变量；spawn key-helper --key <id> [--no-prompt]（main.mjs:665-676）
  → 小帮手查表：mac main.swift:318-325；win main_windows.go:289-305
  → 监听：mac 只听 tap（flagsChanged|keyDown，main.swift:156-167）+ 平时关着的截取 tap（main.swift:270-282）
          win WH_KEYBOARD_LL 常驻（main_windows.go:46-60），鼠标钩子只在截取时装
  → 输出 {"event":"hotkey","down":…} / {"event":"other_key"} / escape / click
  → main.mjs:689-704：引导页测快捷键时改道；否则 tellBar("input", event)
  → bar.mjs:148-153：hotkey→KEY_DOWN/KEY_UP，other_key→OTHER_KEY
  → machine.mjs:37-99：按一下开始，再按一下结束；OTHER_KEY 在按住时悄悄取消；LONG_HOLD 600 ms 取消
  → 键帽：keycapOf(id) 查文案 hotkeys.<id>.keycap（shared/i18n.mjs:34-35）
```

换键有三个入口：设置页下拉框和引导页下拉框走 `setup:set-hotkey`，由 `setHotkey()` 校验、保存、重启小帮手（`main.mjs:1195-1216`）；命令行 `config set hotkey` 会重启整个后台（`src/cli/commands/config.mjs:80`、`157-171`）。

### 3.2 写死"单个修饰键"的地方

- **4 份键表**：`native/main.swift:35-40`、`native/windows/keys.go:27-30`、`src/storage/settings.mjs:33-36`，以及 Windows 报错文案里硬写的"right_alt、right_ctrl"（`native/windows/main_windows.go:302`）。
- **2 份按 id 写的文案**：`hotkeys.<id>.name/keycap`（`src/i18n/locales/zh-CN.mjs:55-62`、`en.mjs:56-63`）。
- **协议不带 id**：`{"event":"hotkey","down":bool}` 和 `{"event":"other_key"}`（`native/main.swift:4-16`、`native/windows/protocol.go`）。这是有意的隐私约定："按键内容不出这个进程：除了热键的按下松开，只报'有别的键'"（`native/main.swift:22-23`）。README 对外也这么写："输入监控：监听快捷键，仅限该按键"（`README.md:469`）。

### 3.3 按层的改动清单

**macOS 小帮手**（`native/main.swift`）

- `:28-41` 的 `Hotkey` 结构和字典、全局 `hotkey`：改成按原生码描述的绑定表。
- `:119-154` 的 `hotkeyIsDown`、`reportedOtherKey`、`onKeyEvent`、`reportOtherKeyIfHeld`：改成按集合匹配的匹配器，抽成可单测的纯逻辑。
- `:157-161` 只听 tap 的掩码：要加 `keyUp`。鼠标键不做（D9）。现在看不到普通键的松开，普通键当热键时算不了长按。
- `:270-282` 截取 tap：推广成"吞键 tap"，打开条件从"截取中"扩成"截取中，或录键中，或某个'修饰键 + 普通键'绑定的修饰键正按着，或还有吞了一半的键"，掩码加上 flagsChanged。新增触发 tap（主动、只收 flagsChanged，有"修饰键 + 普通键"绑定时才建），由它同步打开吞键 tap；三个 tap 喂同一个匹配器，分工见 4.1。
- 新增 Carbon 注册（单个 F 键、安全输入期间的顶替），见 4.1。入口从 `RunLoop.main.run()`（`:376`）改成 NSApplication（`.prohibited`）：只跑 RunLoop 时 Carbon 热键会把键吃掉、回调却不触发（V19）。
- 新增标准输入命令 `bind`、`record`、`probe`、`info` 的处理（5.8）。
- `:318-325` 的 `--key`：删掉，改成 stdin 的 `bind` 命令。顺带让 `--check` 不再依赖 `--key`（现在键名错时连 `--check` 也会 exit 2，`:318-329`）。
- `:22-23` 的隐私说明：改写成"只有录键模式下报原始按键"。

**Windows 小帮手**（`native/windows/`）

- `keys.go:25-30` 的 `hotkeys` 表、`keys.go:48-58` 的单个 `hotkey`：改成绑定表和按下集合。
- `keys.go:32-39` 的 `keyInput` 不带 flags：要加 `LLKHF_EXTENDED`，非修饰键用"扫描码 + E0"认，修饰键仍按分左右的 vk 认（4.2）；`kbdLLHookStruct.flags` 已经读到，但没往下传（`main_windows.go:51`）。
- `keys.go:98` 只给右 Alt 插掩码：推广到全部 Alt、Win（见 4.2）。
- `keys.go:100-101` 的 AltGr 假左 Ctrl：现在只是不算"别的键"；新方案要在进按住集合之前滤掉，否则 `AltRight` 永远凑不成精确匹配（集合会是 `{ControlLeft, AltRight}`）。
- `main_windows.go:289-305` 的 `--key`：删掉，换成 `bind`。
- **基线隐患（先修）**：钩子回调里调用的 `emit()` 是阻塞发送（`main_windows.go:38`，缓冲 256），`onUIThread()` 也是阻塞发送（`main_windows.go:41-44`，缓冲 64，消费者就是钩子线程自己）。父进程不读标准输出、管道写满时，钩子回调会卡住，超过系统时限后钩子被悄悄卸掉，小帮手还活着却再也听不到键。录键模式会放大上报量，所以这一处要先改成非阻塞发送，丢了几条再在消息循环里补报一条 error。能否实际触发未验证（单测灌满 channel 即可验）。

**App 主进程**（`src/app/`）

- `main.mjs:98-99`、`140` 的单个 `hotkey`：改成由 `src/hotkeys/bindings.mjs` 按设置生成的绑定表。
- `main.mjs:136-137`：读设置之前先同步跑一次旧设置换算 `migrateLegacySettings`（5.9）。现在 `:370` 的 `migrateLegacyData` 比 `:137` 的第一次读设置晚，换算放在那里的话，直接双击打开、开机自启的那一次会用默认键。
- `main.mjs:665-676` 启动参数：去掉 `--key`，`ready` 之后发 `bind`。
- `main.mjs:689-704` 事件分发：按绑定 id 分给不同动作；录键事件只发给发起录键的窗口。引导页"测快捷键"这条改道（`:689-697`，`hotkeyToOnboarding`）保留，改成把听写绑定的 `binding` 按下松开送给引导窗口。
- `main.mjs:1195-1216` 的 `setHotkey`：带上动作 id，写入走设置框架的 `saveSetting`（`hotkey.<动作>`，先过 `check`，5.2）；换键改为重发 `bind`，不再重启小帮手。
- `main.mjs:1210` 的 `tellBar("bar:hotkey", hotkey)`：推给悬浮条的从 id 换成组合；接收端是 `src/renderer/bar/bar.mjs:17-38`（启动时从 `config()` 取初值，换键和换语言时重算键帽）。
- `main.mjs:475` 的 `started` 日志、`:1204` 的 `hotkey_changed` 日志：字段换成组合。
- `main.mjs:719`、`758`、`776`、`911`、`1315`：键名和键帽改用统一的格式化函数。
- `main.mjs:1398-1400` 控制通道：按动作目录每个动作报一项 `hotkey.<动作>`，和设置同名，命令行的 `pendingSettings` 照旧按名字比；旧的 `hotkey`、`hotkeyLabel` 按 D13 处理。控制通道加一条 `reload-hotkeys`（5.2）。
- `main.mjs:1290-1292` 的 `onboarding:capture-hotkey`：保留原意（测快捷键时把热键送到引导窗口），不并入录键模式；只有"换个键"才进录键模式（5.6）。
- `src/app/helper.mjs:19`：Mac 小帮手的源码现在写成单个文件 `native/main.swift`，第 5 步拆成多个文件后要改成目录；`:31` 的注释里列的事件名要跟着换。
- `src/app/e2e.mjs:84-88`：合成的热键事件换成新事件。

**preload**（`src/preload/preload.cjs`）

- `:35` `onHotkeyChanged`、`:93` `setHotkey`、`:97` `captureHotkey`、`:98` `onOnboardingHotkey`：参数从键 id 换成动作 id 加组合；新增录键的开始、结束、`recording` 推送，以及"恢复默认"。

**设置**（`src/storage/settings.mjs`）

- `:26-47` 的键表、`HOTKEY_IDS`、`hotkeyName`、`hotkeyKeycap`（后者全仓无人调用）：删掉。旧 id 对照只留在 `src/hotkeys/legacy.mjs` 一处。
- `:81-90` 的 `hotkey` 项：删掉，换成 `src/hotkeys/settings.mjs` 按动作目录生成的 `hotkey.<动作>` 各项。框架补三样通用的东西：设置项自带的说明 `describe`、命令行认的旧名字 `legacyName`、写入前的 `check`（5.2）。换算和回滚见 5.9。
- `src/storage/legacy.mjs`：加同步的 `migrateLegacySettings`，App 和命令行两个入口都在第一次读设置前调（5.9）。

**渲染层**

- `src/renderer/shared/i18n.mjs:34-35` 的 `keycapOf(id)`：改成按组合格式化，4 个调用方（悬浮条、首页、历史页、引导页）跟着改。
- `src/renderer/bar/bar.mjs:148-153` 的 `INPUT_EVENTS`：按绑定分发。
- `src/renderer/bar/bar-view.mjs:44-62`：提示里的 `{key}` 从一个键帽变成一组键帽；`{esc}` 改成"取消"动作当前绑定的键帽。
- `src/renderer/hub/settings.mjs` 和 `hub.html` 的热键下拉框：换成按动作目录逐行画的录键控件（5.2）。`docs/desktop-ui-spec.md:63` 写着"下拉框用于快捷键"，要补一条录键控件的规范。
- 引导页"测快捷键"一步（`src/renderer/onboarding/onboarding.mjs`、`onboarding.html:133-152`）：大键帽可能要画两颗；测试仍走真实的匹配路径，"换个键"改成录键（5.6）。

**命令行**

- `src/cli/commands/config.mjs:164-179` 的 `set`、`unset`：不用改，`hotkey.<动作>` 是普通设置项；旧名字 `hotkey` 由框架的 `legacyName` 认。
- `src/cli/commands/config.mjs:80-96` 的 `LIVE` 表：按动作目录给每个 `hotkey.<动作>` 加一项，命令是 `reload-hotkeys`。换键只要重发 `bind`，不必重启后台；旧后台不认这条命令时照 `applyLive` 现有的退路处理。
- `src/cli/render/status.mjs:81-83`、`92-103`：`hotkeyTitle` 换成格式化函数；`pendingSettings` 不用改，它本来就按设置名逐项比。
- `src/cli/render/settings.mjs:29-45`：说明优先用设置项自带的 `describe`；热键项不列可选值，改成提示"任意组合，见 README"。
- `cli.config.hintSet/hintUnset` 的示例：`hintSet` 现在在 Windows 上写的是非法值 `fn`（`zh-CN.mjs:1157`，`en.mjs:1215`），新格式下一并改掉；`hintUnset`（`zh-CN.mjs:1158`，`en.mjs:1216`）教的 `config unset hotkey` 换成 `config unset hotkey.dictate`。

**文案与文档**

- 文案：`hotkeys.<id>.*` 改成 `keys.<code>.keycap/name`；新增每个动作的名字 `actions.<动作>.name`、热键设置项共用的说明（5.2），以及录键控件、冲突、保留键的提示。
- 带热键参数的句子，参数从一个键帽变成一组：`bar.recording/recordingNoEsc` 的 `{key}`（`zh-CN.mjs:284-285`，`en.mjs:294-295`）、`bar.helperStopped` 的 `{hotkey}`（`zh-CN.mjs:292`，`en.mjs:302`）、`tray.ready`（`zh-CN.mjs:296`，`en.mjs:306`）、`history.empty`（`zh-CN.mjs:582`，`en.mjs:596`）、`onboarding.try.placeholder`（`zh-CN.mjs:878`，`en.mjs:910`）、`cli.status.ready`（`zh-CN.mjs:1303`，`en.mjs:1374`）。不带参数但要改说法的：`settings.describe.hotkey`（`zh-CN.mjs:87`）、`onboarding.hotkey.no/switchTo`（`zh-CN.mjs:868-869`）。
- 文档：`docs/implementation-notes.md:9-11`（"用法上照着原版的地方"）和 `:278`；`docs/development.md:82, 114`；`docs/desktop-ui-spec.md:63`。
- README（中英同号）：`:100`、`:102` 用法；`:133` 引导页截图；`:426` 设置表；`:442` 可选值；`:449` 环境变量；`:472` 权限说明。
- 截图：引导页"测快捷键"的截图在 README 和官网都用到（`docs/media.json:27, 97` 的 `onboarding-hotkey.*`，`website/src/sections/Setup.jsx:14`），由 `website/scripts/readme-media.mjs` 拍；悬浮条、首页的截图带键帽，界面改了要重拍。

### 3.4 和组合键冲突的现有行为

1. **"热键按着时来了别的键就悄悄取消"**（`machine.mjs:59-62`；`docs/implementation-notes.md:10`）。若同时绑了 `A` 和 `A+B`，按下 `A` 时已经 `START` 开了麦克风（`machine.mjs:40-45`），`B` 到来时只会走取消。要么禁止前缀共享，要么做升级。
2. **由谁判定组合完成**。现在帮手只报单键。放在帮手里，帮手只报绑定 id，最能守住隐私约定；放在主进程或状态机里，帮手就得报每个键。
3. **修饰键 + 修饰键**。mac 上第二个修饰键的 flagsChanged 键码对不上，现在直接报 `other_key`（`main.swift:130-133`）。
4. **macOS 看不到普通键的松开**（掩码里没有 keyUp，`main.swift:157`），也吞不掉普通键（只听 tap，`main.swift:160`）。
5. **esc 是保留键**。mac 靠"截取 tap 后建、排在前面"保证它吞掉的 esc 不被只听 tap 当成别的键（`main.swift:342`；这是仓库注释的说法，Apple 文档原文未找到，未验证）；Windows 靠 `onKey` 先处理 esc（`keys.go:85-90`）。
6. **Windows 掩码只对右 Alt 生效**（`keys.go:98`）。
7. **自动重复**：Windows 只对热键滤了重复（`keys.go:92-95`）；mac 普通键要看 `keyboardEventAutorepeat`（截取 tap 已用到，`main.swift:231` 附近）。
8. **fn 标志位**：方向键等事件也带 fn 位，所以现在先比键码（`main.swift:129`）。允许"fn + 别的键"时，不能用这个标志位判断 fn 按着没有。
9. **设置跨系统**：Mac 和 Windows 的旧 id 不重叠，Mac 的 `settings.json` 拿到 Windows 上 `parse` 会抛错，App 起不来（`settings.mjs:86`）。目录可以整体搬家（issue #10），新格式最好跨平台通用。是否真有跨系统搬目录的用户，未验证。新方案的写法两个系统通用，本系统绑不了的组合在下发前退回默认并提示，App 照样起得来（5.2）。
10. **和原版的细小差异**：我们的 `LONG_HOLD` 不看阶段，STARTING 阶段按满 600 ms 也会取消（`machine.mjs:64-66`）；原版在麦克风初始化期间不接长按。这一条没有测试覆盖。与本次重构无关，记在附录 A。

### 3.5 钉住现有行为的测试

改了行为要跟着改的测试，按文件列出（条数取自分路笔记 02）：

- `native/windows/keys_test.go` 9 条全部相关：按下松开各报一次、滤自动重复、`other_key` 只报一次且不带键名、右 Alt 插掩码、AltGr 假 Ctrl、esc 截取、点击。
- `native/windows/protocol_test.go` 4 条；`native/windows/e2e.ps1` 真机脚本（`--key right_ctrl`）。
- `test/renderer/bar/machine.test.mjs` 16 条，其中"热键加别的键 = 悄悄取消"在 `:53`。
- `test/renderer/bar/bar-view.test.mjs` 8 条中 4 条钉了"键名是一个 `{key}` 片段"。
- `test/app/helper.test.mjs` 7 条；`test/storage/settings.test.mjs` 约 9 条（含"`caps_lock` 是非法值"这类反例，新方案下要换反例）；`test/i18n/catalogs.test.mjs`、`test/i18n/i18n.test.mjs`；`test/cli/main.test.mjs` 约 12 条；`test/cli/render/*`。
- 两点现状：Go 单测和 `e2e.ps1` 都不在 `npm test` 里（`package.json:43-46`），仓库也没有 CI；Swift 小帮手没有单测。

---

## 4. 两个平台上的做法和坑

### 4.1 macOS

**机制：继续用 CGEventTap**

| 接口 | 单独修饰键、分左右、Fn | 能否吞键 | 权限 | 结论 |
| --- | --- | --- | --- | --- |
| `CGEventTapCreate` | 能（flagsChanged + 键码 + 设备相关标志位） | 主动式能，只听式不能 | 只听：输入监控；主动：辅助功能 | 主干 |
| Carbon `RegisterEventHotKey` | 不能：必须有一个键码；左右之分 "Not supported on Mac OS X"（`SDK:HIToolbox/Events.h:115-117,128-130`）；修饰键可以传 0，能注册单独的 F5（`SDK:HIToolbox/CarbonEvents.h:15450-15454`） | 系统自己吞 | 用 `GetEventDispatcherTarget()` 注册时不要权限（AltTab 的注释） | 不作主路；用来吞单个 F 键，并在安全输入期间顶替 |
| `NSEvent.addGlobalMonitorForEvents` | 能看到 flagsChanged | 不能："you cannot modify or otherwise prevent the event from being delivered"（`SDK:AppKit/NSEvent.h:538-550`） | 辅助功能 | 不用 |
| Electron `globalShortcut` | 不能：加速键是"多个修饰键加一个键码" | 能 | — | 不用（https://www.electronjs.org/docs/latest/api/global-shortcut ） |

权限的分法：Apple DTS 写道 "`PostEvent` and `ListenEvent` are different services"，主动 tap 对应"辅助功能"，只听 tap 对应"输入监控"（https://developer.apple.com/forums/thread/735204 ）。现在两项权限都已经要了（贴字和截 esc 需要辅助功能），新方案不增加权限。头文件说 HID 层 tap 只有 root 能建（`SDK:CoreGraphics/CGEvent.h:269-270`），但 Typeless 和 AltTab 都以普通用户建了 HID 层主动 tap，这条说法已经过时；我们不需要 HID 层。

**tap 的布置**

- 层级：session 层（`.cgSessionEventTap`），和现在一致。AltTab 在注释里记录了一次教训：一直开着的 HID 层主动 keyDown tap 弄坏了第三方输入法（`alt-tab-macos@240e3ff src/events/KeyboardEvents.swift:16-19`，issue #5766）。
- 只听 tap 常开：掩码 flagsChanged、keyDown、keyUp。
- 吞键 tap 按需打开，平时关着。打开条件：截取中；或录键中（5.6）；或某个"修饰键 + 普通键"绑定的修饰键正按着；或还有吞了按下、没吞松开的键。这是现有截取 tap 的 `captureWanted` 写法（`main.swift:195` 附近）的推广。理由有三：
  - 主动 tap 挡在每一次按键的路上，回调一慢全系统打字都卡，系统会补发 `kCGEventTapDisabledByTimeout`（`SDK:CGEventTypes.h:128-131`；超时是几秒没有公开文档）。
  - 2026-09 有报告：session 层、`.defaultTap`、事件原样放行的 tap，在辅助功能权限被撤销时整机键盘鼠标冻住，只能强制重启（https://developer.apple.com/forums/thread/844416 ）。
  - 现有代码注释的原则就是"平时关着：不在任何按键和点击的必经之路上"（`main.swift:279`）。
- 谁来打开（V1，2026-10-21 实测）：不能由只听 tap 打开。只听 tap 的回调是事后异步送到的，从修饰键事件发出到吞键 tap 打开要 0.3–9.5 ms（中位数约 0.35 ms），这段时间里按下的普通键会漏出去。合成按键每档 100 次，修饰键和空格的间隔与漏出比例：0 ms 漏 69%，0.1 ms 漏 31%，0.25–0.5 ms 漏 11%–18%，1 ms 漏 9%，2 ms 漏 1%，5 ms 起不漏。人"同时按"真按得出这种间隔：真键盘按右 Option+空格 13 次，3 次间隔不到 0.5 ms，2 次在 2.5–3.8 ms。把只听 tap 挪到 HID 层能抢到一点提前量，但 0–2 ms 仍漏 1%–2%，打开耗时最长 12 ms，同样不行。
- 由触发 tap 打开（D3 改定）：存在"修饰键 + 普通键"绑定、且有辅助功能权限时，另建一个**触发 tap**。它是主动 tap，掩码只有 flagsChanged，常开，事件一律放行。主动 tap 的回调是同步的，系统等它返回才往下送事件；回调里解出修饰键，需要时打开吞键 tap，于是紧跟的普通键一定先经过吞键 tap。实测结果：
  - 不漏：合成 800 次（间隔 0–10 ms）0 漏，真键盘 13 次 0 漏。
  - 不拖慢：修饰键事件送到前台应用的时间看不出变化，中位数 7.8 ms 对 7.7 ms。这 7 ms 多是系统里别的环节本来就有的，没有被测进程时也是 6.6 ms。
  - 回调里打开吞键 tap 的那次 `tapEnable` 中位数 50 µs、p99 1.4 ms，只在绑定用到的修饰键按下、松开时才发生。
  - 字母键不经过它，只有修饰键事件经过，包括打大写字母时的 Shift。默认配置（单按右 Option）没有这类绑定，不建触发 tap，和现在一样。
- 触发 tap 的代价：多一个常开的主动 tap。权限撤销时冻住整机的风险（上面第二条理由），现在的版本只在听写那几秒才有，改成这样后，绑了这类组合的用户会一直有。缓解：小帮手监听辅助功能权限的变化（`com.apple.accessibility.api` 分布式通知，外加每秒查一次 `AXIsProcessTrusted()`），一旦权限没了，立刻 `CFMachPortInvalidate` 掉所有主动 tap，退回只听。论坛报告里出事前没有任何停用通知，这样做救不救得回来未验证；验证会冻住本机，只能在随时可以重来的虚拟机里做（V26）。Typeless 常开 HID 层主动 tap，同样有这个风险。
- 线程：原计划把所有 tap 挪到同一条独立线程的 run loop 上（AltTab 就是单独一个键盘线程，`KeyboardEvents.swift:249-252`），理由是贴字要先快照剪贴板，遇到大图会很久，主线程卡住时同步的触发 tap 也跟着卡。**10-21 实测后改定：tap 留在主线程。**独立线程上，从触发 tap 的回调里打开吞键 tap 生效得晚：右 Option+空格合成 200 次（间隔 0–5 ms）漏了 57 个空格；同一份代码只把 run loop 换回主线程，200 次 0 漏；独立线程上让吞键 tap 一直开着，100 次 0 漏，说明漏在"打开"这一步。贴字也挪不出主线程：NSPasteboard 只能在主线程用（文档没写，Apple 回复过开发者，https://mjtsai.com/blog/2026/08/03/nspasteboard-crashes-when-handling-file-promises/ ）。代价照实记着：剪贴板里有大图时，贴字快照那一下修饰键会慢，回调超时的话系统会停掉触发 tap，收到停用通知后重新打开。快照到底多慢未测。

**三个 tap 怎么分工：一个匹配器，按事件去重**

吞键 tap 后建，排在只听 tap 前面（`main.swift:342` 的注释）。V8 已验证：后建的排在前面，它吞掉的键只听 tap 0/80 收到；反过来建是 80/80。触发 tap 最后建，排在最前。它吞掉的事件，只听 tap 根本收不到。所以"只听 tap 匹配、吞键 tap 只管吞"行不通：组合的第二个键被吞了，匹配器看不到，`binding down` 报不出来；被吞的 keyUp 也到不了，这个键会一直留在按住集合里。而且要决定吞不吞，本来就得先知道匹配结果。

做法如下：

- 小帮手里只有一个匹配器实例。三个 tap 挂在同一条键盘线程上，回调串行执行，匹配器不需要加锁。
- 三个 tap 都把事件交给匹配器。修饰键事件最先到触发 tap（建了的话）。吞键 tap 开着时，它先拿到事件，当场得到匹配结果，按结果决定吞不吞。放行的事件随后到达只听 tap，匹配器按"时间戳 + 事件类型 + 键码"认出是同一个事件，跳过，不会算两次。吞掉的事件只听 tap 收不到，也不需要收到。吞键 tap 关着时，只有只听 tap 喂匹配器。
- 吞键 tap 开着时，掩码要包含 flagsChanged、keyDown、keyUp，保证组合涉及的每个事件都先经过它。
- 不选"吞键 tap 开着时只听 tap 一律不喂"：打开的那一刻，已经越过吞键 tap 位置、还没到只听 tap 的事件会漏记。也不选"给放行的事件打标记"：要改动送给前台应用的事件，`kCGEventSourceUserData` 可能被别的应用拿来认自己合成的事件。
- 去重依赖"同一个事件先后经过几个 tap 时，时间戳不变"。V8 已验证：放行的事件每个 tap 各收到一次，（时间戳，类型，键码）合成 160/160、真键盘 71/71 一致，只听 tap 这边没有重复；排在前面的回调总是先跑。
- 共用样例要有这一条：吞键 tap 开着时按 `AltRight+Space`，同一个事件送两遍；绑定按下只报一次，Space 的按下、松开都被吞，全部松开后集合为空。

**单个普通键（F 键等）怎么吞**

上面吞键 tap 的打开条件都不包括"单独一个普通键"。绑了 `F13` 或 `F5` 时，按下那一刻吞键 tap 是关着的，F 键会漏给前台应用（比如 F5 刷新浏览器）。下文规定录到 `Fn+F5` 也存成 `F5`，所以 Mac 上所有 F 键绑定都是单键。分路笔记 03 §3.2 写过这种情况"只能常开，或者改用 Carbon 注册"，第一版汇总时漏掉了。三种做法：

| 做法 | 好处 | 代价 |
| --- | --- | --- |
| ① 有单键绑定时吞键 tap 常开，掩码只含 keyDown/keyUp，回调 O(1) 查表 | 只有一套机制 | 主动 tap 一直挡在每次按键的路上，正是上文要避免的；撤销辅助功能权限时整机冻住的风险也一直在 |
| ② 单个 F 键改用 Carbon `RegisterEventHotKey`（修饰键传 0） | 系统自己吞；F 键没有左右之分，Carbon 不分左右在这里没有代价；不在打字路径上；不需要辅助功能权限；据 Handy 的说法安全输入下照样能用 | 两套机制并存；小帮手必须改用 NSApplication 跑（`setActivationPolicy(.prohibited)`，不出程序坞图标）。V19 实测：只跑 `RunLoop` 时键照样被系统接走，回调却一次都不触发（合成 5 次：0 次触发，0 次到达应用），比收不到更糟；改用 NSApplication 后合成 5/5、真键盘 3/3 触发。MacBook 上按 fn+F5 时事件带 fn 位，修饰键传 0 的注册还触不触发，未验证（V21） |
| ③ 第一版 Mac 不开放单键绑定 | 最简单 | 少了 F13 这类最不打扰打字的选择 |

定 ②（V19 通过，前提是 NSApplication 跑法），不选 ①。Carbon 回调只负责"吞"和在安全输入期间"报"，平时的按下松开仍以只听 tap 看到的为准：AltTab 的注释说被动 tap 照样能看到 Carbon 热键的 keyDown（`KeyboardEvents.swift:13-14`），本机已验证（合成 5/5）。系统匹配 Carbon 热键，是在 session 层所有 tap 之后、annotated session 层之前，所以 session 层的 tap 先看到这个键。真机清单加一条：绑 F13、F5 后在浏览器里按，看前台应用有没有收到。

**另一种布置：带普通键的绑定全部走 Carbon**

AltTab 就是这么分的：普通键快捷键用 Carbon `RegisterEventHotKey` 注册（`alt-tab-macos@240e3ff src/events/KeyboardEvents.swift:188-204`），常开的被动 tap 只用来看修饰键（同文件 `:13-14`）。照这个思路，单按修饰键、修饰键 + 修饰键走只听 tap；修饰键 + 普通键、单个 F 键、截取中的 esc 都走 Carbon。Carbon 分不了左右，可以在 Carbon 回调里用只听 tap 记下的设备位核对，核对不上就当没按。

- 好处：不需要主动 tap，没有 V1 的竞态，也没有权限撤销冻住的风险；安全输入下照常可用；不需要辅助功能权限，`bound` 回执里的 `needs_trusted` 基本用不上。
- 代价：Carbon 会把另一侧的同一组合也吞掉，核对不上时只能"当没按"，按键已经到不了前台应用。例如绑 `MetaRight+KeyK`，左 ⌘K 在所有应用里都会失灵；绑 `AltRight+Space`，用左 Option 打不换行空格也会失灵。实测：注册 ⌥Space 后按左 Option+空格，5/5 触发，空格 0/5 到达应用。
- 本文的取舍：修饰键 + 普通键平时走"触发 tap + 吞键 tap"，Carbon 只用于单个 F 键和安全输入期间的顶替（见下文"安全输入"）。主人 2026-10-21 看过 V1 的结果后选了这条，没选全部走 Carbon（分不了左右），也没选砍掉这类组合。
- 停用通知：两种停用都处理；"该开着才重开，不该开的绝不再关一次"（现有注释记录过自己关 tap 也会收到通知、再关一次会无限循环，`main.swift:224-227`）。重新打开后清空按住集合，并对按着的绑定补报松开。
- 锁屏、快速切换用户时不处理热键并清空状态（VoiceInk 的做法，`VoiceInk@22e5ec5 …/UserSessionInputPolicy.swift:5-31`；VoiceInk 是 GPL-3.0，只借鉴设计，不抄代码）。
- 自己合成的事件：贴字时发的 ⌘V 会经过自己的 tap（`main.swift:89-96`）。在合成事件上打 `kCGEventSourceUserData` 标记，匹配器跳过（`SDK:CGEventSource.h:166-170`、`CGEventTypes.h:355-356`）。

**左右修饰键**

- 键码：Command 0x37、Shift 0x38、CapsLock 0x39、Option 0x3A、Control 0x3B、RightCommand 0x36、RightShift 0x3C、RightOption 0x3D、RightControl 0x3E、Function 0x3F（`SDK:HIToolbox/Events.h:271-280`）。
- 设备相关标志位：左 Ctrl 0x1、左 Shift 0x2、右 Shift 0x4、左 ⌘ 0x8、右 ⌘ 0x10、左 ⌥ 0x20、右 ⌥ 0x40、右 Ctrl 0x2000（`SDK:IOKit/hidsystem/IOLLEvent.h:253-261`）。
- 建议：每个 flagsChanged 事件都从 flags 里解出"现在按着哪几个修饰键"，不靠"按一下翻转一次"记账，漏一个事件也能自己纠正。键码只用来判断这次是哪个键引起的。
- 风险：有些第三方键盘或改键软件的虚拟键盘可能不带设备位，这时要退回按键码翻转。具体哪些键盘不带，未验证（接几把第三方键盘记录 flags 原值）。

**Fn / 地球仪键**

- 只能从键码 63 的 flagsChanged 推断 fn 是否按着。方向键、F 键等事件本身带 fn 位（`main.swift:129` 的注释），不能拿它判断。
- 地球仪键会不会产生键码 179：Typeless 把 179 也当 `Fn`，但 SDK 的 kVK 表里没有 179（`SDK:HIToolbox/Events.h:197-328`），未验证（在 2021 年以后的 Apple 键盘上用只听 tap 记录全部事件）。
- 外接键盘：大多数第三方键盘的 Fn 由固件处理，系统看不到。W3C 规范说 `Fn` "is typically a hardware key that does not generate a separate code"（https://www.w3.org/TR/uievents-code/ ）。建议：用户选了 Fn 却从没收到过键码 63 时提示"这把键盘的 fn 系统看不到"。
- 系统动作：系统设置"按下地球仪键时"可选切换输入法、表情与符号、开始听写、无操作（https://support.apple.com/guide/mac-help/change-keyboard-settings-kbdm162/mac ）。存在 `com.apple.HIToolbox` 的 `AppleFnUsageType`（0 无操作、1 切换输入法、2 表情、3 听写；出处是社区整理的 nix-darwin 模块，不是 Apple 文档：https://github.com/nix-darwin/nix-darwin/blob/master/modules/system/defaults/hitoolbox.nix ）。本机没有这个键，此时系统默认是什么行为未验证。
- 吞掉键码 63 的 flagsChanged 能不能压住系统动作，未验证（设成"表情"，测试程序对它返回 nil，看面板还弹不弹）。Wispr 说 "assigning Fn alone prevents its usual system action"，但它的排障页又让用户手动改成"无操作"。建议：不吞 fn，只读这个设置（`CFPreferencesCopyAppValue`，只读），用户绑了 Fn 且设置不是"无操作"时在设置页提示他去改。不替用户写系统设置。
- MacBook 上第一排默认是媒体功能时，按 fn 再按 F5 才是 F5。所以匹配时，fn 按着又按 F 键，把 fn 从集合里去掉，当成单独的 F 键；录到 `Fn+F5` 也存成 `F5`。fn 加方向键、删除、回车会变成别的键（Home、向前删除等），录到时拒绝。fn 加方向键录到的具体键码未验证。

**吞键规则**

- 修饰键的 flagsChanged 不吞。VoiceInk 对 flagsChanged 一律不吞（`VoiceInk@22e5ec5 …/ShortcutMonitor.swift:268, 286`）。吞了也挡不住后面 keyDown 携带的修饰位，只会让前台应用的修饰键状态和实际不一致；这一点是推断，未验证（吞掉右 ⌘ 的 flagsChanged 再按 X，看前台应用是剪切还是打出 x）。
- 修饰键 + 普通键：普通键的 keyDown、自动重复、keyUp 都吞；只有吞了按下的才吞对应的松开。现有截 esc 的代码就是这个套路（`main.swift:229-249`）。不吞的话，⌥Space 会往输入框里打一个不换行空格。
- 单独的 F 键：也要吞。

**安全输入（密码框、终端的安全键盘输入）**

- 开着时，keyDown 和 keyUp 收不到，flagsChanged 照常收得到。两家独立实现的注释一致：AltTab "SecureInput does not block `.flagsChanged` … `.keyDown` is filtered out at the system level for both"（`KeyboardEvents.swift:218-219`）；Handy "keyed shortcuts (e.g. Option+Space) die silently while modifier-only shortcuts keep working"（`Handy@93c9ee0 src-tauri/src/secure_input.rs:3-7`；复现记录 https://github.com/cjpais/Handy/issues/1578 ）。本机已复现（V20）：两种开法，对照进程调 `EnableSecureEventInput()`，以及 iTerm 的 Secure Keyboard Entry。两种开法下，tap 都收不到 keyDown、keyUp（合成 10 次、真键盘 9 次，全都收不到），flagsChanged 照常收到。
- 影响：单按修饰键、修饰键 + 修饰键照常可用；修饰键 + 普通键、单独 F 键、esc 取消、"按着热键又按了别的键要取消"这几条都会失灵。还有一个连带后果：切进密码框的那一下（例如 Tab）按下收到了、松开收不到，这个键会一直留在按住集合里，之后连单按修饰键的听写也凑不成精确匹配。对策见 5.3 第 8 条。
- 检测：每秒查一次 `IsSecureEventInputEnabled()`（任一进程开着就返回真，`SDK:HIToolbox/CarbonEventsCore.h:3044-3064`）。Handy 每秒轮询、持续 3 秒才算卡住（`secure_input.rs:132-135`），可以参考。
- 应对一，Carbon 顶替：Handy 在安全输入持续期间，把带普通键的绑定改由 Carbon 注册一份，录键时也这样顶替"取消"（`Handy@93c9ee0 src-tauri/src/secure_input.rs:9-17`，原文 "shadow-registers vulnerable *keyed* bindings through the Carbon-backed Tauri global-shortcut path, which is not affected by secure input"）。我们照做：安全输入开着时，修饰键 + 普通键、单个 F 键、截取中的 esc 由 Carbon 注册；Carbon 分不了左右，回调里用只听 tap 记下的设备位核对（flagsChanged 照常收得到），核对不上就当没按。Handy 遇到同样问题时是放宽成两侧都认（同文件 `:31-37` 的 `degraded_bindings`）。安全输入关掉后注销。V19、V20 已通过：安全输入开着时 Carbon 照常触发，合成 F13、⌥Space 各 5/5，真键盘 ⌃⌥⌘K 3/3。
  已知限制（10-23 审查查出）：语音翻译、划词默认绑着右⌥空格、右⌥回车，安全输入开着时 Carbon 把左⌥空格、左⌥回车也一起吞掉，核对不上就丢了，到不了前台应用。终端里 Option 当 Meta 时左⌥回车是换行，这段时间按不出来。只在安全输入开着时（终端开了"安全键盘输入"、密码框）出现，他那台 Terminal、iTerm2 的安全键盘输入都关着。要改得在回调里把核对不上的那一下补发给前台应用，安全输入下补发的键进不进得去、会不会再被 Carbon 截住，要拿真键盘先试。
- 应对二，提示：Carbon 注册失败时，在悬浮条或菜单栏提示"有应用开着安全输入，组合键暂时用不了"。
- 安全输入从开到关时，清掉按住集合里的非修饰键（5.3 第 8 条），它们的松开多半丢了。

**键码与键名**

- kVK 本来就是物理位置（`SDK:HIToolbox/Events.h:180-195`），和 W3C code 一一对应。
- ISO 键盘上，macOS 会把 0x0A 和 0x32 两个键码对调（Mozilla 的说明：https://reviewboard.mozilla.org/r/116012/diff/ ）。录键和下发都走同一张表，在同一台机器上能自洽，只影响键帽显示和跨机器搬配置，优先级低。
- JIS 键盘的英数、かな（0x66、0x68）本身就是系统快捷键：本机 `CopySymbolicHotKeys` 里有这两条且是启用的（分路笔记 03 §7.2 的探针）。绑它们会和切换输入法冲突。
- 键帽上字母键的字：用 `TISCopyCurrentASCIICapableKeyboardLayoutInputSource()` 加 `UCKeyTranslate`。本机探针实测：拼音输入法下"当前输入源"没有布局数据，"当前布局"会把分号显示成全角"；"，只有 ASCII 布局这条路正常（分路笔记 03 §7.3）。`TISGetInputSourceProperty` 只能在主线程调用（`KeyboardShortcuts@772133d …/Shortcut.swift:687` 的注释）。

**冲突检测**

- 用 `CopySymbolicHotKeys()`，不读 plist。本机探针：API 返回 230 条（171 条启用），而 `com.apple.symbolichotkeys` 的 plist 里只有用户改过的 21 条，两边的修饰位编码也不同（分路笔记 03 §8.1；`SDK:HIToolbox/CarbonEvents.h:15526-15601`）。比对时只看启用的条目，先去掉合成的 Fn 位（KeyboardShortcuts、MASShortcut 都这么做）。
- 这个 API 只覆盖"修饰键 + 键"。单独修饰键类的系统行为另写规则：fn 读 `AppleFnUsageType`；系统听写的"连按两下 ⌘"之类设置存在哪里未验证。
- 别的应用注册的热键没有接口能列出，只能接受。
- session 层主动 tap 能不能抢在 ⌘Space 这类系统快捷键之前吞掉，未验证。AltTab 的说明是系统的 ⌘⇥ 会在任何应用级热键之前被 Dock/WindowServer 吃掉（`NativeHotkeyResolverSpecs.md:5-9`）。第一版直接不允许绑系统已占用的组合，就绕开了这个问题。

**不能绑或第一版不开放的键**

| 键 | 原因 |
| --- | --- |
| 两个普通键 | 第一个键按下时还不知道第二个会不会来，要么漏出去，要么扣住再补发，复杂度高 |
| 单独的打字键（字母、数字、标点、空格、回车、Tab、删除、方向键） | 会劫持打字 |
| esc | 留给"取消" |
| CapsLock | 常用的 `NX_ALPHASHIFTMASK` 反映"锁没锁"，不是"按没按"（`IOLLEvent.h:241`）。同一个头文件里还有两个无状态位 `NX_ALPHASHIFT_STATELESS_MASK 0x01000000`、`NX_DEVICE_ALPHASHIFT_STATELESS_MASK 0x00000080`（`:249`、`:260`），看名字反映的是物理上按没按，有没有用未验证（V7）；系统还可设成用它切输入法 |
| 媒体键、亮度键 | 走 `NX_SYSDEFINED` 事件，位布局没有公开文档（`IOLLEvent.h:113, 153, 176-186`） |
| 听写（麦克风）键 | tap 能否看到未验证；对听写类应用有吸引力，值得单独拿一台新款 MacBook 验 |
| 外接键盘上的 Fn | 系统看不到 |

### 4.2 Windows

**机制：继续用 `WH_KEYBOARD_LL`**

| | `RegisterHotKey` | `WH_KEYBOARD_LL`（现用） | Raw Input |
| --- | --- | --- | --- |
| 只按修饰键 | 不能，必须有一个 vk | 能 | 能 |
| 分左右 | 不能：`MOD_ALT` 是 "Either ALT key must be held down" | 能 | 能 |
| 松开事件 | 没有，只有 `WM_HOTKEY` | 有 | 有 |
| 能否吞键 | 只吞登记过的组合 | 能，回调返回非零 | 不能 |
| 被别的程序占用 | 失败，错误码 1409 | 不冲突，后装的钩子先拿到 | 不冲突 |
| 超时被卸 | 无 | 有，静默卸掉 | 无 |

出处：https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-registerhotkey 、https://learn.microsoft.com/en-us/windows/win32/winmsg/lowlevelkeyboardproc 、https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-rawinputdevice 。Electron `globalShortcut` 在 Windows 上就是 `RegisterHotKey`，而且只拼了 `MOD_SHIFT|MOD_CONTROL|MOD_ALT`，没有 `MOD_WIN`（`chromium@main ui/base/accelerators/global_accelerator_listener/global_accelerator_listener_win.cc:95-110`）。

**键的身份**

- 低级钩子里的 vkCode 本身分左右（`VK_LSHIFT 0xA0` … `VK_RMENU 0xA5`，Win 键 0x5B / 0x5C），而且修饰键的 vk 和布局无关。现有代码直接比较 0xA3、0xA5。仓库里的 Windows 记录只有 `e2e.ps1` 用 `SendInput` 注入的右 Ctrl（`native/windows/e2e.ps1:79`），真按右 Ctrl、右 Alt 的记录没找到，未验证（`docs/development.md:219` 那条是 Mac 上从源码跑、用右 Control 当热键，不算）。别的程序用 `SendInput` 注入不分左右的 `VK_CONTROL` 等时，钩子收到什么，未验证。遇到 0x10/0x11/0x12 时用 `MapVirtualKeyW(..., MAPVK_VSC_TO_VK_EX)` 换算。
- **修饰键按 vk 认，非修饰键按扫描码 + 扩展位认。** 非修饰键要按物理位置，用 `scanCode | (LLKHF_EXTENDED ? 0xE000 : 0)`，正好对上 Chromium 表的 Windows 一列。扫描码"identifies the key pressed regardless of the active keyboard layout"，vk 是布局翻译后的结果（https://learn.microsoft.com/en-us/windows/win32/inputdev/about-keyboard-input ）。修饰键不用扫描码，是因为右 Shift 带不带扩展位说法不一：微软文档说右 Shift 不是扩展键（分路笔记 04 引的就是这一处），AutoHotkey 却把它定义成 `SC_RSHIFT 0x136 // Must be extended`（`AutoHotkey@0b8e6fa source/keyboard_mouse.h:124`）。真带了扩展位就会算成 0xE036，对不上 Chromium 表里 `ShiftRight` 的 0x0036。handy-keys、PowerToys 认修饰键也都用分左右的 vk（`handy-keys@e7d1b8e src/platform/windows/listener.rs:75`，`PowerToys@cf45de4 …/Shortcut.cpp:258-264`）。所以主进程下发修饰键时换成 vk，非修饰键换成扫描码，键表的 Windows 一列对修饰键另记 vk。真机上左右 Shift、左右 Ctrl 各带不带扩展位，记一次（V22）。
- 别的工具注入的事件可能扫描码为 0，这时用 `MapVirtualKeyW(vk, MAPVK_VK_TO_VSC_EX)` 补一个。PowerToys、AutoHotkey 注入的事件实际长什么样，未验证（`e2e.ps1` 里分"只带 vk""只带扫描码""两者都带"三种注入打日志）。
- NumLock 和 Pause 在 Chromium 表里分别是 0xE045 和 0x0045（`dom_code_data.inc:242, 228`），和微软文档对扩展位的描述要真机核对。第一版不开放这两个键（Pause 只有按下没有松开，PowerToys 文档也这么说），问题就绕开了。

**要滤掉的事件**

- AltGr 布局（德、法、波兰、英国等）按右 Alt 时，系统会补一个假的左 Ctrl，扫描码 0x21D（bit 9）。微软没有公开文档，AutoHotkey（`AutoHotkey@0b8e6fa source/keyboard_mouse.h:144-150`）、handy-keys（`handy-keys@e7d1b8e src/platform/windows/keycode.rs:140-147`）、QEMU 都这么认。新方案要在进按住集合之前丢掉。
- NumLock 打开时按着 Shift 按小键盘双功能键，驱动会生成假的 Shift 松开、按下，扫描码 0x22A、0x236，不带注入标记（AutoHotkey `keyboard_mouse.h:145-146`、`hook.cpp:96-130`）。开放 Shift 以后同样要丢掉。
- `VK_PACKET`（0xE7，注入 Unicode 字符用）不能绑；0xFF 是 Raw Input 里的假键和 PowerToys 的哑键，不能绑；0xE5（`VK_PROCESSKEY`，输入法改写后的值）不能绑，遇到时当"别的键"。低级钩子在微软拼音下看到的是原 vk 还是 0xE5，未验证。
- 自己注入的键：沿用 `dwExtraInfo = 0x53504B48` 记号放行（`win32_windows.go:80-82`）；别的程序注入的照常算。

**Win 和 Alt 的副作用：掩码键**

- Win 或 Alt 单独按下再松开、中间没有别的键，系统会弹开始菜单，或者激活前台窗口的菜单栏。对策是在中间插一个无效键，让系统以为是"Win/Alt + 某个键"。现在只有右 Alt 按下时插 0xE8（`keys.go:17-19, 98`）。
- 新规则：本次 Win 或 Alt 按住期间，只要有绑定触发、或者有事件被我们吞掉，就插一次掩码。**被吞的键松开时也算**：handy-keys 实测"F20↓ Win↓ F20↑ Win↑ with Win+F20 blocked opens Start"（`handy-keys@e7d1b8e src/platform/windows/listener.rs:755-790`）。
- Ctrl 或 Shift 按下，本身就会让之前按着的 Win、Alt 不再触发菜单（AutoHotkey `hook.cpp:2020` 的注释）。所以 `Ctrl+Win` 这类组合自带掩码，Wispr 也说 "Ctrl+Win suppresses the Start/Search action while that combination is held"。
- 插的时机：第 8 步起改成在回调里同步 `SendInput`（AutoHotkey 和 handy-keys 也是），注入的事件靠记号放行。10-22 补：赶上的事件是 Alt、Win 自己的按下时（单按右 Alt 就触发的语音输入），在它的回调里插，效果和先插掩码、再按 Alt 一样，等于没插，Windows 11 记事本照样选中菜单栏；手动在 Alt 按下之后再插就挡住了。改成这时只记着，等下一个键事件（别的键，或 Alt、Win 自己的松开）再插（`matcher.go` 的 `settleMask`、样例 `windows.json` 最后一条），`e2e.ps1` 用 UI Automation 看焦点查这一项。原来交回消息循环再插：消息循环先处理的是钩子回调（发来的消息排在投递的前面），点得快或者线程正忙时，Alt、Win 的松开可能抢在掩码前面。一次按住只插一次，Alt、Win 全松开再算下一次（`native/windows/matcher.go` 的 `settleMask`）。Win 键绑定点一下能不能挡住开始菜单，仍要真机试（第 12 步）。
- 0xE8 在微软 VK 表里仍标为 "Unassigned"（https://learn.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes ）。AutoHotkey 文档提醒，微软以后可能给未分配的码派用途，例如 0x07 从 1909 起被用来开 Game Bar（https://www.autohotkey.com/docs/v2/lib/A_MenuMaskKey.htm ）。另外 `keys.go:18` 的注释"AutoHotkey 用的也是它"不准确：AHK 的默认掩码键是左 Ctrl（`AutoHotkey@0b8e6fa source/globaldata.cpp:66-67`），0xE8 是文档推荐值。

**其他修饰键自带的系统行为**

- 切换输入语言或布局：左 `Alt+Shift` 在输入语言之间切换，`Ctrl+Shift` 在同一语言的几个布局之间切换（装了多个布局时），还有 `Win+Space` 等（https://support.microsoft.com/en-us/windows/keyboard-shortcuts-in-windows-dcc61a57-8ff0-cffe-9796-cb9706c75eec ）。中文用户同时装微软拼音和英文键盘时，最容易撞上的是左 `Alt+Shift`。这两个默认值以本机设置为准，未验证（V23：设置 → 时间和语言 → 输入 → 高级键盘设置 → 输入语言热键）。插掩码能否顺带挡住切换，未验证。
- 微软拼音单按 Shift 切换中英文，`Shift+Space` 切全角半角（https://support.microsoft.com/en-us/windows/microsoft-simplified-chinese-ime-9b962a3b-2fa4-4f37-811c-b1886320dd72 ）。单绑 Shift 时，每次开始、结束听写都会顺带切一次中英文。
- 连按五次 Shift 弹粘滞键提示（二手来源，微软原文未找到，未验证）。

**吞键规则**

- 整段吞：按下吞了，自动重复和松开都吞，按"这一次按下"记账，中途不改主意（现有规则，`keys.go:9`）。
- 修饰键不吞。按下放行、松开吞了的话，前台程序里这个修饰键会一直卡住。
- 组合里的普通键和单独的 F 键要吞。
- 钩子链：`SetWindowsHookEx` 总是把钩子装在链头（https://learn.microsoft.com/en-us/windows/win32/winmsg/about-hooks ），后装的先拿到事件。我们吞掉的键，排在后面的 PowerToys、AutoHotkey 就看不到；反之亦然。

**钩子的可靠性**

- 时限：回调超过 `LowLevelHooksTimeout`，"on Windows 7 and later, the hook is silently removed without being called. There is no way for the application to know whether the hook is removed"；Windows 10 1709 起最长 1000 ms（LowLevelKeyboardProc 页）。所以匹配必须在小帮手里，不能每个键问一次父进程。node-global-key-listener 就是每个事件回 Node 问一遍、等 30 ms，是反面例子。
- 先修 3.3 里的两处阻塞发送。
- 睡眠唤醒、解锁后重装钩子：先装新的再卸旧的，并校正修饰键状态（handy-keys：`listener.rs:54-60, 120-160`，注释写明 "Windows can silently drop LL hooks across a suspend"）。
- 漏掉的松开：Win+L 锁屏以后 Win 的松开到不了钩子；管理员窗口在前台时松开被 UIPI 挡掉（见下文）也一样。每次可能凑成组合的时刻，先用 `GetAsyncKeyState` 核对集合里的**修饰键**，再做匹配（5.3 第 8 条）；它查不准"触发本次回调的这个键"，查别的键是准的（OpenWhispr `windows-key-listener.c:83-97` 的注释）。被钩子吞掉的普通键不能这样核对：吞掉的按下不更新系统的按键状态，`GetAsyncKeyState` 永远读成松开，只能靠 10 秒清理（实施时改的，见 5.3 第 8 条）。NumLock 开着时驱动在小键盘键前插的假 Shift 松开（扫描码带 0x200；AltGr 布局上补的假左 Ctrl 松开同理）同样会让系统状态读成松开：记下来，补回来按下、或这个键真的按下松开之前不核对它。
- 看门狗（可选，未验证）：同一消息窗口注册 Raw Input（`RIDEV_INPUTSINK`）。Raw Input 不受钩子时限影响，它持续收到按键而钩子一个都没看到，就判定钩子没了，重装并报 error。需要真机验证"被别的钩子吞掉的键 Raw Input 还收不收得到"和先后顺序。不要用"定时注入一个键"当心跳，注入的键会进前台程序。

**UIPI：管理员窗口在前台时**

- 普通完整性级别的进程，低级钩子和 Raw Input 都收不到发往更高完整性窗口的输入。UIAccess 进程才能"read input for all integrity levels by using low-level hooks, raw input…"（https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-10/security/threat-protection/security-policy-settings/user-account-control-only-elevate-uiaccess-applications-that-are-installed-in-secure-locations ）。后果：任务管理器、管理员终端在前台时按热键没有任何反应，连提示都给不了。
- uiAccess 要求可信根证书签名，并且装在 `%ProgramFiles%` 或 `%WinDir%` 下（同一篇文档）。SpeakMore 两条都不满足：装在可以整体搬家的用户目录里；仓库里搜不到 `signtool` 等签名步骤，推断 Windows 包没有签名（未验证：在 exe 上跑 `Get-AuthenticodeSignature`）。
- 可选路线：① 照实提示，用 `SetWinEventHook(EVENT_SYSTEM_FOREGROUND)` 监听前台切换，前台是提升过的窗口时提示；判断提升可以复用 `win32_windows.go:166-202` 的 `processElevated`。② 可选"以管理员身份运行小帮手"（PowerToys 的做法，https://learn.microsoft.com/en-us/windows/powertoys/administrator ），但每次弹 UAC，或者要用计划任务拉起，安装卸载都变复杂。③ uiAccess，和"一次删干净、可整体搬家"冲突。建议第一版只做 ①（D8）。

**绑不了或必须禁止的键**

| 键 | 原因 | 出处 |
| --- | --- | --- |
| Ctrl+Alt+Del | 安全注意序列，Winlogon 抢先登记 | https://learn.microsoft.com/en-us/windows/win32/secauthn/initializing-winlogon |
| Win+L | 保留给系统；PowerToys 编辑器判为非法 | PowerToys `EditorHelpers.cpp:138-155` |
| Win+G | 常常照样打开 Game Bar | https://learn.microsoft.com/en-us/windows/powertoys/keyboard-manager |
| Fn | 多数键盘在固件里处理 | 同上 |
| Pause | 只有按下事件 | 同上 |
| Copilot 键、Office 键 | 实际发出三个或四个键 | 同上 |
| Win + 大多数字母、数字、Tab、方向键 | 系统占用；Win+H 是系统听写 | Windows 快捷键页 |
| 0x07、0xE8、0xFF、0xE7、0xE5 | 系统或我们自己占用 | 见上文 |

**冲突探测**

- 对"修饰键 + 普通键"，可以用 `RegisterHotKey(nullptr, id, mods, vk)` 试着登记，失败且错误码是 `ERROR_HOTKEY_ALREADY_REGISTERED` 就算冲突，成功立刻注销（PowerToys `src/runner/hotkey_conflict_detector.cpp:334-380`）。它不分左右，也查不到用钩子实现的别家热键。低级钩子和 `RegisterHotKey` 谁先拿到按键，未验证。
- 再配一张按 code 写、左右都列的静态表。
- AltGr 布局上，右 Alt 就是 AltGr；用户一打 AltGr 字符，热键会先触发再被打断取消，悬浮条闪一下。这是现有设计已有的问题（PowerToys 对 Ctrl+Alt+键也亮 AltGr 警告，`ShortcutControl.xaml.cs:566, 703`）。在设置页说明即可。

**键名显示**

- 修饰键、功能键、导航键用我们自己的文案表，不随布局变。
- 字母数字键的字：`GetKeyNameTextW` 返回的名字随布局语言变，A–Z 一律返回大写拉丁字母（https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getkeynametextw ）；`ToUnicodeEx` 会改动内核键盘缓冲区、影响死键，必须加 `wFlags` bit 2 并放在消息循环里调，不能在钩子里调（https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-tounicodeex ）。布局要取前台窗口线程的（`GetKeyboardLayout(GetWindowThreadProcessId(GetForegroundWindow()))`）。

鼠标侧键不做（D9），鼠标钩子照旧只在截取期间装（`main_windows.go:109-120`）。

---

## 5. 设计方案

### 5.1 键的标识

- 配置、文案、日志里一律用 W3C code 名：`AltLeft/AltRight`、`ControlLeft/ControlRight`、`ShiftLeft/ShiftRight`、`MetaLeft/MetaRight`（⌘ 或 Win）、`Fn`、`Space`、`KeyA`、`F1`…`F24`、`ContextMenu` 等（https://www.w3.org/TR/uievents-code/ ）。code 只描述物理位置，换布局不变。
- 键表放在 JS 里一处，建议 `src/hotkeys/keys.mjs`。每行：`code`、`mac`（kVK）、`win`（扫描码，0xE0 扩展前缀放高字节）、`kind`（`modifier` / `fn` / `function` / `named` / `typing`）、各系统是否可绑。由 Chromium `ui/events/keycodes/dom/dom_code_data.inc` 裁出子集，文件头注明来源、提交和 BSD 许可。核对过的行：

  | code | Windows | Mac kVK | 表中行 |
  | --- | --- | --- | --- |
  | `ControlLeft` / `ControlRight` | 0x001D / 0xE01D | 0x3B / 0x3E | 435 / 441 |
  | `ShiftLeft` / `ShiftRight` | 0x002A / 0x0036 | 0x38 / 0x3C | 436 / 442 |
  | `AltLeft` / `AltRight` | 0x0038 / 0xE038 | 0x3A / 0x3D | 438 / 444 |
  | `MetaLeft` / `MetaRight` | 0xE05B / 0xE05C | 0x37 / 0x36 | 440 / 446 |
  | `Space` | 0x0039 | 0x31 | 187 |
  | `Escape` | 0x0001 | 0x35 | 184 |
  | `F13` | 0x0064 | 0x69 | 274 |
  | `Fn` | 无 | 0xFFFF（不映射） | 112 |

- `Fn` 这一行要自己补：Mac 上是 `kVK_Function = 0x3F`（`SDK:HIToolbox/Events.h:280`），Windows 上不可绑。
- Windows 的修饰键另记 vk：`ControlLeft/Right` 0xA2 / 0xA3、`ShiftLeft/Right` 0xA0 / 0xA1、`AltLeft/Right` 0xA4 / 0xA5、`MetaLeft/Right` 0x5B / 0x5C。小帮手按 vk 认修饰键、按扫描码认别的键（4.2），上表的扫描码只用于显示和对照。
- 主进程把 code 换成当前系统的原生码再下发；小帮手收到原生码，录键时也报原生码，主进程换回 code。表里没有的原生码，录键时直接拒绝（"这个键暂不支持"），不学 Typeless 的 `unknown-<码>`，表保持可控。
- 小帮手里仍然保留少量不随绑定变化的平台事实：mac 修饰键键码到设备标志位的对应；Windows 的修饰键 vk、假事件的扫描码、掩码键、自家注入记号。
- 分歧说明：分路笔记 03、04 的协议草案让小帮手收 code 名，笔记 05 让它收原生码。本文选原生码，理由是只有这样小帮手才完全不需要键名表，"一处键表"才名副其实。
- 只认键盘（D9）：键表里没有鼠标键，录键时鼠标按钮一律不算。

### 5.2 绑定与配置的形状

**一个动作一项设置**

动作目录（5.4）里每个动作生成一项设置，名字是 `hotkey.<动作>`，值是字符串。设置文件只存用户改过的：

```jsonc
// settings.json
{
  "hotkey.dictate": ["Fn", "MetaRight"],    // 听写绑了两个
  "hotkey.cancel": ["F13"]                  // 取消换成了 F13；没写的动作用默认值
}
```

- 一个动作是组合的列表，最多 4 个（D4，同 Typeless）。一个组合写成 `"ControlRight+Space"`，手改设置、写环境变量、看日志都直观；code 名里不会出现 `+`，不需要 Typeless 那种特殊处理。
- 空列表 `[]` 表示关掉，只有允许清空的动作能写。
- 只给一个组合时可以不写成列表：命令行 `config set hotkey.dictate Fn`、环境变量 `SPEAKMORE_HOTKEY_DICTATE=Fn` 都认；要给多个就写列表 `'["Fn","MetaRight"]'`。
- 规范化：读入时把组合里的键按显示顺序排好（5.7），去重；比较、查重都用规范化后的集合。存下来的、后台报的、日志里写的都是规范化后的写法。
- 旧写法只在入口认（5.9）：值是 `right_option` 这类旧 id 时，当成它对应的组合（`AltRight`）；存下来的仍是新写法。

**为什么一个动作一项、值是字符串**

现有框架一项一项各管各的：`resolveSettings` 逐项从 `stored[name]` 取值、出错就抛（`src/storage/settings.mjs:305-323`），`saveSetting`、`unsetSetting` 只写、只删 `[name]` 这一个键（`:327-339`），`patchSettings` 同理（`:347-354`）；设置都存成字符串（`:177` 的注释）。一个动作一项，正好落在这套规矩里。值在框架里仍是字符串（规范化后的列表写成 JSON），文件里存成列表用的是框架现成的两个钩子：`json`（文件里写成数组也认，`src/storage/settings.mjs:75`）和 `store`（写进文件时换成数组，`:74`），`customParams` 已经在用 `json`，`model` 已经在用 `store`。环境变量、`config set/unset`、`config` 列表、来源（环境变量、文件、默认）、`pendingSettings` 的"设置改了还没生效"都按名字循环，全部现成，不为热键开特例。存成一个 `hotkeys` 对象的话，上面四个函数都得认嵌套路径，第二版为此给热键开了三个专用钩子，这一版不要了。

**框架补的三样，都是通用的**

- `describe`：设置项可以自带说明。生成的热键项共用一句"「{动作}」的快捷键"，动作名取文案里的 `actions.<动作>.name`；没有自带说明的照旧查 `settings.describe.<名字>`（`src/cli/render/settings.mjs:34`）。
- `legacyName`：改名之前叫什么，命令行 `config set/unset` 照样认。和现有的 `legacyEnv`（`src/storage/settings.mjs:73`）同一个意思，只在入口生效，写进文件的总是新名字。听写这一项写 `legacyName: "hotkey"`、`legacyEnv: "SPEAKMORE_HOTKEY"`。
- `check(value, settings)`：写入前看这一项和别的项合不合。`saveSetting`、`patchSettings` 调它，读文件时不调。热键项用它查本系统能不能绑、是不是系统保留组合、和别的动作冲不冲突（5.5）。

`src/hotkeys/` 不反过来引用 `src/storage/settings.mjs`：`check` 拿到的是调用方传进来的整份设置，依赖只有"设置框架 → 热键模块"一个方向。

**三道校验，各管各的**

| 在哪 | 查什么 | 不通过时 |
| --- | --- | --- |
| `parse`：读文件、环境变量、命令行、界面，所有入口 | 写法：认得的 code 名、两键以内、5.3 的形状规则；旧 id 换算 | 照现有规矩报错 |
| `check`：`config set`、设置页、引导页写入前 | 本系统能不能绑、系统保留组合、和别的动作冲突；警告 | 不让存，说明原因；只有警告时照存 |
| 下发 `bind` 前：`src/hotkeys/bindings.mjs` | 和 `check` 同一套规则，对全部动作一起查 | 那个组合不装，记 warn 日志，放进 `summarizeSetup` 的"还差什么"（`src/app/setup-state.mjs`），首页、命令行 `status` 照现有的路子显示；必须有键的动作（听写、取消）一个都装不上时退回默认组合 |

最后一道兜住手改文件、环境变量和跨系统搬家：Mac 的设置拿到 Windows 上，`Fn` 写法没错、`parse` 通过，下发前发现 Windows 绑不了，听写退回右 Alt 并提示，App 照样起得来（3.4 第 9 条）。小帮手的 `bound` 回执（5.8，比如没有辅助功能权限）也走这条提示路径。

**环境变量**

每个动作一个，按名字生成：`SPEAKMORE_HOTKEY_DICTATE`、`SPEAKMORE_HOTKEY_CANCEL`，含义是"本次运行用这个"，写法同设置文件。听写另认旧的 `SPEAKMORE_HOTKEY`（`legacyEnv`），旧 id 和新写法都收。写坏了照现有规则报错退出，因为这是用户这一次手动给的。

**界面和命令行都按目录生成**

- 设置页的快捷键区照 Typeless 的样子，按动作目录逐行画：左边动作名和一句说明（"按下开始和停止语音输入。"）；右边列出这个动作已绑的每个组合，一个组合一个框、框里一个键一个键帽、右侧 × 删掉；下面"添加另一个"，满 4 个时不显示。不能清空的动作只剩一个组合时，那个 × 不显示。另有"恢复默认"。数据由主进程一次给齐：每个动作的当前组合、默认组合、能否清空、有什么问题。
- `config` 列表里每个动作一行 `hotkey.<动作>`，值按 5.7 格式化成键帽文字（例如"fn、右⌘"），不列可选值，提示"任意组合，见 README"。
- 命令行改键：`speakmore config set hotkey.<动作> <组合>`、`config unset hotkey.<动作>`（D7）。`config set hotkey <组合>` 照旧能用，等于改听写。
- 当场生效：`LIVE` 表（`src/cli/commands/config.mjs:80-96`）按目录给每个 `hotkey.<动作>` 加一项；控制通道加一条 `reload-hotkeys`，后台重读设置、重发 `bind`、推新键帽，不重启。旧后台不认这条命令时照 `applyLive` 现有的退路处理。
- 状态：后台报的状态里每个动作一项 `hotkey.<动作>`，和设置同名，`pendingSettings`（`src/cli/render/status.mjs:92-103`）照旧按名字比。旧的 `hotkey`、`hotkeyLabel` 怎么处理见 D13。

### 5.3 组合的语义（两键以内）

**能绑的形状**

| 形状 | 例子 | 第一版 |
| --- | --- | --- |
| 单个修饰键 | `AltRight`、`MetaRight`、`ControlRight`、`Fn`（仅 Mac） | 允许（现状就是这一种）；单按 Shift 除外（D11） |
| 修饰键 + 修饰键 | `ControlRight+ShiftRight`、`Fn+ShiftLeft`、`ControlLeft+MetaLeft` | 允许 |
| 修饰键 + 普通键 | `AltRight+Space`、`ControlRight+F13` | 允许，普通键要吞（Mac 需辅助功能权限）；两边系统保留的组合除外（5.5） |
| 单个非打字键 | `F13`、`F5`、`ContextMenu` | 允许，要吞 |
| 单个打字键 | `KeyA`、`Space`、`Enter` | 禁止。回车 10-22 起和别的打字键一样，能和修饰键一起绑（划词翻译的默认键右⌥回车）；之前连组合也不让绑 |
| 普通键 + 普通键 | `KeyA+KeyS` | 禁止 |
| `Shift` + 打字键 | `ShiftLeft+KeyA` | 禁止：会打出大写或符号，两键以内无法再加修饰键 |
| 单按 Shift | `ShiftLeft`、`ShiftRight` | 禁止（D11）：微软拼音单按 Shift 切中英文，连按可能弹粘滞键；和别的修饰键、F 键组合仍允许 |

**匹配规则**

1. 集合精确匹配：按住的键集合必须恰好等于绑定，多一个键都不算。
2. 修饰键 + 修饰键不分先后。
3. 修饰键 + 普通键要求普通键最后按下。先按着空格、再碰一下 Ctrl，不触发。实测，人"同时按"右 Option+空格 18 次，有 5 次空格先到；这几次按规则不触发，空格照常打出去。系统快捷键也是这个习惯（⌘C 要先按 ⌘），不放宽。
4. 只有按下能凑成组合；松开导致集合恰好等于某个绑定时不触发。这同时实现了 Typeless 的"不降级"。
5. 组合里的键全部松开才算松开（D1，同 Typeless）。绑定按着期间，组合里的某个键松开又按下，不算新的一次，不报事件；只有组合外的键按下才算打断（第 6 条）。
6. 组合按着时又按下一个键：
   - 新集合恰好等于另一个绑定：升级。先对旧绑定报 `interrupted`（带上 `to`），紧接着对新绑定报按下。
   - 否则对当前绑定报一次 `interrupted`，也就是今天的 `other_key`。被打断的绑定此后不再报松开，直到相关的键全部松开前不再触发任何东西。
   - 两键以内，升级最多发生一次（一键升到两键），不需要 Typeless 的"第三次起忽略"计数。
7. 自动重复：已在集合里的键再来按下事件，就是自动重复，不参与匹配；它的按下被吞了，重复也吞。
8. 丢失松开事件。精确匹配让这件事比现在要紧：现在的代码只看热键自己的键码（`native/main.swift:128-140`、`native/windows/keys.go:91-99`），别的键丢了松开不受影响；新规则下集合里多一个残留的键，所有绑定都凑不上。安全输入（4.1）和 UIPI（4.2）都会吞掉松开，例如用 Tab 切进密码框，Tab 的按下收到了、松开没收到。所以：
   - 每次可能凑成组合的时刻（任何修饰键变化、任何 keyDown），先用系统接口核对集合里的键还按没按着，没按着的移出集合，再做匹配。两个系统核对的对象不同（实施时按实测改的）：
     - Mac 核对**非修饰键**（`CGEventSourceKeyState(.hidSystemState, key)`），修饰键每次都从 flags 里重新解出来（4.1），不用核对。修饰键松开时也核对按着的绑定里的普通键：它的松开丢了的话，照样报松开。
     - Windows 核对**修饰键**（`GetAsyncKeyState`）：Alt+Tab 切进管理员窗口后 Alt 的松开被 UIPI 挡掉，靠这个补上。被钩子吞掉的普通键不核对，吞掉的按下不更新系统状态，问了永远是松开；它们只靠下面的 10 秒清理。
   - 安全输入从开到关、tap 停用后重新打开、钩子重装、锁屏回来时，清掉集合里的非修饰键，对按着的绑定补报松开。
   - 10 秒清理必做：按下超过 10 秒还没松开的非修饰键移出集合（Typeless 的 `cleanupStaleKeys`）。
   - 安全输入期间 `CGEventSourceKeyState` 准不准，未验证（V24）。
   - 共用样例加一条：Tab 的松开丢了，再按 `AltRight`，听写照常按下。
9. Mac 上 fn 按着又按 F 键时，把 fn 从集合里去掉再匹配（4.1）。

**前缀歧义**（D2）

以 `听写 = AltRight`、`某动作 = AltRight+Space` 为例，三种做法：

| 做法 | 谁在用 | 代价 |
| --- | --- | --- |
| 按下就触发前缀绑定，第二个键来了再升级 | Typeless | 听写已经开了麦克风又被取消，麦克风指示灯和悬浮条可能闪一下（未验证闪得明不明显） |
| 前缀绑定改成松开时触发，且中间没按过别的键 | VoiceInk 的 Toggle 模式 | 失去"按下就开始录"藏起来的麦克风初始化时间，600 ms 长按规则也失去意义 |
| 按下后等一小段时间看有没有第二个键 | Alfred（等修饰键松开） | 每次都多一段延迟 |

建议沿用第一种。它和 Typeless 一致，也和我们已经验收过的"按下即开始"一致。还有一个副作用要写进文档：说话进行中按带前缀的长组合，前缀那一下会先被当成"再按一下"，直接结束这次听写。保存时对前缀关系给警告，文案参考 Wispr："Your Hands-free mode shortcut is a part of a Push-to-talk shortcut. This may lead to conflicts."（https://docs.wisprflow.ai/articles/2612050838-supported-unsupported-keyboard-hotkey-shortcuts ）。第一版的两个动作之间不会有前缀关系："取消"是单键，别的动作的组合按 5.5 不能含它的键。前缀问题要到第三个动作出现时才真正出现，但匹配器从一开始就支持升级，代价很小。

2026-10-22 加划词翻译（默认右⌥回车）时补了第三种做法的一个窄版：语音输入的某个组合是别的动作（不是录音会话的，现在只有划词翻译）某个组合的一部分时，主进程把这个组合的按下先压住（`src/app/session-gate.mjs`），松开了、或者 250 ms 到了还没等来第二个键，再交给悬浮条；等来的是被打断（凑成了划词，或者是别的组合键）就整个丢掉，悬浮条什么都没看见，不会闪、不开麦克风。凑成语音翻译的也丢掉压住的那一下，紧跟着的语音翻译自己的按下照常开始。代价是点按语音输入要等到松开才开始，多出来的是一次点按的时长（一百毫秒上下）；按住的话悬浮条晚 250 ms 才收到按下，下面"按住 600 ms 作废"从它收到时算，从真按下算起是 850 ms。没绑划词、或者划词的组合不含语音输入的键时不压。压着的时候按了截着的取消键（esc），压着的那一下作废；首次引导测快捷键时不压，按下就亮。所以保存时的前缀提醒只对"短的那个不是录音会话"的报。

**点按、按住与 600 ms**

- 小帮手只报按下、松开、被打断，不判断单击、长按、双击。以后加"按住说话""双击"时不用改原生层。
- 600 ms 规则由动作决定，写在动作目录里：听写的计时从悬浮条收到绑定按下开始（被会话门压住的组合晚 250 ms，见上），到组合里的键全部松开或被打断为止。比如空格先抬、Ctrl 晚了 0.7 秒才松，算按住了 0.7 秒，这次取消，和 Typeless 一样（D1）。和 Typeless 的区别：升级以后，新绑定从自己按下时重新计时，而 Typeless 从第一个键算起、升级不重置。
- 和现有状态机的对应：`binding down` → `KEY_DOWN`，`binding up` → `KEY_UP`，`interrupted` → `OTHER_KEY`。状态机本身不用改语义；`OTHER_KEY` 只在 `held` 时生效（`machine.mjs:59-62`），所以说话中打字不受影响，这一点保持不变。
- Typeless 的 300 ms 听写防抖暂不加，等真遇到误触再说。

**esc 与"取消"**

- "取消"成为动作目录里的一项，默认 `Escape`，场景限定为"截取中"。原来的 `escape` 事件换成 `binding cancel#0 down`。这样 Mac 上只有一个吞键 tap、Windows 上只有一条吞键路径。
- `when: capturing` 的绑定**不按集合精确匹配**，只看它自己那个键的按下：截取期间 Escape 一按下，不管还按着别的什么，一律吞掉并报取消。这就是现在的语义（截取期间任何 esc 按下都取消，`main.swift:229-240`），现有测试照旧成立，包括"热键还按着（STARTING）时按 esc 也取消，而且 esc 被吞"（`native/windows/keys_test.go:110` 的 `TestEscapeWhileHotkeyHeldAndCapturingIsNotAnOtherKey`）。
- 为什么不也按精确匹配：那样集合是 `{AltRight, Escape}`，取消绑定匹配不上，esc 不吞，会漏给前台应用、顺手关掉它的对话框；截取 esc 本来就是为了防这个（`main.swift:171-174`）。集合里有残留的键时也一样会漏。
- 截取期间按 esc 时听写绑定还按着：只报取消，不对听写报 `interrupted`，被吞的 esc 也不进按住集合。这正是上面那条测试名字里的"IsNotAnOtherKey"。
- 单个 `Escape` 只能给只在截取中生效的动作（现在只有"取消"）。"取消"本身可以改键（5.4）；改了以后截取中按 esc 不再吞，照常送给前台应用。

### 5.4 动作目录

代码里一张表，`src/hotkeys/actions.mjs`。这是"有哪些动作"唯一的出处：设置项、环境变量、命令行、设置页、状态、下发给小帮手的绑定表，都从它生成。

| 字段 | 听写 `dictate` | 取消 `cancel` |
| --- | --- | --- |
| 默认组合 | Mac `AltRight`；Windows `AltRight` | `Escape` |
| 生效场景 `when` | 任何时候（`always`） | 只在截取中（`capturing`） |
| 能否清空 | 不能（Typeless 的 `disabledClearShortcut` 同义） | 不能 |
| 说明 | 按下开始和停止语音输入。 | 说话时按下，取消这一次。 |
| 长按阈值 | 600 ms，超过即取消 | 无 |
| 处理者 `handler` | 悬浮条的录音会话（`session`） | 悬浮条的取消（`cancel`） |

- 每个动作两个系统都必须有默认组合（D10）。两个动作第一版都能改键，设置页两行都画。"取消"只按自己那一个键认（5.3），所以只能绑单个非修饰键。
- 小帮手里的绑定 id 写作"动作#序号"，如 `dictate#0`，原样报回。主进程按动作目录里的处理者分发：
  - `session`：按下、松开、被打断分别变成 `KEY_DOWN`、`KEY_UP`、`OTHER_KEY` 送给悬浮条，事件带着动作 id；会话开始时记下是哪个动作开的，写进日志。以后的"翻译"如果也是"录音、转写、再处理"，就是又一个 `session` 动作，按动作 id 选处理链；选处理链是做那个功能时的事，这次不做。
  - `cancel`：变成 `USER_CANCEL`。
  - 以后要在主进程里执行的动作（例如"粘贴上一条"）再加一种处理者。有了真实的第三种用法再加，现在不预留。
- **加一个动作只改三处**：目录里加一行（必须带两个系统的默认组合，D10）；两份文案里加名字和说明 `actions.<动作>.name/description`；写这个动作本身的处理代码。小帮手、设置格式、命令行、设置页、引导页、状态都不用动。
- **引导页讲到每个动作**（D10）：引导页的快捷键那一步按动作目录列出每个动作和它当前的键，新动作自动出现在里面。"测快捷键"那一小步仍只测听写（5.6）。老用户不会再走一遍引导，新动作上线时怎么告诉他们，做那个功能时一起定。
- **新默认键和用户自己的键撞了**：以用户自己绑的为准，新动作的默认键不装，放进"还差什么"并在设置页那一行提示换一个（5.2 的下发前校验）。
- **机器查得出来**：
  - 测试按目录逐个动作查：两个系统都有默认组合、默认组合之间不冲突，有对应的设置项和环境变量，两份文案里有名字和说明，引导页的列表、`config` 列表、设置页拿到的数据、`LIVE` 表、后台报的状态、绑定表里都有它。目录里加了一行而漏了哪一处，这条测试就红。
  - 测试扫一遍 `src/` 和 `native/`：旧 id（`right_option` 等六个）只许出现在 `src/hotkeys/legacy.mjs`；小帮手源码里不出现动作名。
- 会模拟按键的动作（例如"粘贴上一条"），要等组合里的修饰键都松开后再执行，或者发 ⌘V / Ctrl+V 前确认用户没按着修饰键。否则 Windows 上用户还按着 Alt 时发出的 Ctrl+V 会变成 Ctrl+Alt+V。依据是 `SendInput` "does not reset the keyboard's current state"（about-keyboard-input 页）和 Alfred 的做法（https://www.alfredapp.com/help/workflows/triggers/hotkey/ ）；实际会不会混进去，两个系统都未验证。听写的贴字发生在出结果之后，不受影响。

### 5.5 冲突检测与禁用键

放在 `src/hotkeys/validate.mjs`，输出"拒绝"或"警告"加原因。

**拒绝（录到就报错）**

- 5.3 表里标"禁止"的形状；超过两个键；同一个键出现两次（手改设置可能写出来）。
- 本系统不可绑的键：Windows 上的 `Fn`；两个系统上的 CapsLock、NumLock、ScrollLock、Pause、媒体键；表外的键；Windows 上 0x07、0xE8、0xFF 等内部占用码对应的键。
- 单个 `Escape`，除非这个动作只在截取中生效（现在只有"取消"）。
- 只在截取中生效的动作只按自己那一个键认（5.3），所以别的动作的组合里不能含它的键：取消绑了 `F13`，听写就不能绑 `ControlRight+F13`，否则说话时按这个组合只会取消。
- 系统保留组合，按系统分别建表、按 code 写、左右都列：
  - macOS：⌘ + `Space`、`Tab`、常用编辑键（C V X Z A S W Q N O P F H M T 和逗号）；`Control` + `Space`（切换输入法，对中文用户尤其要紧）；⌃ + F1–F5；⌘ + `Backspace`（来源：Apple HIG https://developer.apple.com/design/human-interface-guidelines/keyboards ，以及 Wispr 文档）。另外用 `CopySymbolicHotKeys()` 动态查启用的系统快捷键。
  - Windows：Alt+Tab、Alt+F4、左 Alt+Space（右 Alt+Space 留给语音翻译，Typeless 的 Windows 默认键里也有它；小帮手吞掉空格后窗口菜单不弹，V27 已验）、左 Alt+Enter（Excel、WPS 表格里是单元格内换行；右 Alt+Enter 留给划词翻译，V28）、Ctrl + 常用编辑键、Win + 字母数字 Tab 方向键、Win+Space、Ctrl+Alt+Del、Win+L、`Shift + Space`（微软拼音全角半角）。另外对"修饰键 + 普通键"用 `RegisterHotKey` 试登记一次。
- Mac 上 `Fn` + 方向键、删除、回车。
- 和自家另一个动作的绑定规范化后相同：拒绝，并写明"已被「某动作」占用"。"任何时候"和别的场景都算重叠，所以现在任意两个动作都不能同键；以后有了互不重叠的场景，才按场景放开。

- 单按 Shift（D11）。
- 一个动作超过 4 个组合（D4）。

**警告（允许保存）**

| 情况 | 原因 |
| --- | --- |
| Mac 单按 `Fn` | 系统"按下地球仪键时"不是"无操作"时会同时触发系统动作；外接键盘多半没有 Fn |
| `AltRight`（AltGr 布局） | 打 AltGr 字符时热键会先触发再被打断 |
| Mac 上 Option + 字母 | 需要辅助功能权限才能吞掉字母（否则会打出特殊字符）；没有权限时绑不上（`bound` 回执 `needs_trusted`） |
| Windows 单按 Win | 依赖掩码挡开始菜单，未验证 |
| Windows 上 `AltLeft+ShiftLeft`、`AltLeft+ShiftRight` | 默认在输入语言之间切换（4.2，V23） |
| Windows 上 `Ctrl+Shift` | 装了多个布局时会切换布局 |
| Mac 上 Control 作修饰键 | Apple HIG："Avoid using the Control key as a modifier" |
| 组合是另一个绑定的前缀 | 见 5.3。短的那个是录音会话时不提醒：长的也是录音会话（语音翻译）的，悬浮条把这一次直接升级过去，录音不断；长的是划词翻译的，主进程先压住这一下（2026-10-22 加语音翻译、划词翻译时改） |
| Mac 上 `⌥` + 回车 | Excel、Numbers 里是单元格内换行；两边的 ⌥ 是同一个键，绑了右边的那里就要按左边的。提醒，不拦：划词翻译的默认键就是右⌥回车 |
| Mac 修饰键 + 普通键 | 安全输入时改由 Carbon 顶替，顶替不上就失灵（4.1） |

**做不到的事要说清楚**：别的应用用钩子或 tap 实现的热键，以及别的应用注册的 Carbon 热键，都没有通用接口能查出来。只能静态表加警告，用户撞上了自己改。

### 5.6 录键体验

**流程**

1. 设置页点某个动作的"添加另一个"，或者点一个已绑的组合（换掉它），进入录制。同一时刻只有一个录制控件在录，新的开始时旧的自动取消。
2. 主进程发 `{"cmd":"record","on":true}`。小帮手暂停全部匹配，开始报"当前按着哪些原生码"。录制有 30 秒超时，到时小帮手自己退出录制并报一条 error，和现有截取模式的兜底同一个思路（`main.swift:188-215`）。
3. 设置页实时显示按住的键。按到第三个键，当场提示"最多两个键"。
4. 按住的键数**第一次减少**时，把此前的最大集合作为结果。两键以内，这和"全部松开时定稿"结果相同，反馈更快。
5. 结果立即过 5.5 的校验。通过就保存、重发 `bind`、退出录制；被拒就显示原因，等用户全部松开后可以直接重按，仍在录制中。
6. 单按 esc 取消录制（录"取消"动作时除外）。点控件外、窗口失焦或关闭时也取消，主进程发 `record off`。
7. 每个动作有"恢复默认"；每个组合右侧的 × 删掉它（5.2）。

**细节**

- 定稿规则放在 JS 里（Typeless 也是渲染层决定），小帮手只报集合，这样规则能用 `node --test` 单测。
- 进入录制前就按着的键（例如用快捷键打开了设置）不算进组合。
- 录制期间吞不吞键：
  - Windows：吞掉全部键盘事件，包括修饰键，免得录 Win 时弹开始菜单、录 Alt 时窗口进菜单模式。PowerToys 设置页的快捷键控件也是用低级钩子录的。结束时确认没有吞了一半的键。
  - macOS：有辅助功能权限时（贴字本来就要），录制期间打开吞键 tap，吞掉全部 keyDown、keyUp；修饰键的 flagsChanged 照规则放行。没有权限时，主进程给设置窗口加 `webContents.on("before-input-event", (e) => e.preventDefault())`，渲染层的 `keydown` 也一律 `preventDefault`（Typeless 的做法）。
  - 为什么 Mac 也要吞：录 ⌘Space、⌃Space、⌘Tab 这类键时，系统自己先执行了，焦点一被抢走，录制就因为失焦取消，用户连"已被系统占用"的提示都看不到。应用菜单只有应用、编辑、窗口三栏（`src/app/app-menu.mjs`，11-04 起），⌘,、⌘W、⌘Q、⌘H 这些菜单快捷键会作用在设置窗口上。渲染层的 `preventDefault` 拦不住菜单快捷键；`before-input-event` 里 `preventDefault` 按 Electron 文档会连菜单快捷键一起挡住，没实测（V25）。session 层主动 tap 能不能抢在 ⌘Space 之前，也未验证（V6）；抢不到时，"系统已占用"的提示要靠 5.5 的静态表和 `probe` 事先给出。
  - 分歧说明：分路笔记 04 主张录制时全吞，05 主张不吞，03 主张可吞可不吞。本文两个平台都吞，Mac 没权限时退到窗口内拦截。
- 为什么必须经小帮手录，不能用渲染进程的 `keydown`：Chromium 的表里 `Fn` 在 Mac 上不映射（`dom_code_data.inc:112`），页面收不到 fn；Windows 的 Win 系列组合在送到页面之前就被 shell 截走；页面录到的码和小帮手认的码也未必是同一套。
- 隐私：录制是对"不报是哪个键"的一个有边界的例外，性质和现在的 esc 例外一样。日志只记最终录下的组合，不记过程。`main.swift` 顶部说明、`keys.go` 注释和 README 的权限说明要同步改写。
- 引导页"测快捷键"和"换个键"是两件事。测快捷键是为了确认真实的匹配路径能触发（输入监控权限有了、小帮手收得到这个键），所以继续把听写绑定的 `binding` 按下松开送给引导窗口，保留现在的 `hotkeyToOnboarding` 改道（`src/app/main.mjs:689-697`；`docs/development.md:225` 记的验收就是"测快捷键那一步收到了真按键"）。录制模式会暂停全部匹配，证明不了绑定真能用，所以只有点"换个键"才进录制模式，用的是和设置页同一个录制控件。
- 界面按项目规范：书面语、短句；按钮用共用的胶囊样式；改样式后在真窗口逐个查（项目记忆 `desktop-copy-and-look`）。`docs/desktop-ui-spec.md` 要新增"录键控件"一条。

### 5.7 键帽与文字

- **键帽**（悬浮条、首页、引导、设置）：每个键一个键帽块，键帽之间不写加号。
- **纯文本**（菜单栏、命令行、通知、日志）：Mac 上修饰键用符号、键之间不加号，和系统菜单一致，例如"右⌥Space"；Windows 用加号，例如"右 Alt+Space"。Windows 写法的出处是微软风格指南的惯例，本次只看到二手资料，原文未核对。
- **顺序**：Fn 在最前；Mac 其余按 Apple HIG 的 Control、Option、Shift、Command；Windows 按 Ctrl、Alt、Shift、Win。修饰键之间不按按下先后，一律按这个顺序显示。
- **左右**（D6）：修饰键一律标左右，单按和组合都标，沿用现有写法"右⌥""右 Alt"，左侧写"左⌥""左 Alt"。理由是只认指定的那一侧（D12）：`ControlLeft+Space` 要是显示成"⌃Space"，用户按右 Ctrl 不触发，会以为坏了。
- **普通键的字**：第一版用美式名字（`KeyQ` 显示 Q、`Space` 显示"空格"或 Space）。两键组合里的普通键多是 Space、F 键这类不随布局变的键，影响很小。以后要按布局显示，有两条路：渲染进程的 `navigator.keyboard.getLayoutMap()`（在 Electron 的 `file://` 页面能否用、中文输入法下返回什么，都未验证；https://developer.mozilla.org/en-US/docs/Web/API/Keyboard/getLayoutMap ），或者小帮手按 4.1、4.2 的接口翻译后报上来。
- **Fn**：键帽沿用"fn"，名字沿用"地球仪（fn）键"/"Globe (fn)"。
- **老键逐字不变**：六个旧 id 对应的单键，键帽和名字要和现在 `hotkeys.<id>.keycap/name`（`zh-CN.mjs:55-62`、`en.mjs:56-63`）的文字一字不差，比如"右⌥""右 Option 键""右 Alt"。测试把这六组钉住，老用户在悬浮条、首页、菜单栏上看到的和升级前一样（5.9）。
- **文案键**：`keys.<code>.keycap` 和 `keys.<code>.name`，Windows 的写法放在各语言文案的 `windows` 一节（`src/i18n/index.mjs:139-146` 已有按系统覆盖的机制）。
- **悬浮条提示**：`{key}` 从一个键帽片段变成一组键帽；`{esc}` 改成"取消"动作当前绑定的键帽，不再写死。两键时提示变长，要在真窗口里看最窄的情况。
- **格式化函数只有一个**，放在 `src/hotkeys/`。悬浮条、首页、历史页、引导页、菜单栏、命令行都调它，各处不再自己拼。

### 5.8 小帮手协议

一行一个 JSON，和现在一样；Mac 与 Windows 一字不差。

标准输入：

```json
{"cmd":"bind","bindings":[
  {"id":"dictate#0","mods":[61],"when":"always"},
  {"id":"cancel#0","mods":[],"key":53,"when":"capturing"}
]}
{"cmd":"capture","regions":[{"id":"cancel","x":0,"y":0,"width":28,"height":28}]}
{"cmd":"capture","regions":[{"id":"copy","x":0,"y":0,"width":28,"height":28}],"outside":true}
{"cmd":"release"}
{"cmd":"record","on":true}
{"cmd":"record","on":false}
{"cmd":"probe","id":7,"mods":[58],"key":40}
{"cmd":"info"}
{"cmd":"paste","id":1,"text":"…"}
{"cmd":"selection","id":7}
```

- `capture` 带 `outside: true`（划词卡片）时，块外的左键按下另报 `click`、`id` 是 `outside`，这一下照常放行；不写就是不报（悬浮条）。
- `selection` 取前台应用里选中的字（划词翻译），答复见下面的 `selection`。Mac 先问辅助功能，Windows 先问 UI Automation；问不到再模拟一次复制（⌘C、Ctrl+C），从剪贴板取、取完还原。Windows 上应用有 TextPattern、选区是空的，或者前台是终端，就是没选中，不模拟复制：终端里没选区时 Ctrl+C 是中断。模拟复制和 `paste` 排成一队，一件做完才做下一件。

- 一个绑定分成 `mods`（修饰键，0 到 2 个，一定带，没有就是空数组）和 `key`（普通键，最多 1 个，可以不带）两栏，形状规则（5.3）直接写在结构里，小帮手不用自己猜哪个码是修饰键。小帮手再查一遍形状：整条不对（不是一组对象、少了 `id`/`mods`/`when`、类型不对）报 `error`、绑定表不动；单个不合规矩的（含重复的 id，两个都不装）在回执里退回，原因 `invalid`。
- `bind` 整表替换，可以随时再发。上例是 Mac 的原生码；Windows 上 `mods` 发 vk，`key` 发扫描码（4.2），所以 `AltRight` 是 165（0xA5），`Escape` 是 1，`F13` 是 100（0x64）。
- `probe` 查系统冲突，结果见下面的 `probed`。Mac 上调 `CopySymbolicHotKeys`（Carbon 接口，只有 Swift 小帮手能调）；Windows 上用 `RegisterHotKey` 试登记，它要 vk，小帮手按前台窗口的布局用 `MapVirtualKeyEx` 把扫描码换成 vk。带普通键的都查（Mac 的系统快捷键表里也有单个 F12、F14 这种，修饰位只有合成的 fn 位）；单个修饰键、只由修饰键组成的直接回 `conflict: false`。只在说话时生效的动作（取消）不查：那时小帮手先截住了它。
- `info` 问一次系统设置里和热键相关的值，第一版只有 Mac 的 `AppleFnUsageType`（4.1）。也可以由主进程用 `defaults read com.apple.HIToolbox AppleFnUsageType` 自己读，那样协议里就不需要 `info`；放在小帮手里，是为了和 `CFPreferencesCopyAppValue` 读到的同一份值一致。
- `when` 只有 `always` 和 `capturing` 两种。`capturing` 跟着现有的 `capture`、`release` 切换。悬浮条按钮的点击仍走 `regions`。
- 吞不吞不设开关：修饰键不吞，非修饰键吞，规则固定。笔记 05 草案里的 `swallow` 字段去掉，少一个可能配错的旋钮。
- 删掉 `--key`。小帮手和 App 总是一起发布，不存在跨版本组合（项目记忆 `refactor-surgical-clean`：重构做干净，不给自己的旧做法留兼容）。`--check` 不再依赖热键参数。

标准输出：

```json
{"event":"ready","listen":true,"trusted":true,"capture":true}
{"event":"bound","rejected":[{"id":"x#0","reason":"needs_trusted"}]}
{"event":"binding","id":"dictate#0","down":true}
{"event":"binding","id":"dictate#0","down":false}
{"event":"interrupted","id":"dictate#0"}
{"event":"interrupted","id":"dictate#0","to":"x#0"}
{"event":"recording","on":true,"mods":[61],"keys":[49]}
{"event":"recording","on":false}
{"event":"probed","id":7,"conflict":true,"source":"symbolic"}
{"event":"info","fnUsage":1}
{"event":"click","id":"cancel"}
{"event":"click","id":"outside"}
{"event":"selection","id":7,"text":"…","rect":{"x":10,"y":20,"width":300,"height":40},"via":"uia","ms":35}
{"event":"selection","id":8,"text":"","via":"copy","reason":"none","ms":420}
{"event":"permissions","listen":true,"trusted":false,"capture":false}
{"event":"secure_input","on":true,"unavailable":["dictate#1"]}
{"event":"elevated_foreground","on":true,"pid":4242}
{"event":"relistened","reason":"resume"}
{"event":"pasted","id":1,"ok":true}
```

- `bound` 回执说明哪些绑定装不上、为什么，`rejected` 总是数组。原因有四种：`invalid`（形状不合规矩）；`needs_listen`（Mac 没有输入监控权限、Windows 键盘钩子没装上）；`needs_trusted`（Mac 上要吞普通键却没有辅助功能权限）；`register_failed`（Mac 上单个 F 键交给 Carbon 注册不上，多半是别的应用占了）。不装上而让普通键漏出去，会往用户的输入框里打字，所以宁可装不上并照实提示。
- `interrupted` 带 `to` 时表示升级，紧接着一定是 `to` 那个绑定的按下。状态机可以据此决定保留麦克风、只换动作，还是取消再开始；第一版按"取消再开始"处理即可。
- `recording` 只在录制模式下出现，报当前按住的原生码集合，修饰键和别的键分开报（录制时可能按着不止一个普通键，所以 `keys` 是数组，交给 JS 判形状）。进入时先报一份空的；只算进入以后才按下的键。离开时（命令让停的、30 秒到点自己停的）报 `on: false`。主进程按自己发出的 `record off` 计数，认掉对应的回执，剩下的才是到点（`src/app/hotkey-recording.mjs`）；刚开始录时、空快照之前到的是上一轮晚到的，不算。
- `probed` 的 `source` 是 `symbolic`（Mac 系统快捷键）或 `registered`（Windows 上已被别的程序登记）；`info` 里 `fnUsage` 读不到时不带这个字段。
- `permissions`、`secure_input` 只有 Mac 有。`permissions`：运行中两项权限变了（每秒查一次，辅助功能另听 `com.apple.accessibility.api`），没了的那项的 tap 已经作废，紧跟着按新的权限重报一次 `bound`。`secure_input`：安全输入开了、关了；开着时带普通键的绑定由 Carbon 顶着，`unavailable` 是顶不了的（带 fn 的、注册不上的）。
- `elevated_foreground`、`relistened` 只有 Windows 有。`elevated_foreground`：前台换成了以管理员身份运行的窗口（`on: true`，带 `pid`），或者换走了（`on: false`）；小帮手自己是管理员身份时不报。主进程对同一个进程只提示一次（D8）。`relistened`：睡眠唤醒（`reason: "resume"`）、解锁或切回这个用户（`"unlock"`）以后重装了键盘钩子；睡下去、锁屏时按着的绑定先补报松开。
- `selection`：`rect` 是选区的外接框（屏幕坐标，Mac 是点、Windows 是物理像素），拿不到不带；`via` 是 `ax`、`uia`（辅助功能、UI Automation）或 `copy`（模拟复制，拿不到位置）。`text` 为空时带 `reason`：`none` 没选中、`not_trusted` 没有辅助功能权限（Mac）、`elevated` 前台是管理员窗口（Windows）、`failed` 出错了（另报 `error`）。选中的字最多交出 65536 个 UTF-16 单元。
- 去掉的事件：`hotkey`、`other_key`、`escape`。
- 可选：事件带时间戳（Mac `CGEvent.timestamp`，Windows `KBDLLHOOKSTRUCT.time`），以后做双击和按住时长不受进程间延迟影响。现在 600 ms 由 JS 计时（`bar.mjs:60-62`），误差可以接受，第一版不加。

为什么不把全部按键流给 JS 匹配：吞不吞必须在回调里当场决定，Windows 钩子超时会被静默卸掉，跨进程问 JS 来不及；而且小帮手的输出会变成键盘记录器，Typeless 正是这样，还把按键广播给四个窗口。原生层匹配的代价是逻辑在 Swift 和 Go 各写一遍，用共用样例约束（第 6 节）。

### 5.9 老用户无感：旧设置的换算、回滚、对外接口

目标：升级以后老用户什么都不用做，热键还是原来那个，用法、提示、权限都和以前一样；能感觉到的变化只有"热键能自己录、能组合了"。内部不留兼容层：存的、后台报的、显示的一律是新写法，旧写法只在入口认，认了就换成新写法。

**旧 id 对照**（`src/hotkeys/legacy.mjs`，全仓只此一处）

| 旧 id | 系统 | 新组合 |
| --- | --- | --- |
| `right_option` | Mac | `AltRight` |
| `right_command` | Mac | `MetaRight` |
| `right_control` | Mac | `ControlRight` |
| `fn` | Mac | `Fn` |
| `right_alt` | Windows | `AltRight` |
| `right_ctrl` | Windows | `ControlRight` |

**老用户会碰到的地方**

| 地方 | 现在 | 升级以后 |
| --- | --- | --- |
| 设置文件里的 `"hotkey": "right_command"` | 听写用右 ⌘ | 第一次启动时换成 `"hotkey.dictate": ["MetaRight"]`，删掉 `hotkey`；热键不变 |
| 用默认键的人（文件里没有 `hotkey`） | 右 Option / 右 Alt | 不变，文件不动 |
| 环境变量 `SPEAKMORE_HOTKEY=right_command` | 本次运行用右 ⌘ | 照旧（`legacyEnv`，值按对照表换算） |
| `speakmore config set hotkey right_command`、`config unset hotkey` | 改、清听写 | 照旧（`legacyName`）；回话里写的是新名字和新写法 |
| 键帽和名字 | "右⌥""右 Option 键""fn""右 Alt" | 六个旧键逐字相同，测试钉住（5.7） |
| 用法 | 按一下开始、再按一下结束；按住 600 ms 取消；按着时来了别的键悄悄取消；esc 取消 | 不变，3.5 列的现有测试照旧通过 |
| 权限 | 输入监控；贴字用的辅助功能 | 不多要。单个修饰键的绑定不吞键、不用 Carbon；只有用户自己绑了带普通键的组合才用到吞键，那要的辅助功能贴字本来就有 |
| 换键 | 设置页下拉框；换完重启小帮手 | 录键控件，不重启。这是新功能本身 |
| `status --json` 的 `status.hotkey`、`status.hotkeyLabel`、`settings.hotkey` | 旧 id 和它的名字 | 见 D13 |

**换算放在哪、什么时候跑**

- 换算是一个同步函数 `migrateLegacySettings(file)`，放在 `src/storage/legacy.mjs`（0.1 版的数据搬家也在这里），对照表从 `src/hotkeys/legacy.mjs` 取。
- 必须在第一次读设置之前跑：
  - 命令行：`migrateLegacyData` 在命令执行前（`src/cli/main.mjs:310`），之前只有 `cliLocale` 读过一次语言（`:213`），不受影响，换算接在那里。注意 `migrateLegacyData` 没有 0.1 旧目录时直接返回（`src/storage/legacy.mjs:76`），换算要放在返回之前，或者单独调。
  - App：顶层在 `src/app/main.mjs:137` 就读了设置，`migrateLegacyData` 要到 `:370` 才跑。换算放在 `:137` 之前，否则直接双击打开、开机自启的那一次用的是默认键。
  - 测试钉住："只有旧 `hotkey` 的设置文件，直接起 App、直接跑 `status`，听写都是原来的键"。
- 规则：文件里有 `hotkey` 就按对照表换成 `hotkey.dictate`（已有 `hotkey.dictate` 也覆盖），删掉 `hotkey`，记一条 info 日志 `settings_migrated`。新版从不写 `hotkey`，所以文件里出现它只有两种可能：还没换过，或者退回旧版后在旧版里改过。两种都该以它为准。
- 幂等：再跑一遍什么都不变；App 和命令行先后各跑一次，结果相同。本系统认不出的旧 id（Mac 的 `fn` 到了 Windows 上）照样写成 `Fn`，由下发前那道校验退回默认并提示（5.2）。
- 写不进去（比如文件只读）时照 `migrateLegacyData` 现有的路子报错，不静默。

**回滚路径**（AGENTS.md 红线 6）

- 旧版只认 `hotkey`，读不到就用默认值：`resolveSettings` 只遍历自己的 `SETTINGS`（`src/storage/settings.mjs:305-323`），不认识的 `hotkey.*` 不读也不报错；保存设置时保留文件里别的键（`:330` 的 `{ ...readFile(file), … }`）。所以退回旧版一定能起来，热键是默认键；`hotkey.*` 留在文件里，再升回新版照旧生效。
- 退回后在旧版里又改了热键：旧版写的是 `hotkey`，再升级时按上面的规则以它为准。
- 环境变量是例外：`SPEAKMORE_HOTKEY` 里写了新组合时，旧版起不来（旧版 `parse` 不认就退出，`src/app/main.mjs:136-145`），退回前要先删掉。

**退回旧版的步骤**

现在只往前升级，没有"降级"命令。要退回时：

1. 先删掉 shell 配置、launchd 里写了新组合的 `SPEAKMORE_HOTKEY`。
2. 从发布地址下载要退回的那个版本的安装包，照 README 的安装步骤装上；发过的版本不覆盖，历史版本都还在（项目记忆 `speakmore-release-on-cos`）。
3. 设置文件不用动。热键回到默认键，要用原来的键就在旧版里再选一次。

**对外文字**：README 的设置表（`README.md:426`）改成每个动作一行；`:442, 449, 472` 及英文版（同号）；JSON 输出说明按 D13 写；`website/scripts/screenshots.mjs:112, 140, 164, 287` 里模拟的 `app:info`、`setup.hotkey`、`config:get` 和悬浮条提示。

### 5.10 用不用库：四看

| 方案 | 维护 | 社区 | 许可 | 单按修饰键 | 能否吞键 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| uiohook-napi 1.5.5 | 2026-03 发版，此前两年无发版 | 242 星 | 包是 MIT，编进去的 libuiohook 是 LGPL-3.0 | 能 | 不能：事件异步交给 JS（`src/lib/addon.c:11-26` @44e0d86） | 不用；许可也和"发布包不带 GPL/LGPL"的约定冲突 |
| node-global-key-listener 0.3.0 | 2024-07 已归档 | 110 星 | MIT | 能 | 要一次跨进程往返 | 不用 |
| iohook 0.9.3 | 2022-06 后无发版，106 个未关 issue | 1262 星 | MIT | 能 | 宣称 Mac 能吞 | 不用；没有当前 Electron 的预编译包 |
| Electron `globalShortcut` | 随 Electron | 大 | MIT | 不能 | 能 | 不用作主路 |
| KeyboardShortcuts（Swift） | 活跃 | 2724 星 | MIT | 不能 | 能 | 不用；是 SPM 包，不适合单文件 `swiftc` 编译的小帮手 |
| 自己的两个小帮手 | 自己 | — | MIT | 能（现在就是） | 能（现在就吞 esc 和点击） | 继续用 |

数据依赖：Chromium 的 `dom_code_data.inc` 只取子集，以数据形式进仓库，文件头保留 BSD 许可声明，注明取自哪个提交（本次取的是 2026-10-20 的 main，文件 sha256 前缀 `841e2c58e638`，见分路笔记 03 §7.1）。VoiceInk 是 GPL-3.0，只借鉴设计，不抄代码。

---

## 6. 分步实施建议

在 feature 分支上做，一个逻辑单元一个提交。每一步结束时 App 都能正常用，中途不写过后要删的过渡代码。

| 步 | 内容 | 怎么验 |
| --- | --- | --- |
| 0 | **先修基线隐患**：Windows 钩子回调里的 `emit`、`onUIThread` 改成非阻塞发送，丢弃时计数并在消息循环里补报 error | Go 单测灌满 channel，回调不阻塞；先写测试、看它红 |
| 1 | `src/hotkeys/keys.mjs`（键表）、`chord.mjs`（组合的解析、规范化、显示顺序、格式化）、`legacy.mjs`（旧 id 对照） | `node --test`：解析正反例、规范化、两个系统的格式化期望表、六个旧 id 的换算 |
| 2 | `actions.mjs`（动作目录）和 `validate.mjs`（拒绝、警告、自家冲突、前缀、截取中动作的键不许出现在别的组合里） | 每条拒绝和警告各有正例和反例，数清条数 |
| 3 | 共用按键轨迹样例 `native/fixtures/hotkeys/*.json` 和生成脚本；Go 匹配器（替换 `keys.go` 的热键部分，`keyInput` 加扩展位），Go 测试接进 `npm test` 或单独脚本 | 样例覆盖下方清单；`scripts/build/go.sh test ./...`；生成脚本跑完 `git diff` 为空 |
| 4 | Swift：`native/main.swift` 拆成"纯逻辑 + 入口"多个文件，Swift 测试用 `swiftc` 直接编出来跑 | 同一套样例在 Swift 上全绿；`src/cli/native-helper.mjs` 的 `sourceContent` 现在只收 `go.mod` 和 `.go`（`:44-50`），要把 `.swift` 收进来，`swiftc` 也要传多个源文件（`:120-135`） |
| 5 | 协议：`bind`、`bound`、`binding`、`interrupted`；删 `--key`；主进程按动作目录的处理者分发，事件带动作 id；esc 并进绑定表。这一步设置还是旧的 `hotkey` 一项，主进程用 `legacy.mjs` 把它换成组合再下发：对照表本来就要留着做换算，不是临时代码 | `test/app/helper.test.mjs` 的假小帮手加新事件；Go `protocol_test.go`；主进程 code → 原生码的期望表；`e2e.mjs` 换新事件 |
| 6 | 设置：按目录生成 `hotkey.<动作>`，删掉旧的 `hotkey` 项和 `settings.mjs` 里的键表；框架补 `describe`、`legacyName`、`check`；`migrateLegacySettings` 接到两个入口（App 那一处挪到 `main.mjs:137` 之前）；`bindings.mjs` 的下发前校验和降级；环境变量；`config`、`LIVE` 和 `reload-hotkeys`；后台状态和 D13；5.4 的两条按目录查的测试 | 换算、幂等、"旧版里改过以旧版为准"、跨系统降级、直接起 App 不丢键、旧环境变量和旧命令照样能用，各有用例；按目录查的测试先往目录里加一个假动作、看它红 |
| 7 | macOS 吞键：小帮手改用 NSApplication 跑（`.prohibited`）；触发 tap（有"修饰键 + 普通键"绑定时才建）同步打开吞键 tap，三个 tap 共用匹配器并按事件去重；tap 挪到独立线程；权限撤销时立刻作废所有主动 tap；单个 F 键走 Carbon；停用和锁屏时清状态；跳过自己合成的事件；安全输入检测、Carbon 顶替与提示 | V1、V8、V19、V20 已跑完（4.1）；照本机实验程序（`.playwright-mcp/hotkey-research/experiments/hk.swift`）的合成按键办法，给小帮手写进仓库的回归脚本（快速连发不漏、只听 tap 去重、Carbon 能触发）；再在真机按清单逐项走 |
| 8 | Windows 平台细节：掩码通用化、假 Shift、睡眠唤醒重装、`GetAsyncKeyState` 校正、扫描码为 0 的回退 | `keys_test.go` 补用例；`e2e.ps1` 改用扫描码注入并加只带 vk 的一组 |
| 9 | 录键：小帮手 `record` 模式、IPC、设置页按动作目录逐行画录键控件（照 Typeless 一个动作列多个组合、× 删、"添加另一个"，D4）、引导页按目录列出每个动作和它的键（D10）、引导页"换个键"复用它（"测快捷键"仍走真实匹配）、系统冲突探测 `probe`（Mac `CopySymbolicHotKeys`，Windows `RegisterHotKey` 试登记）、`info` | 定稿规则的 JS 单测；`probe`、`info` 进协议测试；界面在开发窗口里给主人看（项目记忆 `ui-review-in-dev-window`） |
| 10 | 显示：`keys.<code>.*` 和 `actions.<动作>.name` 文案、悬浮条一组键帽、菜单栏、命令行 `status` 和 `config` | `bar-view.test.mjs`、`i18n` 测试、`cli` 测试改写；六个旧键的键帽和名字逐字不变 |
| 11 | 文档：README（设置表每个动作一行、`status --json` 按 D13 写）、`implementation-notes.md`、`development.md`、`desktop-ui-spec.md`、隐私说明；引导页、悬浮条、首页的界面改了，README 和官网的截图要重拍（`website/scripts/readme-media.mjs`，3.3 的截图一条） | 逐处对照 3.3 的清单 |
| 12 | 真机验收：沿用户路径走一遍，打好的包真启动一次（项目记忆 `acceptance-end-to-end`）。另走一遍老用户升级：两台电脑各装 0.13.1、换成非默认键（Mac 右 ⌘、Windows 右 Ctrl），开着升级到新版；再退回 0.13.1 起一次 | 第 7.2 节的真机清单；升级后热键照旧能用、键帽不变、没有新的权限弹窗、设置文件已换算；退回后能起来、用默认键 |

**测试策略**

- **共用样例是关键。** 每个样例包含一组绑定（code 名）、一串事件（`{code, down, injected?, scan?}`），以及每一步期望的输出：报什么事件、吞不吞、插不插掩码。键表在 JS 里（`src/hotkeys/keys.mjs`），Go 和 Swift 的测试读不了，所以加一个生成脚本（例如 `scripts/build/hotkey-fixtures.mjs`）：读 code 名写的样例，经键表换成原生码，每个系统生成一份（`native/fixtures/hotkeys/mac/*.json`、`win/*.json`），提交进仓库。Go 和 Swift 的测试只读自己那一份。
- 期望输出按系统分：掩码只有 Windows 有，fn 折叠、`kCGEventSourceUserData` 只有 Mac 有，AltGr 假 Ctrl、NumLock 假 Shift 只有 Windows 有。两边共有的部分（报什么事件、吞不吞）写在样例的公共段，生成时原样拷到两份里；各系统独有的写在 `mac`、`win` 两段，只进对应的那份。"一字不差"指的是公共段。
- 生成脚本在 `npm run check` 里跑一遍并检查 `git diff` 为空，防止改了键表忘了重新生成。
- 样例必须覆盖：单键按下松开；修饰 + 修饰两种顺序；修饰 + 普通键，以及先按普通键再按修饰键（不触发）；只有按下凑组合（松开不触发）；升级；被打断后不再触发；自动重复；吞了按下就吞松开；AltGr 假 Ctrl；NumLock 假 Shift；自己注入的键；扫描码为 0；丢失松开后清理（含"Tab 的松开丢了，再按 `AltRight`，听写照常按下"）；10 秒清理；监听被停用；截取中与非截取中的 esc（含热键还按着时按 esc：只报取消、esc 被吞）；录制模式下不匹配；Win 和 Alt 的掩码时机（含被吞键松开时）；Mac 吞键 tap 开着时同一个事件送两遍（`AltRight+Space` 按下只报一次，Space 的按下松开都被吞，全部松开后集合为空）；Windows 右 Shift 带不带扩展位都认成 `ShiftRight`。正例、反例、边界各一组，数清条数。
- JS 纯逻辑：组合解析与规范化、校验、冲突与前缀、动作默认值、旧设置换算、环境变量、下发前的降级、录键定稿规则，以及 5.4 按目录逐个动作查的两条测试。
- 协议：假小帮手、Go 协议测试、code 与原生码换算。
- 端到端：Windows `e2e.ps1` 改用 `KEYEVENTF_SCANCODE` 注入；Mac 用 `CGEvent` 合成键盘事件（`docs/development.md:199` 做过一次），合成修饰键能否产生带设备位的 flagsChanged 未验证。
- 现状提醒：Go 测试和 `e2e.ps1` 不在 `npm test` 里，仓库没有 CI。至少让 Go 测试进 `npm run check` 能触发的范围，或者写一个单独的脚本并在 `docs/development.md` 里说明。

---

## 7. 待定问题

### 7.1 需要主人拍板

2026-10-21 主人逐条拍板，每条开头的"定"是结果；选项和理由留着备查。

**D1 组合的"松开"按哪个键算**

**定：B，全部松开才算松开。** 主人用 Typeless 顺手，两只手都抬起来才算按完。代价照实记着：空格先抬、Ctrl 晚了超过 600 ms 才松，这次会被当成按住而取消，和 Typeless 一样。

- 选项 A：任一键松开即算松开（笔记 05 的取舍）。好处：按了 `Ctrl+Space`、Space 很快松开但 Ctrl 多按了一会儿，不会被当成长按取消；按住修饰键连点两下普通键，正好是"开始、结束"。
- 选项 B：全部松开才算（Typeless）。好处：和原版一致。
- 建议 A。这是设计推理，没有在真机上比过手感（未验证：匹配器里加开关，两种各按一轮）。

**D2 前缀共享**

**定：A。**

- 选项 A：允许，保存时警告；运行时按下即触发、第二个键到来时升级（Typeless、Wispr）。
- 选项 B：直接不让存。
- 建议 A。代价是升级时麦克风指示灯可能闪一下（未验证），以及说话中按长组合会先结束本次听写。第一版的听写和取消之间不会有前缀关系（5.3），这个问题要到第三个动作出现时才出现。

**D3 macOS 上带普通键的绑定怎么做**

**定：A；V1 不通过后改定 E。** 2026-10-21 的实验结果：V1 不通过（由只听 tap 打开吞键 tap 会漏键，4.1），V19、V20 通过。主人在 B、D 和新找到的 E 之间选了 E。

分两类：修饰键 + 普通键（`AltRight+Space`），单个 F 键（`F13`）。

- 选项 A：修饰键 + 普通键走按需打开的吞键 tap（需要辅助功能权限，贴字本来就要）；单个 F 键走 Carbon `RegisterEventHotKey`；安全输入期间带普通键的绑定都由 Carbon 顶替，顶替不上就提示（4.1）。
- 选项 B：带普通键的绑定全部走 Carbon，只听 tap 只看修饰键（AltTab 的分法）。不需要按需开主动 tap，也不怕安全输入；代价是 Carbon 会把另一侧的同一组合也吞掉，例如绑 `MetaRight+KeyK`，左 ⌘K 在所有应用里都会失灵。
- 选项 C：有带普通键的绑定时吞键 tap 常开。只有一套机制；代价是主动 tap 一直挡在每次按键的路上，撤销辅助功能权限时整机冻住的风险也一直在。
- 选项 D：第一版只开放单按修饰键和修饰键 + 修饰键，完全不碰吞键，保持"只听"。
- 选项 E（V1 之后新增，已定）：存在修饰键 + 普通键绑定时，常开一个掩码只有 flagsChanged 的触发 tap，在它的同步回调里打开吞键 tap（4.1）；单个 F 键和安全输入顶替同 A。和 C 比，它不挡打字键，只挡修饰键事件；权限撤销时冻住的风险一样在，靠监听权限变化、立刻作废主动 tap 来缓解（V26）。
- 建议 A。主人明确要"组合键"，而常见的组合（`AltRight+Space`）都含普通键。A 有三个前提：V1（按需打开有没有竞态）、V19（小帮手里收不收得到 Carbon 热键）、V20（安全输入下 Carbon 还触不触发）。V1 不通过，就在 B、C 之间重新选，需要主人再确认一次；V19 不通过，单个 F 键第一版在 Mac 上不开放；V20 不通过，安全输入期间只提示。

**D4 每个动作几个组合**

**定：多个，上限 4，界面照 Typeless。** 设置页每个动作列出已绑的每个组合，一个组合一个框，右侧 × 删掉，下面"添加另一个"；设置文件里存成列表，不用逗号拼（5.2）。

- 选项 A：设置的写法支持多个（逗号隔开），界面第一版只给一个。
- 选项 B：照 Typeless、Wispr 给多个（上限 4）。
- 建议 A。写法一开始就支持多个，以后界面放开时不用换算设置；第一版界面简单。外接键盘没有 Fn 的场景，可以等真有需要时再放开。

**D5 默认键**

**定：不变。**

- 建议不变：Mac 右 Option（为了和 Typeless 的 Fn 同时开着用，`main.swift:19`），Windows 右 Alt。注意 Typeless 的 Windows 默认也是右 Alt，两者在 Windows 上同时运行会撞键。

**D6 左右怎么标**

**定：A，一律标左右。** Typeless 也是这样（`Right Cmd`、`Left Shift`）。

- 选项 A：一律标左右，单按和组合都标。
- 选项 B：单按修饰键时标左右；组合里右侧标"右"、左侧不标。
- 选项 C：只在单按时标（VoiceInk），组合里一律不标。
- 建议 A。我们只认指定的那一侧（D12），哪一侧不标都会让人误会：`AltRight+Space` 显示成"⌥Space"，用户按左 Option 不触发；`ControlLeft+Space` 显示成"⌃Space"，用户按右 Ctrl 也不触发，都会以为坏了。B 只解决了前一半。要是想让左侧不标，就得配合 D12 给左侧放开"任一侧"，规则反而更复杂。

**D7 命令行怎么改热键**

**定：A，走 `config set`。** 多个组合写成列表。

- 选项 A：每个动作一项设置，`speakmore config set hotkey.<动作> <组合>`、`config unset hotkey.<动作>`，`config` 列表里每个动作一行，都按动作目录生成（5.2）。旧的 `config set hotkey <组合>` 当成改听写（`legacyName`），老用户照旧能用。
- 选项 B：单独做 `speakmore hotkey <动作> <组合>` 子命令。
- 建议 A。走现有的设置框架，环境变量、来源、"设置改了还没生效"、当场生效都现成；B 要另写一套，还得和 `config` 两边同步。

**D8 Windows 管理员窗口**

**定：① 只提示。**

- 选项：① 只提示；② 可选"以管理员身份运行小帮手"；③ uiAccess。
- 建议 ①。② 每次弹 UAC 或要计划任务；③ 要代码签名并装进 Program Files，和"一次删干净、可整体搬家"冲突。

**D9 鼠标侧键**

**定：不做。** 只认键盘，鼠标的任何键都不能当热键，以后也不做。报告里给鼠标预留的部分已删。

- 建议放到第二阶段。Windows 要常驻鼠标钩子，Mac 要处理 otherMouse 事件；键盘部分稳定后再做。

**D10 新动作的默认组合**

**定：必须有默认键，不能留空。** 不给默认键，用户不知道有这个功能。引导页要讲到每个动作和它的键（5.4）。具体用哪个键，做那个功能时再定。和用户自己绑的键撞了时，以用户的为准，新默认键不装并提示（5.4）。

- 两键以内很难找到不冲突的默认值（Typeless 的"再贴一次"是三键）。建议默认留空，由用户自己绑。

**D11 单按 Shift、CapsLock**

**定：都不开放。** Shift 仍可以和别的修饰键、F 键组合。

- Shift：建议允许但警告（微软拼音切中英文、粘滞键）。也可以直接禁止，对中文用户更安全。
- CapsLock：建议第一版不开放。Mac 上常用的标志位反映锁没锁，两个无状态位有没有用未验证（V7）；Windows 上吞掉后大小写状态变不变未验证（V12）。

**D12 "任一侧"修饰键**

**定：不支持。** 两侧都想用，就左右各录一个（D4）。

- PowerToys 支持左、右、任一侧三种（`ModifierKey.h:4-10`）。建议不支持，只认分左右的具体键，规则和键帽都更简单。

**D13 `status --json` 里的旧字段**

**定：A，留一个版本再删。** 0.14 照旧给、README 标了弃用，0.15.0 删掉（2026-10-22）；命令行连着升级途中的旧后台时，仍认它报的 `hotkey`、`hotkeyLabel` 来说热键叫什么。

- 现状：`speakmore status --json` 输出 `status.hotkey`（旧 id）、`status.hotkeyLabel`（它的名字）和 `settings.hotkey`（`src/cli/commands/lifecycle.mjs:120`），README 把 `--json` 当作对外功能写着（`README.md:347`、`386`），读它的是别人写的脚本。新设计里它们换成按动作目录生成的 `status["hotkey.dictate"]`、`settings["hotkey.dictate"]` 等。
- 选项 A：保留一个版本。下一版里三个旧字段照旧给（听写是六个旧键之一时给旧 id，是新组合时给 `null`），README 标"已弃用，再下一版删除"；再下一版删掉。代价是输出那一处十来行，用的还是 `legacy.mjs` 那张对照表，写明删除的版本。
- 选项 B：直接换，README 和更新说明写一句。
- 建议 A。AGENTS.md 红线 6 要求对外接口的不兼容变更走弃用周期；这也是全方案里唯一一处在输出上照顾旧写法，有删除日期，不是长期的兼容层。读这个输出的只有自己写脚本的人，用图形界面的用户碰不到。

### 7.2 需要真机验证的事项

动手前或对应步骤开始前要验的，按影响排序。

| # | 事项 | 影响哪一步 | 验证办法 |
| --- | --- | --- | --- |
| V1 | Mac：修饰键按下后再打开吞键 tap，紧跟的普通键会不会漏出去 | 第 7 步，D3 | **10-21 已验：不通过。** 由只听 tap 打开，间隔 0–2 ms 漏 1%–69%；由触发 tap 同步打开，合成 800 次、真键盘 13 次 0 漏（4.1） |
| V2 | Mac：安全输入下各类绑定的表现 | 第 7 步 | 密码框里试；`ioreg -l -w 0 \| grep SecureInput` 确认 |
| V3 | Mac：吞掉 fn 的 flagsChanged 能否压住地球仪键的系统动作；`AppleFnUsageType` 不存在时的默认行为 | 5.5 的 Fn 警告 | 设成"表情"，主动 tap 对键码 63 返回 nil；新建用户看默认选项 |
| V4 | Mac：地球仪键是否产生键码 179；fn + 方向键录到什么键码 | 5.1、5.5 | 只听 tap 记录全部事件 |
| V5 | Mac：吞掉修饰键 flagsChanged 后，后续 keyDown 是否仍带修饰位 | "修饰键不吞"的依据之一 | 吞右 ⌘ 的 flagsChanged 再按 X |
| V6 | Mac：session 层主动 tap 能否抢在 ⌘Space 之前 | 是否允许绑系统已占用的组合 | 吞 ⌘Space 的 keyDown，看 Spotlight |
| V7 | Mac：不带设备位的键盘（CapsLock 那一半不用验了，D11 不开放） | 左右判断的退路 | 接第三方键盘记录 flags 原值 |
| V8 | Mac：吞键 tap 后建排在前面（仓库注释的说法）；放行的同一个事件先后到两个 tap 时，时间戳、类型、键码是否不变 | 几个 tap 的分工和去重（4.1） | **10-21 已验：通过。** 后建的在前，被吞的键只听 tap 0/80 收到；时间戳合成 160/160、真键盘 71/71 一致 |
| V9 | Windows：Win 当热键时交回消息循环再插 0xE8 能否挡住开始菜单 | 第 8 步 | 真机绑左 Win 点一下 |
| V10 | Windows：插掩码能否挡住 Ctrl+Shift 切布局；微软拼音下钩子看到原 vk 还是 0xE5 | 5.5 的警告 | 装两个布局按组合；开拼音打字记 vkCode |
| V11 | Windows：别的程序注入的不分左右的 vk、扫描码为 0 的事件长什么样 | 5.1、第 8 步 | `e2e.ps1` 分三种注入方式打日志 |
| V12 | ~~Windows：吞掉 CapsLock 后大小写状态变不变~~ | 不用验了：D11 不开放 CapsLock | — |
| V13 | Windows：Raw Input 能否当钩子的看门狗 | 第 8 步（可选） | 回调里故意 `Sleep(1500)` 触发卸载，看能否检测并重装 |
| V14 | 两个系统：用户按着修饰键时模拟粘贴，修饰键会不会混进去 | 以后的"粘贴上一条"类动作 | 按住右 Alt / 右 Option 时调 paste |
| V15 | 升级时麦克风指示灯和悬浮条闪得明不明显 | D2 | 开发窗口里配 `AltRight` 和 `AltRight+Space` 实际按 |
| V16 | D1 定了全部松开才算；常用组合各按一轮，看 600 ms 规则误取消多不多 | D1 | 开发窗口里配 `ControlRight+Space` 实际按 |
| V17 | `navigator.keyboard.getLayoutMap()` 在 Electron `file://` 页面能否用 | 5.7 的后续 | 开发窗口控制台执行一次 |
| V18 | Typeless 运行时是否真的吞命中的键；"再贴一次"是否真的不能用 | 只影响对原版的描述 | 装着 Typeless 按 `Fn+Space`、`Ctrl+Cmd+V` |
| V19 | Mac：只跑 `RunLoop`、没有 `NSApplication` 的小帮手里，Carbon `RegisterEventHotKey` 的热键收不收得到（分路笔记 03 §3.2 已列） | 第 7 步，D3（单个 F 键、安全输入顶替） | **10-21 已验：只跑 RunLoop 收不到，而且键会被系统吃掉；改用 NSApplication（`.prohibited`）后合成 5/5、真键盘 3/3 收到** |
| V20 | Mac：安全输入开着时 `RegisterEventHotKey` 还触不触发（目前只有 Handy 的说法） | 4.1 安全输入，D3 | **10-21 已验：通过。** 合成 F13、⌥Space 各 5/5，iTerm 安全键盘输入下真键盘 ⌃⌥⌘K 3/3；同时 tap 收不到任何 keyDown |
| V21 | Mac：Carbon 和 tap 一起用时的细节：MacBook 上按 fn+F5（事件带 fn 位）时，修饰键传 0 的 F5 注册触不触发；绑 F5 后前台应用有没有收到（10-21 已验：只听 tap 看得到被 Carbon 接走的 keyDown，合成 F13 不会到达应用） | 4.1 单个 F 键 | 浏览器在前台时按 fn+F5，看页面刷不刷新；只听 tap 记日志 |
| V22 | Windows：左右 Shift、左右 Ctrl 各带不带 `LLKHF_EXTENDED`，扫描码是多少 | 4.2 修饰键按 vk 认的依据 | 真机按四个键，钩子里记 `flags` 和 `scanCode` |
| V23 | Windows：输入语言热键的默认值（左 `Alt+Shift`、`Ctrl+Shift`） | 5.5 的警告 | 设置 → 时间和语言 → 输入 → 高级键盘设置 → 输入语言热键 |
| V24 | Mac：安全输入开着时 `CGEventSourceKeyState(.hidSystemState, key)` 准不准 | 5.3 第 8 条 | 密码框里按住 Tab 不放，轮询这个接口 |
| V25 | Mac：录制中按 ⌘W、⌘Q、⌃Space 各会发生什么；渲染层 `preventDefault`、主进程 `before-input-event` 拦不拦得住默认菜单的快捷键 | 5.6 录制时吞键 | 开发窗口里分有、无辅助功能权限两种各按一遍 |
| V26 | Mac：辅助功能权限在运行中被撤销时，常开的触发 tap 会不会冻住整机；监听到权限变化后立刻 `CFMachPortInvalidate`，能不能避免或解冻 | 第 7 步，D3 的缓解 | 只在随时可以重来的 macOS 虚拟机里做，不在主人的电脑上做：装一个带触发 tap 的测试应用、授权后用 `tccutil reset Accessibility` 撤销，看键盘鼠标 |
| V27 | Windows：绑了右 Alt+空格，小帮手吞掉空格以后，系统的窗口菜单还弹不弹 | 5.5 只拦左 Alt+空格（语音翻译的默认键） | **10-22 已验：窗口菜单不弹。** 开发机记事本里真键盘按、合成按各两次，空格都吞住了。同时查出记事本的菜单栏被选中：掩码插早了，单按右 Alt 也一样（4.2 掩码），修好后 `e2e.ps1` 42/42 |
| V28 | Windows：绑了右 Alt+回车，小帮手吞掉回车以后，记事本的菜单栏、资源管理器的属性窗口、表格的单元格换行还会不会跟着来 | 5.5 只拦左 Alt+回车（划词翻译的默认键） | **10-23 部分已验：通过。** 开发机上合成按键，记事本两次、Edge 两次：焦点留在正文，菜单栏没被选中，回车也没漏进去（选中的字还在）。真键盘、资源管理器的属性窗口、表格还没试 |

---

## 附录 A 顺手发现（与本次重构无关或只是相关）

1. Windows 帮手钩子回调里的 `emit`、`onUIThread` 是阻塞发送，可能导致钩子被系统静默卸掉或自己等自己（`main_windows.go:38, 41-44`）。建议在重构前单独修。
2. `keys.go:18` 的注释"AutoHotkey 用的也是它"不准确：AHK 默认掩码键是左 Ctrl，0xE8 是文档推荐值。
3. 命令行 `config` 的提示在 Windows 上给出非法示例 `speakmore config set hotkey fn`（`zh-CN.mjs`、`en.mjs` 的 `cli.config.hintSet`，`windows` 一节没有覆盖；`test/cli/render/settings.test.mjs:44` 钉住了原文）。
4. `hotkeyKeycap`（`settings.mjs:47`）全仓无人调用。
5. Windows 帮手报错文案里的可选键是硬写的（`main_windows.go:302`），Mac 版是从字典生成的（`main.swift:321`）。
6. 两边帮手都先解析 `--key` 再看 `--check`，键名错时连 `--check` 也会 exit 2（`main.swift:318-329`）。App 不用 `--check`，现在没有影响。
7. 我们的状态机在 STARTING 阶段也接 `LONG_HOLD`（`machine.mjs:64-66`），原版在麦克风初始化期间不接；这一条没有测试。
8. Go 单测和 `e2e.ps1` 不在 `npm test` 里，仓库没有 CI；Swift 帮手没有单测。
9. App 顶层在 `src/app/main.mjs:137` 就读了设置，0.1 版的数据（含 `settings.json`）要到 `:370` 的 `migrateLegacyData` 才搬过来。直接双击打开、没先跑过命令行时，搬家的那一次按默认设置运行，下次启动才对（按代码顺序推断，未实测）。只影响 0.1 的数据；本次的旧设置换算要放在 `:137` 之前（5.9）。

## 附录 B 材料与分路笔记

本报告由五路调研汇总而成。分路笔记含完整取证过程，不进仓库，只在本机的 `.playwright-mcp/hotkey-research/`（被 `.gitignore:16` 排除）：

- 01 Typeless 逆向：`01-typeless.md`（含 REA Evidence 编号、键名表解析方法）
- 02 仓库现状：`02-ours.md`（含逐文件改动表、协议原文、测试清单）
- 03 macOS：`03-macos.md`（含本机探针输出、12 项真机待验清单）
- 04 Windows：`04-windows.md`（含参考实现对比、17 项待验清单）
- 05 跨平台设计：`05-design.md`（含各家产品的开放方式对比）
- 审查意见：`critique.json`（20 条，本版已逐条改入）

外部开源代码的只读副本当时放在临时目录，没有保留；要复核时按下列提交重新取。主要参考的提交：alt-tab-macos@240e3ff、VoiceInk@22e5ec5（GPL-3.0，只借鉴设计）、KeyboardShortcuts@772133d、MASShortcut@6f2603c、Handy@93c9ee0、hammerspoon@23e387e、OpenSuperWhisper@c8e6fe7、PowerToys@cf45de4、AutoHotkey@0b8e6fa、handy-keys@e7d1b8e、OpenWhispr@e4280ad、mumble@c7a8993、node-global-key-listener@949d7c2、electron@30db518、Chromium main（`dom_code_data.inc` sha256 前缀 `841e2c58e638`）。

分路笔记之间的分歧及本文的取舍：

| 分歧 | 本文取舍 | 理由 |
| --- | --- | --- |
| Typeless 原生层吞不吞命中的键（05 记为没读清，01 已读清） | 按 01：精确命中且不全是字母数字时吞，按下松开都吞 | 01 反编译了 `isShortcutMatch`、`handleEvent`；运行时仍未验证 |
| "再贴一次"怎么触发（05 沿用 docs/10 的 globalShortcut 推断，01 说没有触发路径） | 按 01 | 主进程 `globalShortcut` 出现 0 次，成文时复核 |
| 协议里的键用 code 名（03、04）还是原生码（05） | 原生码 | 小帮手才能完全不带键名表 |
| 录制时吞不吞（04 全吞，05 不吞，03 可选） | 两边都吞；Mac 没有辅助功能权限时退到窗口内拦截 | Windows 不吞会弹开始菜单；Mac 不吞时 ⌘Space 这类键会被系统先执行、抢走焦点，录制跟着取消（5.6） |
| 录制何时定稿（Typeless 第一次松键，04 全部松开） | 第一次松键 | 两键以内结果相同，反馈更快 |
| Mac 吞键 tap 按需开（03）还是存在绑定时常开（05） | 吞键 tap 仍按需开，但由只收修饰键事件的触发 tap 同步打开（V1 实测只听 tap 打开会漏，D3 改定） | 打字键不在必经之路上；只有修饰键事件经过常开的主动 tap |
| 键表份数（任务描述 3 份，02 查出 4 份） | 4 份键表加 2 份按 id 写的文案 | `main_windows.go:302` 的报错文案也是一份 |
| 回滚写法（05 两处都写；第二版只写一处） | 第三版：不再写旧的 `hotkey`，第一次启动时换算掉；文件里再出现 `hotkey` 就以它为准 | 主人 10-21 定的方向：内部做干净、老用户无感；退回旧版用默认键，照样起得来 |
| Typeless 录制控件的行号（01 写 1920-1940） | `R:DdHsgR7k.js:1951-1971`，判断在 1962 | 成文时对照可读源码复核 |
