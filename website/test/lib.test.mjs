import assert from "node:assert/strict";
import { test } from "node:test";
import { matchLocale, otherLocale, pickLocale } from "../src/lib/locale.js";
import { onPhoneOrTablet, siteLinks } from "../src/lib/site.js";
import { cutMarks, fill, fillText } from "../src/lib/text.js";

test("选语言：网址参数 > 上次选的 > 浏览器", () => {
  assert.equal(pickLocale({ query: "zh-CN", stored: "en", languages: ["en-US"] }), "zh-CN");
  assert.equal(pickLocale({ query: null, stored: "zh-CN", languages: ["en-US"] }), "zh-CN");
  assert.equal(pickLocale({ query: null, stored: null, languages: ["zh-TW", "en"] }), "zh-CN");
  assert.equal(pickLocale({ languages: ["en-GB", "zh-CN"] }), "en");
});

test("选语言：认不出来的跳过，全都认不出来是英文", () => {
  assert.equal(pickLocale({ query: "fr", stored: "garbage", languages: ["de-DE", "zh-Hans-CN"] }), "zh-CN");
  assert.equal(pickLocale({ query: "", stored: null, languages: ["ja-JP"] }), "en");
  assert.equal(pickLocale({}), "en");
  assert.equal(matchLocale(undefined), null);
  assert.equal(matchLocale("ZH"), "zh-CN");
  assert.equal(matchLocale("english"), null);
});

test("切换按钮在两种语言之间来回", () => {
  assert.equal(otherLocale("en"), "zh-CN");
  assert.equal(otherLocale("zh-CN"), "en");
});

test("口述的删除标记拆成片段", () => {
  assert.deepEqual(cutMarks("~~嗯，~~我们开会~~吧~~"), [
    { text: "嗯，", cut: true },
    { text: "我们开会", cut: false },
    { text: "吧", cut: true },
  ]);
  assert.deepEqual(cutMarks("没有标记"), [{ text: "没有标记", cut: false }]);
  assert.throws(() => cutMarks("~~没收尾"), /没有成对/);
});

test("占位换成值，值可以不是字", () => {
  const link = { type: "a" };
  assert.deepEqual(fill("一把 {gemini} 或 {openai}", { gemini: link, openai: "O" }), ["一把 ", link, " 或 ", "O"]);
  assert.equal(fillText("Version {version}", { version: "0.6.2" }), "Version 0.6.2");
  assert.throws(() => fill("{missing}", {}), /没有给值/);
});

test("地址都从配置和版本号算出来，结尾多一道斜杠也不出错", () => {
  const links = siteLinks(
    {
      siteUrl: "https://a.example",
      downloadBase: "https://dl.example/sm/",
      mediaBase: "https://m.example/",
      repository: "https://github.com/o/r",
    },
    "1.2.3",
  );
  assert.equal(links.downloads.arm64, "https://dl.example/sm/v1.2.3/SpeakMore-arm64.dmg");
  assert.equal(links.downloads.x64, "https://dl.example/sm/v1.2.3/SpeakMore-x64.dmg");
  assert.equal(links.downloads.windows, "https://dl.example/sm/v1.2.3/SpeakMore-Setup-x64.exe");
  assert.equal(links.install.mac, "curl -fsSL https://dl.example/sm/install.sh | bash");
  assert.equal(links.install.windows, "irm https://dl.example/sm/install.ps1 | iex");
  assert.equal(links.media("shots/a.webp"), "https://m.example/shots/a.webp");
  assert.equal(links.license, "https://github.com/o/r/blob/main/LICENSE");
});

test("手机、平板认得出来（装不了安装包，下载换成复制链接）：iPadOS 的 Safari 自称 Mac，靠触点数认", () => {
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
  const android = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36";
  const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15";
  const windows = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36";
  assert.equal(onPhoneOrTablet({ userAgent: iphone, maxTouchPoints: 5 }), true);
  assert.equal(onPhoneOrTablet({ userAgent: android, maxTouchPoints: 5 }), true);
  assert.equal(onPhoneOrTablet({ userAgent: mac, maxTouchPoints: 5 }), true);
  assert.equal(onPhoneOrTablet({ userAgent: mac, maxTouchPoints: 0 }), false);
  // 带触屏的 Windows 笔记本照样能装
  assert.equal(onPhoneOrTablet({ userAgent: windows, maxTouchPoints: 10 }), false);
  // 大屏安卓平板上的 Chrome 默认要桌面版网页，自称 Linux 桌面，也靠触点数认
  const androidDesktop =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  assert.equal(onPhoneOrTablet({ userAgent: androidDesktop, maxTouchPoints: 5 }), true);
  assert.equal(onPhoneOrTablet({ userAgent: androidDesktop, maxTouchPoints: 0 }), false);
});

test("下载页的地址：给手机访客复制，到电脑上打开", () => {
  const links = siteLinks(
    {
      siteUrl: "https://example.com/",
      downloadBase: "https://dl.example.com",
      mediaBase: "https://m.example.com",
      repository: "r",
    },
    "1.2.3",
  );
  assert.equal(links.downloadPage, "https://example.com/#download");
});
