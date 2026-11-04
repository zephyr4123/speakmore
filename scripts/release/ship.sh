#!/bin/sh
# 发一个新版本，从这台电脑发：把关 → 检查 → 打包 → 传到下载地址 → 从下载地址核对 → 公开 GitHub 上的 Release。
# 安装包只放在腾讯云 COS 一处；GitHub 上的 Release 只有源码和说明，推标签时 CI 建成草稿，这里最后公开。
# 以前推标签由 GitHub 的机器打包再传，那边在国外，传到上海太慢，
# 0.4.0 那次传了 32 分钟一个包都没传上；本机传两个包两分多钟。
#
# 用法：改好 package.json 的版本号并提交，打同名的标签推上去，然后发：
#   git tag -a v0.4.1 -m "…" && git push origin v0.4.1
#   npm run ship
#   npm run ship -- --allow-big     Electron 没换、更新却超过 20 MB 时也发（差量报告会拦，见 delta-report.mjs）
#
# 版本号发过就不能再改（见 release-layout.mjs），所以先把关：工作区干净、HEAD 就是那个标签、标签已经推上去。
# 传到一半断了：别重新打包（打出来的包每次都不一样，会被当成改了已发布的版本），
# 直接再传一次 scripts/release/with-cos-key.sh npm run publish-release，传好的会跳过。
# 先传块，再传首次安装用的包和安装脚本，最后才换 channel.json（release-layout.mjs）：没传完的时候谁也看不到这个版本。
# 打包后段断了（比如 dmg 公证连不上苹果）：别整个重跑，只补那一步。前面打好的清单都记在 dist/release/targets.json，
# 补完照它写 channel.json（{ format, version, electron, targets }，见 release.mjs 最后），再拷两个安装脚本，然后 publish-release。
set -eu
cd "$(dirname "$0")/../.."

DOWNLOAD_URL="https://dl.zephyrxiang.com/speakmore"

fail() {
  echo "ship：$1" >&2
  exit 1
}

allow_big=""
for arg in "$@"; do
  case "$arg" in
    --allow-big) allow_big="--allow-big" ;;
    *) fail "不认识的参数：$arg（只认 --allow-big）" ;;
  esac
done

tag="v$(node -p "require('./package.json').version")"
[ -z "$(git status --porcelain)" ] || fail "工作区有没提交的改动，发出去的会和标签对不上"
git tag --points-at HEAD | grep -qx "${tag}" || fail "HEAD 上没有标签 ${tag}（package.json 里是这个版本）"
# 带注释的标签要看它指向的提交（^{}）；不带注释的没有那一行，标签指的就是提交本身
remote="$(git ls-remote origin "refs/tags/${tag}^{}" | cut -f 1)"
[ -n "${remote}" ] || remote="$(git ls-remote origin "refs/tags/${tag}" | cut -f 1)"
[ "${remote}" = "$(git rev-parse HEAD)" ] || fail "标签 ${tag} 还没推到 GitHub，或者那边指的不是这个提交"
# 最后要用 gh 公开 GitHub 上的 Release：账号不对的话要等打完包、传完才发现，先查
scripts/checks/check-gh-account.sh || fail "核对 gh 账号没通过（原因在上一行）"

# 这个版本传过（哪怕只传了一部分）就不能重打：打出来的包每次都不一样，会被当成改了已发布的版本，版本号只能作废。
# 断在上传的话照上面说的再跑 publish-release
if curl -fsI "${DOWNLOAD_URL}/${tag}/speakmore-darwin-arm64.tar.xz.sha256" >/dev/null 2>&1; then
  fail "下载地址上已经有 ${tag} 的包了：别重新打包。没传完就再运行 scripts/release/with-cos-key.sh npm run publish-release"
fi

# 安装包要签名、公证：没配的话要等打到最后才发现，先查
node --input-type=module -e 'import { signingConfig } from "./scripts/build/signing.mjs"; process.exit(signingConfig(process.cwd())?.notaryProfile ? 0 : 1)' ||
  fail "本机没配签名和公证（.machine.env 的 MAC_SIGNING_IDENTITY、MAC_NOTARY_PROFILE，见 .machine.env.example），打不了安装包"

npm run check
# 程序跑在 Electron 自带的 Node 上，单测在那个版本上也跑一遍。和 CI 跑的是同一套（.github/workflows/ci.yml）
npm run test:electron
npm run release
# 和下载地址上现在的版本比，每种装法要下多少：版本号往回退、Electron 没换却超 20 MB 的，拦下来（delta-report.mjs）
code=0
node scripts/release/delta-report.mjs ${allow_big} || code=$?
case "${code}" in
  0) ;;
  3) fail "差量太大，没有传。查清楚再发；确实要这样发：npm run ship -- --allow-big（打好的包会重打，还没传过，不碍事）" ;;
  4) fail "版本号不对，没有传（上面说了原因）" ;;
  *) fail "没算出差量（上面说了原因），没有传。查好了再运行 npm run ship" ;;
esac
scripts/release/with-cos-key.sh npm run publish-release ||
  fail "没传完。别重新打包，直接再运行：scripts/release/with-cos-key.sh npm run publish-release"

# channel.json 在 CDN 上缓存一分钟，等它换过来
for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do
  [ "$(curl -fsS "${DOWNLOAD_URL}/channel.json")" = "$(cat dist/release/channel.json)" ] && break
  sleep 10
done
[ "$(curl -fsS "${DOWNLOAD_URL}/channel.json")" = "$(cat dist/release/channel.json)" ] ||
  fail "传上去了，但下载地址上的 channel.json 两分钟后还不是这一次的"
for sum in \
  "${tag}/speakmore-darwin-arm64.tar.xz.sha256" "${tag}/SpeakMore-arm64.dmg.sha256" \
  "${tag}/speakmore-darwin-x64.tar.xz.sha256" "${tag}/SpeakMore-x64.dmg.sha256" \
  "${tag}/speakmore-win32-x64.zip.sha256" "${tag}/SpeakMore-Setup-x64.exe.sha256"; do
  [ "$(curl -fsS "${DOWNLOAD_URL}/${sum}")" = "$(cat "dist/release/${sum}")" ] || fail "下载地址上 ${sum} 和本机的不一样"
done
for script in install.sh install.ps1; do
  [ "$(curl -fsS "${DOWNLOAD_URL}/${script}" | shasum -a 256)" = "$(shasum -a 256 <"${script}")" ] ||
    fail "下载地址上的 ${script} 和仓库里的不一样（CDN 缓存一分钟，等一下再查）"
done
# 每种装法的清单从下载地址上取得到、和本机的一样（块在上传时已经逐个核对过在不在、大小对不对）
for manifest in $(node -p 'Object.values(require("./dist/release/channel.json").targets).join(" ")'); do
  [ "$(curl -fsS "${DOWNLOAD_URL}/store/${manifest}" | shasum -a 256)" = "$(shasum -a 256 <"dist/release/store/${manifest}")" ] ||
    fail "下载地址上的清单 store/${manifest} 和本机的不一样"
done
echo "发好了：${tag}。下载地址上的 channel.json、五份更新清单、Mac 两个包、两个安装包、Windows 的包和两个安装脚本都对得上。"
# GitHub 上的 Release（源码和说明）：推标签时 CI 建好了草稿，这里公开。没成也不影响已经发好的包
github="ok"
scripts/release/github-release.sh publish "${tag}" || github="failed"
echo "接着部署官网（cd website && npm run deploy），再验收线上的包：scripts/release/accept-mac.sh、scripts/release/accept-win.sh"
[ "${github}" = ok ] ||
  fail "包已经发好了，不用重跑 ship；只是 GitHub 上的 Release 没公开（原因在上面），处理好后单独跑：scripts/release/github-release.sh publish ${tag}"
