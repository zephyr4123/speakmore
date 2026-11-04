---
name: speakmore-model-mirror
description: 本地模型的配置表只有一份（src/models/catalog.mjs）；10-20 起国内源是魔搭（用户个人账号 ardsfsw 下一个模型一个仓库，钉提交）；老的 COS 国内源 10-20 已撤掉
metadata:
  node_type: memory
  type: project
  originSessionId: c790f439-dd17-4af4-a34b-18711867efb4
  modified: 2026-11-04T01:21:52.277Z
---

2026-10-16 用户定的：用的人几乎都在国内，模型要能不翻墙下；原来的地址保留叫 original，另放一份当国内源，用户可以选；配置要全局只有一份（原话："要用单例模式的思维去统一管理，全部从一个 config 里面出"）。

- **配置表**：`src/models/catalog.mjs`。下载源（SOURCES：cn 是魔搭；original 是 Hugging Face 加 hf-mirror）、每个模型的文件和 sha256、许可、原作者、`mirror.revision`（魔搭上钉的提交）、标签和实测数字都在这里。下载、App、命令行、评测、上传脚本都读它。
- **选源**：设置项 `modelSource`，默认 cn。选的源先试，下不动、卡住就换下一个，都按 sha256 校验；断了的 `.part` 留着，换源或下次带 Range 接着下（10-20 加的，两台电脑真网络上掐断续传都验过）。
- **国内源 = 魔搭**（10-20 换的）：四个模型在用户个人账号 `ardsfsw` 下（建组织要人工审核，用户选先用个人账号；以后换组织就重传、改 `MODELSCOPE_OWNER` 和各项 `mirror.revision`）。地址 `modelscope.cn/models/<owner>/<id>/resolve/<提交>/<文件>`，大文件跳到魔搭自己的 CDN、认 Range；小文件不认 Range。魔搭不收下载费。
- **加模型或换文件**：改配置表，`scripts/release/with-modelscope-key.sh npm run sync-models -- --from <本机模型仓> --download`，把它报的提交填进 `mirror.revision`。令牌经按需加载器给（凭据名在 `.machine.env` 的 `MODELSCOPE_CREDENTIAL`），SDK 装在 `.tools/modelscope/venv`。`npm run sync-models -- --check` 不用令牌。
- **实测速度**：Windows 游戏电脑直连，魔搭 9.7–11.3 MB/s，Hugging Face 连不上。10-20 在用户 Mac 上（代理规则模式，国内直连）每个源 40 秒两轮：魔搭 9.9、9.8 MB/s，hf-mirror 1.6，同时老国内源 8.5、8.7；README 和官网的图照这个改了（Hugging Face 沿用 10-17 直连的 0.7）。用户头一次量魔搭只有 0.4 MB/s，之后再量都正常，多半是 CDN 节点头一次没缓存，未确认。`node scripts/dev/model-speed.mjs` 在代理的虚拟网卡开着时不量。
- **老国内源已撤**（2026-10-20，0.11.0 发完、两台电脑都升上去之后，用户授权的）：COS 桶连同四个模型删了，CDN 域名 `models.speakmore.zephyrxiang.com` 停用并删掉，解析和证书也删了；仓库里的 `MODELS_BUCKET` 一并去掉。0.10.1 及以前的客户端下模型时这个源连不上，会换到 Hugging Face。

**Why:** 国内用户直连 Hugging Face 很慢；模型下载是自己 CDN 流量费的大头，也会被刷，换到魔搭不花自己的流量。
**How to apply:** 模型的任何信息只加在配置表里。云上的改动按 [[cloud-changes-user-runs]] 交给用户跑（用户明确授权的除外）。相关：[[speakmore-distribution-rework]]、[[speakmore-release-on-cos]]、[[speakmore-model-plaza]]。
