---
name: website-no-typeless
description: 官网不提 Typeless：不比价、不链逆向笔记、不写无关联声明；有测试守着
metadata:
  node_type: memory
  type: feedback
  originSessionId: abb1c590-5137-4efe-b88f-657a8192a95e
  modified: 2026-11-04T01:21:50.582Z
---

官网（`website/`）上不出现 Typeless。2026-10-15 用户看第一版后说："砍掉和typeless的关联,不要提"。第一版里有三处被删掉了：成本一段拿 Typeless Pro 的 $144 年费比价、开源一段链到逆向分析笔记、页脚的"与 Typeless 无关联"。

**Why:** 官网要独立讲 SpeakMore 自己，不借别人的名字，也不把产品和逆向挂在一起。

**How to apply:**
- 成本只讲自己的花费（应用免费、单次 $0.0003、每月 $0.67–1.05、免费额度 $0），不和任何订阅产品比。
- `website/test/no-typeless.test.mjs` 会查源码、文案和入口页，写进去就不过。
- 这条只说了官网。README、仓库里的逆向资料（`targets/typeless/`）用户没说要动，动之前先问。

相关：[[website-copy-formal]]、[[speakmore-website]]
