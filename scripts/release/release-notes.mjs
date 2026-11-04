#!/usr/bin/env node
// GitHub Release 的说明：开头是标签说明那句，下面列这一版合进主干的改动，最后是下载地址。
// GitHub 上只放源码和这份说明，安装包照旧只在下载地址上（ship.sh）。
// 推标签时 .github/workflows/release.yml 用它建 Release；本机预览：node scripts/release/release-notes.mjs v0.20.0

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dmgName, versionDir, WINDOWS_SETUP } from "../../src/update/layout.mjs";
import { DOWNLOAD_URL } from "../../src/update/release.mjs";
import { ARCHS } from "./release-layout.mjs";

const CHIP = { arm64: "Apple 芯片", x64: "Intel" };

/**
 * 主干上一串提交的标题 → 这一版的改动。只取"合并 分支：说明"：功能都走分支合进来；
 * 发版分支（release-0.20.0 这样带版本号的）、记忆、版本号和直接提在主干上的文档修补都不算改动。
 * "合并 PR #19：说明"写成"说明（#19）"，GitHub 会把 #19 链到那个 PR
 * @param {readonly string[]} subjects
 */
export function changesIn(subjects) {
  return subjects.flatMap((subject) => {
    const merge = /^合并 (\S+?)(?: #(\d+))?：(.+)$/.exec(subject);
    if (!merge || /^release-\d/.test(merge[1])) return [];
    const [, , pr, text] = merge;
    return [pr ? `${text}（#${pr}）` : text];
  });
}

/** 标签说明的第一行去掉开头的版本号（"SpeakMore 0.20.0：…""0.19.0：…"两种都有） */
export const summaryOf = (subject, version) =>
  subject.replace(new RegExp(`^(?:SpeakMore )?v?${version.replaceAll(".", "\\.")}：`), "");

/**
 * @param {{ version: string, summary: string, changes: readonly string[] }} release
 * @returns {string} Markdown；网址都单独占到行尾，免得后面的中文标点被连进链接
 */
export function releaseNotes({ version, summary, changes }) {
  const base = `${DOWNLOAD_URL}/${versionDir(version)}`;
  const packages = [
    ...ARCHS.map((arch) => `- Mac（${CHIP[arch]}）：${base}/${dmgName(arch)}`),
    `- Windows：${base}/${WINDOWS_SETUP}`,
  ];
  return [
    summary,
    ...(changes.length > 0 ? ["", "## 改动", "", ...changes.map((change) => `- ${change}`)] : []),
    "",
    "## 下载",
    "",
    ...packages,
    "",
    "终端安装（附带 `speakmore` 命令行工具）：",
    "",
    "```bash",
    "# macOS",
    `curl -fsSL ${DOWNLOAD_URL}/install.sh | bash`,
    "```",
    "",
    "```powershell",
    "# Windows（PowerShell）",
    `irm ${DOWNLOAD_URL}/install.ps1 | iex`,
    "```",
    "",
    "已安装的在「设置 › 通用」中更新，或执行 `speakmore update`。Assets 中只有源码。",
    "",
  ].join("\n");
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

/** 从 git 里取这个标签的说明和改动：改动是上一个版本标签到它之间主干上的提交 */
function releaseOf(tag) {
  const version = tag.replace(/^v/, "");
  const subject = git("tag", "--list", "--format=%(contents:subject)", tag);
  if (!subject) throw new Error(`没有标签 ${tag}`);
  let range = tag;
  try {
    range = `${git("describe", "--tags", "--abbrev=0", "--match", "v[0-9]*", `${tag}^`)}..${tag}`;
  } catch (error) {
    // 前面没有版本标签：这是第一个，从头列。别的错（浅克隆取不到历史之类）照常抛
    if (!/No names found|No tags can describe/.test(String(error.stderr))) throw error;
  }
  const subjects = git("log", "--first-parent", "--format=%s", range).split("\n");
  return { version, summary: summaryOf(subject, version), changes: changesIn(subjects) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tag = process.argv[2];
  if (!/^v\d/.test(tag ?? "")) {
    console.error("用法：node scripts/release/release-notes.mjs v0.20.0");
    process.exit(2);
  }
  process.stdout.write(releaseNotes(releaseOf(tag)));
}
