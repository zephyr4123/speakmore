---
name: speakmore-hotkey-any-key
description: 热键开放成任意键或两键组合（配置驱动、内部做干净、老用户无感）；报告 docs/hotkey-research.md，D1–D13 10-21 已拍板；10-21 合进 main（d640932）、随 0.14.0 发布
metadata:
  node_type: memory
  type: project
  originSessionId: c790f439-dd17-4af4-a34b-18711867efb4
  modified: 2026-11-04T01:20:22.504Z
---

2026-10-20 用户提的：热键绑定做成配置驱动，选的是"开放成任意键或组合键"（用户在设置里录任意键或组合键，存进配置），不是只把键表合成一份。10-21 补充：以后加别的功能要绑别的热键、要能改键，组合"两个键最多"；先纯调研、存文档，不直接开干。

现状：只能选一个单独的修饰键（Mac 四个、Windows 两个），键表在 native/main.swift、native/windows/keys.go、src/storage/settings.mjs 和 Windows 报错文案四处。

10-21 调研做完：Typeless 逆向、仓库现状、macOS、Windows、跨平台设计五路，加一轮对抗性审查（20 条全改进去）。报告 `docs/hotkey-research.md`，分路笔记和审查意见只在本机 `.playwright-mcp/hotkey-research/`。要点：底层仍是 CGEventTap / WH_KEYBOARD_LL，键用 W3C code 名、JS 里一张键表，匹配和吞键在小帮手里做，绑定表用 `bind` 下发。

10-21 压缩后用户追加方向："彻底做成配置驱动，完完整整做干净，先不要考虑向后兼容"，理由是以后要加转写、翻译之类的功能，配置不好改就做不下去。当天用户又补一句：只加十来行代码，但老版本的使用者必须完全无感，对这些人来说能感知到的只有热键能自定义、能组合。报告第三版已按此改（分支 docs/hotkey-clean）。所以报告里为兼容留的尾巴（`hotkey`/`hotkeys.dictate` 两处存、`status.hotkey` 旧格式加 `dictateCombo`、`hotkeys` 等第二个动作再升格、第一版只开放听写改键、第 3 步保留 `--key` 过渡）都不要了。第三版：动作目录 `src/hotkeys/actions.mjs` 是唯一出处，每个动作生成一项普通设置 `hotkey.<动作>`（值是组合字符串），界面、命令行、状态按目录生成；旧写法只在入口认（第一次启动换算设置文件、`SPEAKMORE_HOTKEY`、`config set hotkey`），存的报的都是新写法；退回旧版用默认键照样起得来（`resolveSettings` 只遍历 SETTINGS，已核对）。唯一在输出上照顾旧写法的是 D13（`status --json` 旧字段留一版）。

10-21 D1–D13 拍板（报告 1.2、7.1 记着）。和 agent 建议不同的：D1 组合全部松开才算松开（用户用 Typeless 顺手）；D4 一个动作能绑多个（上限 4），设置页照 Typeless 截图那样每个组合一个框、× 删、"添加另一个"，设置文件存成列表，用户嫌逗号拼接审美低；D9 只认键盘，鼠标键以后也不做；D10 新功能必须带默认快捷键、引导页要讲到，"留空绝对不行"，具体键做那个功能时再定；D11 单按 Shift 和 CapsLock 都不开放。其余按建议：D2 允许前缀并提醒、D3 Mac 按需拦截、D5 默认键不变、D6 一律标左右、D7 走 config set、D8 管理员窗口只提示、D12 不支持任一侧、D13 status --json 旧字段留一版再删。

10-21 真机实验（程序和数据在本机 .playwright-mcp/hotkey-research/experiments/）：V1 不通过，只听 tap 事后打开吞键 tap 会漏键（人同时按能按出 0.4 ms 间隔）；用户在选项里选了"同步触发"：有修饰键+普通键绑定时常开一个只收 flagsChanged 的主动 tap，同步回调里打开吞键 tap，实测 0 漏。V19：小帮手要改用 NSApplication（.prohibited）跑，只跑 RunLoop 时 Carbon 会吃键不回调。V8、V20 通过。权限撤销冻住整机的风险只在虚拟机里验（V26），别在用户电脑上试。

10-21 实施进度：第 0–10 步已提交（第 8 步 924d8f4 Windows 掩码/假修饰键/睡眠解锁重装/管理员窗口提示；第 9 步 4edb3d5 录键；第 10 步 026fc47 键帽成组）。第 7 步实测推翻了报告里"tap 挪到独立线程"（独立线程漏 57/200 个空格），tap 留在主线程。回归：Mac `node scripts/dev/mac-hotkeys.mjs --secure-input`（42 项），Windows `WAIT=150 scripts/dev/win-desktop.sh - < native/windows/e2e.ps1`（39 项）。第 11 步 a9b88b4（README、文档、引导页截图；首页、官网图不用换）；录键结束原因分开记 27ec5db。第 12 步：两台各装线上 0.13.1、设右 Control/右 Ctrl，用 0.14.0-e2e.1 测试包升级（换算、热键、状态都对），退回 0.13.1 用默认键起来，再升回照旧；Mac 打包 App 直接打开会换算并记 settings_migrated。命令行先换算时不记日志，留给审查。
10-21 统一审查：五个方面 32 条（确认 21、可能 6、驳回 5），修了 24 条（ea20447、2f9485e、1ff687e、05657ae），另把 15 条写死 Mac 键名、在 Windows 上红的测试改成按系统给期望（b230feb）；验证记录在 docs/development.md 末尾。用户 10-22 回 issue #13 说两小时内上新版，提的人已关 issue；发版后在 #13 下补一句版本号和改键入口。
跑 Mac 合成按键回归前先看键盘空闲（ioreg HIDIdleTime ≥ 30 秒）：10-21 用户正在打字时跑过一次，录键那几项录到真键、也吞了用户几个字。Windows 开发机的 build\key-helper.exe 不随 win-sync 更新，改了 Go 要本机交叉编译后拷过去再跑 e2e。留给统一审查的：小帮手在锁屏时启动不知道屏幕锁着（第 7 步遗留）。10-21 子 agent 在锁屏时跑过一次合成按键，安全输入那几下可能进了锁屏密码框；之后发键程序在锁屏、切走用户、别的应用开着安全输入时拒发。

**Why:** 顺着目录重构"写死的都改成配置驱动"的思路提的；以后加功能要绑新热键。
**How to apply:** 决定都定了，不要再重议；在 feat/hotkey-any-key 上按第 6 节的步骤一步一提交。
