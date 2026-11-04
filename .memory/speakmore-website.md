---
name: speakmore-website
description: SpeakMore 官网：域名、证书、图片的桶和 CDN、代码在 website/、上线必须用 Docker；图片域名的证书 2027-01-13 到期要续
metadata:
  node_type: memory
  type: project
  originSessionId: 6b5e9ce5-00ff-48cc-99ba-a927306fc7c3
  modified: 2026-11-04T01:21:33.586Z
---

2026-10-15 用户让先把官网的域名备好，再开始搭官网。

- 域名 `speakmore.zephyrxiang.com`：DNSPod 里一条 A 记录指向那台服务器（ssh 别名 `zephyr-web`），和同机的 `aaai4s` 子域名一个样子。解析托管在发布用的同一个腾讯云账号下，用 `scripts/release/with-cos-key.sh` 加载密钥跑 tccli（[[speakmore-release-on-cos]]）。
- 服务器上的 nginx 站点文件是 `/etc/nginx/sites-available/speakmore-site`（软链进 sites-enabled），内容和仓库的 `website/host-nginx.conf` 一致：80 端口留着 ACME 目录、其余 301 到 https；443 反代到容器的 127.0.0.1:9800（2026-10-15 上线，之前临时 302 到 GitHub，那版备份在服务器的 `/home/ubuntu/backups/`）。照同机别的站点的惯例，改完先 `sudo nginx -t` 再 reload。
- 证书是 certbot 签的 Let's Encrypt（webroot `/var/www/letsencrypt`），续期配置里带 `renew_hook = systemctl reload nginx`，系统的 certbot.timer 自动续，不用手动管。
- 这台服务器的资源够放官网（2 核 4G，另外跑着用户的个人网站和另一个项目的官网）。安装包仍走 COS 加 CDN（dl.zephyrxiang.com），官网的下载链接从那里取，不占这台机器的带宽。

- 官网代码在 `website/`（2026-10-15 第一版）：React + Tailwind v4 + Vite，配置在 `website/site.config.json`，说明在 `website/README.md`。
- 官网的截图不进仓库：放在单独的私有 COS 桶（桶名在 `.machine.env` 的 `SITE_MEDIA_BUCKET`），前面是 CDN 域名 `media.speakmore.zephyrxiang.com`（全球加速、只让 CDN 读、防盗链只放行官网、localhost、127.0.0.1 和空来源、每天 10 GB 封顶超了 404、强制 https）。**这个域名的证书也是 90 天的免费证书，2027-01-13 到期**，和 dl 那张一样要重新申请并在 CDN 上换绑。桶的策略照发布桶抄的（只给 CDN 服务读）：新建的桶不加这条策略，CDN 回源是 403。
- 容器：`website/compose.yaml`，容器名 `speakmore-site`，端口 `127.0.0.1:9800`（同机那两个占了 9600、9700），部署目录 `/home/ubuntu/speakmore-site`。部署就是 `cd website && npm run deploy`（`scripts/deploy.sh`：把当前提交经 SSH 推过去、在服务器上 Docker 构建、查健康检查，服务器不连 GitHub，npm 走腾讯云的源）。**发了新版本要再部署一次**，下载链接的版本号是构建时写死的。
- **部署必须用 Docker**（2026-10-15 用户说的，原话："一定要用 Docker 去部署。因为现在上面有两个网站都是用 Docker 的，咱们给隔离开，就不要相互干扰，你千万别把东西装到全局上了"）。官网打成一个容器，照同机那两个站点的样子接进来；宿主机上不装任何软件、不装 npm 包，构建在本机或容器里做。

**Why:** 用户要网站搭好就能上线，不再操心域名和证书；同机还有别的站点，互不干扰。

**How to apply:** 搭官网时直接改这个站点文件的 443 段；不要另起子域名，也不要动同机别的站点。

**2026-10-17 README 重做后（下一步重做官网）：**
- README 的图也在这个桶里，前缀 `readme/`，清单 `docs/media.json`（中英各 20 张：首次引导八步、首页浅深色、模型页各分类、识别方式选单、推荐组合、设置、历史、厂商标志墙、国内源下载速度对比）。官网和宣传片直接复用这些图，不要再从仓库引用（原话"必须都得上桶"）。出图脚本 `website/scripts/readme-media.mjs`，上传 `upload-media.mjs --prefix readme --manifest ../docs/media.json`，步骤见 docs/development.md 的"README 的图"。
- README 定下的内容方向官网照用：主旨"自由"（模型、方式、硬件、隐私、费用五项）；书面语、像报告一样简洁；能分点就分点、一点一个信息；中文价格只用人民币；成本放官网，但不提 Typeless（[[website-no-typeless]]），评测数据只放 README。见 [[readme-chinese-default]]。
**2026-10-23 官网改成三位一体并部署（合并提交 267d545，线上同一提交）：** 照 README 的叙事、不照抄：
首屏一行口号「口述成文，划词即译」加一行副标题（用户嫌两行大字压两行小字"叠罗汉"）；下面一排三项功能的键帽（Trio.jsx，按访客系统写右 ⌥ 或右 Alt）；
三项功能各一段：语音输入（原来的两栏演示）、语音翻译（左边口述加带语言胶囊的悬浮条、右边群聊窗口，两块等高，要点在下面一行；
例句是 App 混合方式 DeepSeek 的真实输出；标题「开口即译，语言任选」，用户说不能写成只有中译英）、划词翻译（三张实拍，两张小图按宽高比分栏才等高对齐）。
用户的新要求：各段标题旁那句说明是"无意义的碎碎念"，全站删掉；标题一行排开（前半浅、后半深，中文用逗号接），两行标题右边太空；
左右两块要上下边对齐，别错落；段与段留白要够（段落上下 clamp(7rem,17vw,13rem)）；演示打字时先按最终高度占位，不许把页面往下推；
演示节奏要快（口述 1.8 秒出完、停 2.8 秒）。

**2026-10-17 官网重做上线（合并提交 b9608ed）：**
- 页面顺序：首屏、口述演示、识别方式（泳道路线图）、性能（深色）、模型（厂商标志轮播，末尾一条费用）、隐私、首次引导、一排小特性、开发者（会自己敲命令的终端）、下载。识别方式和模型不能挨着：英文 Modes、Models 长得像。
- 费用的月成本和 App 同一套算法：`src/usage/plan-costs.mjs` 算好写进 `website/src/costs.json`（`npm --prefix website run plan-costs`），根上的 `test/usage/plan-costs.test.mjs` 对账；改了价格或口径要重跑。不在 vite 配置里直接引 App 的模块：Docker 构建里没有 App 的依赖。
- Docker 构建和部署包里要带 `docs/media.json` 和 `src/renderer/shared/provider-icons.mjs`（`.dockerignore`、`website/Dockerfile`、`scripts/deploy.sh` 的 paths），官网新引用仓库别处的文件时三处一起加。
- 设计取向写在 `website/PRODUCT.md`（register 是 brand）；用户的意见见 [[website-look]]。
- 开发者一段终端里的命令和输出取自真实运行（命令行在隔离的 `SPEAKMORE_HOME` 里跑；Windows 单测那行是一次真实日志），CLI 的提示文案改了要跟着改。
- 未查清：GitHub 的图片代理（camo，美西）第一次从这个 CDN 取图时，40 张里有 4 张拿到空的或 24 字节，换查询串重取就好；国内访问没见过。推测是 CDN 海外加速不稳，未验证；要根治得查 media 这个 CDN 的加速区域（云上改动，交给用户跑）。
