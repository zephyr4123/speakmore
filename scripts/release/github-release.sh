#!/bin/sh
# GitHub 上的 Release：代码层面的发版，只有源码和说明（release-notes.mjs 生成），安装包在下载地址上。分两步：
#   scripts/release/github-release.sh draft v0.21.0     建草稿，建过就更新说明。推标签时 CI 跑（.github/workflows/release.yml）
#   scripts/release/github-release.sh publish v0.21.0   公开。ship.sh 传完、核对好以后最后跑；补发以前的版本也用它
# publish 时还没有草稿：CI 还在跑就等它跑完；CI 没给这个标签跑过（补发 0.20.0 这类以前的版本）就在本机建草稿；
# CI 没过就停下说原因。包在下载地址上齐了才公开，只有下载地址上的最新版标成 Latest。
set -eu
cd "$(dirname "$0")/../.."

usage="用法：scripts/release/github-release.sh draft|publish v0.21.0"
mode="${1:?${usage}}"
tag="${2:?${usage}}"
version="${tag#v}"
DOWNLOAD_URL="https://dl.zephyrxiang.com/speakmore"

fail() {
  echo "github-release：$1" >&2
  exit 1
}

# 这个标签的 Release 是不是草稿：true、false；还没建是空。查不了（断网之类）要停，别误当成没建
release_state() {
  if out="$(gh release view "${tag}" --json isDraft --jq .isDraft 2>&1)"; then
    echo "${out}"
  else
    case "${out}" in
      *"release not found"*) echo "" ;;
      *) fail "查不了 GitHub 上 ${tag} 的 Release：${out}" ;;
    esac
  fi
}

draft() {
  notes="$(mktemp)"
  node scripts/release/release-notes.mjs "${tag}" >"${notes}"
  case "${version}" in *-*) prerelease=true ;; *) prerelease=false ;; esac
  state="$(release_state)" || exit 1
  if [ -n "${state}" ]; then
    # 重跑（比如标签挪过）：只换标题和说明，公开过的不收回成草稿
    gh release edit "${tag}" --title "SpeakMore ${version}" --notes-file "${notes}" --prerelease="${prerelease}" >/dev/null
  else
    gh release create "${tag}" --verify-tag --draft --title "SpeakMore ${version}" --notes-file "${notes}" \
      --prerelease="${prerelease}" >/dev/null
  fi
  rm -f "${notes}"
  echo "GitHub 上 ${tag} 的 Release：$(gh release view "${tag}" --json url,isDraft --jq '"\(.url)（草稿：\(.isDraft)）"')"
}

publish() {
  scripts/checks/check-gh-account.sh || fail "核对 gh 账号没通过（原因在上一行），Release 没动"
  # 每个版本的文件里 Windows 安装程序最后传（release-layout.mjs 的 planUpload），它在就是齐了
  curl -fsI --retry 3 --max-time 30 "${DOWNLOAD_URL}/${tag}/SpeakMore-Setup-x64.exe.sha256" >/dev/null ||
    fail "下载地址上 ${tag} 的包还没齐，Release 不公开"
  state="$(release_state)" || exit 1
  if [ -z "${state}" ]; then
    # 推标签触发的那次 CI，headBranch 就是标签名；没跑过的，jq 对空列表给 "null null null"
    run="$(gh run list --workflow release.yml --branch "${tag}" --limit 1 --json databaseId,status,conclusion \
      --jq '.[0] | "\(.databaseId) \(.status) \(.conclusion)"' 2>&1)" || fail "查不了 CI 的记录：${run}"
    id="${run%% *}"
    case "${run}" in
      "null null null")
        echo "CI 没给 ${tag} 跑过（推标签前还没有这套流程），在本机建草稿"
        draft
        ;;
      *" completed "*) ;;
      *)
        echo "等 CI 跑完 ${tag} 的检查和草稿（gh run watch ${id}）…"
        gh run watch "${id}" --exit-status --interval 30 >/dev/null 2>&1 || true
        ;;
    esac
    state="$(release_state)" || exit 1
    [ -n "${state}" ] ||
      fail "CI 没建出 ${tag} 的草稿。看原因：gh run view ${id} --log-failed；只是 CI 机器上的问题就重跑那次（gh run rerun ${id}），或者在本机建：scripts/release/github-release.sh draft ${tag}；之后再跑 publish"
  fi
  if [ "${state}" = false ]; then
    echo "GitHub 上 ${tag} 的 Release 已经是公开的"
    return
  fi
  # 补发以前的版本时不抢 Latest：只有下载地址上现在的最新版才是
  live="$(curl -fsS --retry 3 --max-time 30 "${DOWNLOAD_URL}/channel.json" | node -p 'JSON.parse(require("fs").readFileSync(0, "utf8")).version')" ||
    fail "取不到下载地址上的 channel.json，Release 没动"
  latest=false
  [ "${live}" = "${version}" ] && latest=true
  gh release edit "${tag}" --draft=false --latest="${latest}" >/dev/null || fail "公开 ${tag} 的 Release 没成功，再跑一次"
  echo "GitHub 上 ${tag} 的 Release 公开了（Latest：${latest}）：$(gh release view "${tag}" --json url --jq .url)"
}

case "${mode}" in
  draft) draft ;;
  publish) publish ;;
  *) fail "${usage}" ;;
esac
