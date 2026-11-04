---
name: skill-routing-general
description: 密钥治理、多仓拓扑、云运维、Multica、多 agent 编排、长任务通知、去 AI 腔该用哪个 skill
metadata:
  node_type: memory
  type: reference
  origin: skills-scaffolding
  scaffold_sha: db890f689b30
  originSessionId: abb1c590-5137-4efe-b88f-657a8192a95e
  modified: 2026-11-04T01:21:51.685Z
---

遇到下列场景**主动**调用对应 skill，不等用户点名。

- **整理 / 审计本机密钥、判断某 token 能不能删、新机器配凭据**：`zephyr-secrets-hygiene`（按"谁能读到"分层归位、登记册要能机器对账、`withkey` 按需加载器；删之前查真正的调用方且不 rm 只隔离。纯方法论，不带脚本）
- **"外层协作仓 + 多个独立业务代码仓"的拓扑**（定多仓关联方式、初始化或承接 nested 项目、写跨仓 git 运维 CLI）：`zephyr-nested-git`（外层零业务代码只存指针 manifest；红线在代码里——pull 只 ff-only、push 永不 force、fetch 失败不吞）
- **配置云上资源 / 让 agent 接管云账号运维**（对象存储、CDN、证书、DNS；线上 CDN 慢、握手失败、测速反复的排查）：`zephyr-cloud-cli-ops`（人只做付钱 / 开通 / 发密钥，其余 agent 用 CLI+SDK 完成；纯方法论）
- **Multica 工作区操作**（派 issue 给 agent、看板 / 轨迹 / 汇报、onboarding、贴 multica.ai URL）：`zephyr-multica-collab`
- **Multica 记忆读取**（把 workspace 的 issue 网络 / 结论 / 轨迹 / 成本读全读透，只读）：`zephyr-multica-read`
- **多 agent Workflow 编排**（有份量的多步工程活，决定何时上编排、选什么形状；长跑 workflow 卡住或大批失败也走它）：`zephyr-workflow-orchestration` ⚙️CC
- **让外部长任务跑完来找 agent**（CI、部署、远程队列这类不会主动通知的活；"静默≠正常"的哨兵纪律）：`zephyr-background-watch` ⚙️CC
- **去 AI 腔、加人味**（编辑 AI 生成的文稿）：`humanizer` ⚙️CC（30 种 AI 写作特征检测改写）
- **给新项目装上这套红线和记忆**（用户说"安装 zephyr-scaffold-init 脚手架"）：`zephyr-scaffold-init`

相关：[[skill-library]]
