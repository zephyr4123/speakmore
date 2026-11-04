---
name: links-no-cjk-punctuation
description: issue 回复、README、投稿文案里，网址后面别紧跟中文标点（括号、逗号、句号），要换行、加空格或写成 Markdown 链接
metadata:
  node_type: memory
  type: feedback
  originSessionId: 6b5e9ce5-00ff-48cc-99ba-a927306fc7c3
  modified: 2026-11-04T01:22:33.011Z
---

网址后面紧跟中文标点时，GitHub 等平台会把标点当成网址的一部分，点进去就是 404。

**Why:** 2026-10-17 agent 在 issue #1 里回复写的是 `https://dl.zephyrxiang.com/speakmore/v0.9.0/SpeakMore-Setup-x64.exe（Windows 10 1809 及以上…）`，链接被识别成了 `…exe（Windows`。CDN 日志里有 3 个真实用户点到这个链接、拿到 404（10-18 用 `npm run stats` 查出来的，见 [[speakmore-download-stats]]）。

**How to apply:** 凡是对外写的链接（issue 和 PR 回复、README、投稿文案、官网），网址单独占一行，或者后面留一个空格，或者写成 `[文字](网址)`。发出去之前看一眼网址的结尾。
