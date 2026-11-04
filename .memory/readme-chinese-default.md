---
name: readme-chinese-default
description: "SpeakMore 的 README 中文为主页（README.md）、英文切换（README.en.md），按\"五个自由\"写，讲好不讲坏、多配图，图放图片桶"
metadata:
  node_type: memory
  type: feedback
  originSessionId: abb1c590-5137-4efe-b88f-657a8192a95e
  modified: 2026-11-04T01:21:36.624Z
---

README 中文版是主页 `README.md`，英文版 `README.en.md` 作为切换，两份同步改（2026-10-17 用户说"默认显示中文版 readme，英文版作为切换"；之前是英文为主，已改）。

写法（2026-10-14 起陆续定的）：
- **书面语，像写报告一样简洁干练**（2026-10-17 用户看了第一版"五个自由"README 说"太口语化了，写得太像小学生写作文、像口水话一样"，要求彻底重构语言）。中文用"支持……""无需……""即可""均""仅"这类书面表达，少用第二人称"你"，不用"任你接""就用哪家""真说一句""不用重配""国内也快"这类口语；英文同样正式（"is supported""requires no…"），不用"Prefer a terminal?"这类口吻。和官网的要求一致，见 [[website-copy-formal]]。
- **能分点就分点，一点一个信息**，不堆成大段文字（2026-10-17 原话"不要堆成一大坨文字"）。段落只留一句引导语，后面接列表。
- **表格不换行**，尤其是价格：中文版价格只用人民币、不加括号注美元，英文版只用美元；单元格写短，长说明挪到表下的列表或小字。改完在 GitHub 样式、README 宽度（约 830px）下量一遍每个单元格是否折行。
- HTML 排版、配轻量 emoji，简单干练，不写成论文；细节收进折叠块，开发和验证记录放 docs/development.md。
- 主旨是"自由"，五节：模型、方式、硬件、隐私、花钱。原话"讲好不讲坏"：不写已知不足、不写以后要做什么。
- 和 Typeless 的对比只放 README，要列它的每一档套餐，SpeakMore 按推荐组合、每天 100 次估月成本（和 App 同一口径）。
- 数字要有出处（官网价、实测、bench/results）；对外说法照实写。
- 原话"能补图就尽量补图，不要只是干巴巴的文字和列表"。图用真 App 截（隔离家目录、造的数据），**传到图片桶、不从仓库引用**（原话"之后咱们做视频和做网站时都会用到这些图，所以这东西必须都得上桶"），流程见 docs/development.md 的"README 的图"。

**Why:** README 是门面，用户看重成本、隐私和观感；SpeakMore 的用户多在国内。
**How to apply:** 改 README 时两份一起改、图一起换；推上 GitHub 后查一遍 camo 代理取到的图不是空的。相关：[[website-no-typeless]]、[[desktop-copy-and-look]]、[[speakmore-website]]。
