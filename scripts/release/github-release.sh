#!/bin/sh
# 公开 GitHub 上这一版的 Release（只有源码和说明，安装包在下载地址上）。ship.sh 传完、核对好以后最后跑它；
# 断在这一步时单独补：scripts/release/github-release.sh v0.21.0
#
# Release 由推标签触发的 CI 建（.github/workflows/release.yml）：它跑完检查时包还没传完，就建成草稿等这里公开；
# 包已经齐了就直接公开。所以这里碰到的是三种情况之一：草稿（公开它）、已公开、CI 还没跑完（跑完自己会公开）。
set -eu
cd "$(dirname "$0")/../.."

tag="${1:?用法：scripts/release/github-release.sh v0.21.0}"
fail() {
  echo "github-release：$1" >&2
  exit 1
}

scripts/checks/check-gh-account.sh || fail "核对 gh 账号没通过（原因在上一行），Release 没动。处理好再跑：scripts/release/github-release.sh ${tag}"

# 查不到（断网之类）和确实还没建要分开：前者别误报成"CI 没跑"
if ! draft="$(gh release view "${tag}" --json isDraft --jq .isDraft 2>&1)"; then
  case "${draft}" in
    *"release not found"*) draft="" ;;
    *) fail "查不了 GitHub 上 ${tag} 的 Release：${draft}。再跑一次：scripts/release/github-release.sh ${tag}" ;;
  esac
fi
case "${draft}" in
  true)
    gh release edit "${tag}" --draft=false >/dev/null || fail "公开 ${tag} 的 Release 没成功，再跑一次：scripts/release/github-release.sh ${tag}"
    echo "GitHub 上 ${tag} 的 Release 公开了：$(gh release view "${tag}" --json url --jq .url)"
    ;;
  false) echo "GitHub 上 ${tag} 的 Release 已经是公开的" ;;
  *)
    # 还没建：看推标签时那次 CI 跑到哪了（推标签触发的那次，它的 headBranch 就是标签名）
    run="$(gh run list --workflow release.yml --branch "${tag}" --limit 1 --json databaseId,status,conclusion \
      --jq '.[0] | "\(.databaseId) \(.status) \(.conclusion)"' 2>&1)" ||
      fail "查不了 CI 的记录：${run}。再跑一次：scripts/release/github-release.sh ${tag}"
    case "${run}" in
      *" completed success") fail "CI 跑完了却没有 ${tag} 的 Release，看看那次的日志：gh run view ${run%% *} --log" ;;
      *" completed "*) fail "CI 没过，GitHub 上没建 ${tag} 的 Release（包已经发好了，别重跑 ship）。看原因：gh run view ${run%% *} --log-failed；查清后重跑那次：gh run rerun ${run%% *}" ;;
      [0-9]*) echo "CI 还在跑 ${tag} 的检查，跑完看到包已经上线会直接公开 Release：gh run watch ${run%% *}" ;;
      *) fail "没找到推 ${tag} 时 CI 跑的发版流程。补一次：gh workflow run release.yml -f tag=${tag}" ;;
    esac
    ;;
esac
