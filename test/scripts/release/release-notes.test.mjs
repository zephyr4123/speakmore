import assert from "node:assert/strict";
import { test } from "node:test";
import { changesIn, releaseNotes, summaryOf } from "../../../scripts/release/release-notes.mjs";

test("改动只取合进主干的分支和 PR：发版分支（release-版本号）、记忆、版本号和直接提交的都不列", () => {
  const subjects = [
    "版本号 0.18.0：录音时在悬浮条上预览文字；README 下载链接换成 0.18.0",
    "记忆：PR #18 到 #20 的处理",
    "合并 PR #19：录音时在悬浮条上预览文字（本机识别），合并时改成只转写最近 8 秒并精简",
    "合并 codesign-retry：签名碰到时间戳服务没连上自动重签",
    "README：三张图加 ?v=2 让它重取",
    "合并 release-0.17.2：听写成品可选简体或繁体；版本号 0.17.2",
    "合并 release-accept：发完版的验收挪进 scripts/release/",
  ];
  assert.deepEqual(changesIn(subjects), [
    "录音时在悬浮条上预览文字（本机识别），合并时改成只转写最近 8 秒并精简（#19）",
    "签名碰到时间戳服务没连上自动重签",
    "发完版的验收挪进 scripts/release/",
  ]);
});

test("标题那句去掉开头的版本号，两种写法都认", () => {
  assert.equal(summaryOf("SpeakMore 0.20.0：Mac 上默认显示在程序坞", "0.20.0"), "Mac 上默认显示在程序坞");
  assert.equal(summaryOf("0.19.0：历史记录可搜索（PR #22）", "0.19.0"), "历史记录可搜索（PR #22）");
  assert.equal(summaryOf("热修：更新后不再白屏", "0.19.1"), "热修：更新后不再白屏");
});

const notes = releaseNotes({
  version: "0.20.0",
  summary: "Mac 上默认显示在程序坞",
  changes: ["悬浮条改成面板", "历史记录可导出（#22）"],
});

test("说明里有标题那句和每一条改动", () => {
  assert.ok(notes.startsWith("Mac 上默认显示在程序坞\n"));
  assert.ok(notes.includes("\n- 悬浮条改成面板\n- 历史记录可导出（#22）\n"));
});

test("下载链接指向这个版本的三个安装包，附两行终端安装", () => {
  for (const file of ["SpeakMore-arm64.dmg", "SpeakMore-x64.dmg", "SpeakMore-Setup-x64.exe"]) {
    assert.ok(notes.includes(`https://dl.zephyrxiang.com/speakmore/v0.20.0/${file}`), `缺 ${file}`);
  }
  assert.ok(notes.includes("curl -fsSL https://dl.zephyrxiang.com/speakmore/install.sh | bash"));
  assert.ok(notes.includes("irm https://dl.zephyrxiang.com/speakmore/install.ps1 | iex"));
});

test("网址后面不紧跟中文标点：GitHub 会把标点连进链接，点开 404", () => {
  for (const match of notes.matchAll(/https:\/\/\S+/g)) {
    assert.doesNotMatch(match[0], /[，。；：）、]/, `链接连着中文标点：${match[0]}`);
  }
});

test("没有可列的改动时不写空的改动一节", () => {
  const bare = releaseNotes({ version: "0.20.1", summary: "热修", changes: [] });
  assert.ok(!bare.includes("## 改动"));
  assert.ok(bare.includes("v0.20.1/SpeakMore-arm64.dmg"));
});
