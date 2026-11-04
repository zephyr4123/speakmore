import assert from "node:assert/strict";
import { test } from "node:test";
import { renderConfig, renderThemes } from "../../../src/cli/render/settings.mjs";
import { THEMES } from "../../../src/themes/index.mjs";
import { keycapsZh, plain, settings } from "./fixtures.mjs";

test("设置逐项列出现在的值、从哪来、能填什么，后面是文件在哪", () => {
  const text = renderConfig(
    {
      settings: {
        ...settings,
        "hotkey.dictate": { value: '["Fn","MetaRight"]', source: "file" },
        model: { value: "gemini/gemini-3.8-flash", source: "env", env: "GEMINI_MODEL" },
      },
      paths: {
        home: "/home/.speakmore",
        settingsFile: "/home/.speakmore/settings.json",
        logFile: "/home/.speakmore/logs/main.log",
      },
    },
    plain,
  );
  // 热键：值后面写键帽，几个组合任一个都行；不列可选值，说明是设置项自带的
  assert.match(
    text,
    new RegExp(`hotkey\\.dictate\\s+\\["Fn","MetaRight"\\]\\s+${keycapsZh("Fn", "MetaRight")} · 存在设置文件里`),
  );
  assert.match(text, /hotkey\.cancel\s+\["Escape"\]\s+esc · 默认/);
  assert.match(text, /「取消」的快捷键：两键以内的任意组合，写法见 README\n/);
  // 用的是改名前的环境变量：照实写它的名字
  assert.match(text, /model\s+gemini\/gemini-3\.8-flash\s+Gemini · 这次运行来自环境变量 GEMINI_MODEL/);
  assert.match(text, /thinking\s+MINIMAL\s+.*默认/);
  assert.match(text, /mode\s+native\s+直出：录音直接交给模型 · 默认/);
  assert.match(text, /native \/ local \/ private/);
  assert.match(text, /privateTranscriber\s+qwen3-asr-0\.6b-q8/);
  assert.match(text, /polish\s+deepseek\/deepseek-flash\s+默认/);
  assert.match(text, /customUrl\s+默认/);
  assert.match(text, /customParams\s+默认/);
  assert.match(text, /modelSource\s+cn\s+魔搭 · 默认/);
  assert.match(text, /cn \/ original/);
  assert.match(text, /localModelMemory\s+resident\s+常驻内存 · 默认/);
  assert.match(text, /resident \/ 1m \/ 5m \/ 10m \/ 30m/);
  assert.match(text, /acceleration\s+auto\s+自动 · 默认/);
  assert.match(text, /auto \/ cpu/);
  assert.match(text, /barHint\s+on\s+显示 · 默认/);
  assert.match(text, /on \/ off/);
  assert.match(text, /outputScript\s+simplified\s+简体 · 默认/);
  assert.match(text, /simplified \/ traditional-hk \/ traditional-tw/);
  assert.match(text, /livePreview\s+on\s+显示 · 默认/);
  assert.match(text, /dockIcon\s+on\s+显示 · 默认/);
  assert.match(text, /theme\s+ink\s+墨 · 默认/);
  assert.match(text, /ink \/ cinnabar \/ indigo/);
  // 示例按系统写（Windows 上没有 fn）
  assert.match(text, /speakmore config set hotkey\.dictate (Fn\+Space|ControlRight)/);
  assert.match(text, /speakmore config unset hotkey\.dictate/);
  assert.match(text, /目录\s+\/home\/\.speakmore\n/);
  assert.match(text, /\/home\/\.speakmore\/logs\/main\.log/);
  assert.match(text, /speakmore uninstall/);
});

test("主题：一行一套，现在用的那套打一个点；终端支持 24 位色时画出那一套悬浮条的样子", () => {
  const view = { themes: THEMES, setting: { value: "cinnabar", source: "file" } };
  const text = renderThemes(view, plain);
  assert.match(text, /^主题\n/);
  assert.match(text, /\n {4}ink\s+墨\s+黑白/);
  assert.match(text, /\n {2}● cinnabar\s+朱砂\s+一种暖红/);
  assert.match(text, /现在用的是朱砂（cinnabar） · 存在设置文件里/);
  // 举的例子是另一套，不是已经在用的这套
  assert.match(text, /换一套：speakmore theme ink/);
  assert.ok(!text.includes("\x1b["));

  const painted = renderThemes(view, { ...plain, color: true, truecolor: true });
  // 朱砂的声波是那种暖红：oklch(0.74 0.17 32)
  assert.ok(painted.includes("\x1b[38;2;255;124;99m"), JSON.stringify(painted));
  assert.equal(painted.split("\x1b[48;2;").length - 1 >= THEMES.length, true);
  // 只开了普通颜色、没有 24 位色时不画
  assert.ok(!renderThemes(view, { ...plain, color: true, truecolor: false }).includes("[48;2;"));
});
