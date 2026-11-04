---
name: mac-keys-taken
description: 用户 Mac 上 Typeless 占着左 fn 和右 ⌘，键盘没有右 Ctrl；开发版 SpeakMore 的热键、合成按键测试都要避开
metadata:
  node_type: memory
  type: user
  originSessionId: 4b3f4054-1581-427e-aaee-1842cfa6c5c8
  modified: 2026-11-04T01:22:25.183Z
---

2026-10-21 用户说的：Typeless 把左 fn 和右 ⌘ 都占了。用户用的是苹果键盘（MacBook 自带），右边只有 ⌘ 和 ⌥，没有右 Ctrl；同一天 agent 把开发窗口的听写键设成右 Ctrl、又换成右 ⌘，两次都选错了。

**Why:** 选了这几个键，开发版的热键要么按不出来，要么一按就把 Typeless 也触发了，用户没法在开发窗口里试。

**How to apply:**
- 从源码起的开发版（[[ui-review-in-dev-window]]）听写键用右 ⌥。正式版 SpeakMore 默认也是右 ⌥，所以先确认正式版没在运行；正式版开着时，改用一个两键组合，并当面问用户用哪个。
- 别用 fn、右 ⌘、右 Ctrl。左边的单个修饰键本来就不让绑。
- 合成按键的回归测试（scripts/dev/mac-hotkeys.mjs）不合成 fn，见 [[speakmore-hotkey-any-key]]。
