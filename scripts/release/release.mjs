#!/usr/bin/env node
// 打发布：每种装法摆出一棵树，切块存进对象仓库、写一份清单（更新用），再打成首次安装用的包。
// 用法：npm run release              两种芯片的 Mac 和 Windows 都打
//       npm run release -- arm64     只打一种（arm64、x64，或者 windows）：自己试用，发不出去
//
// 产物在 dist/release/，摆成下载地址上的样子（src/update/layout.mjs），所以它本身就能当下载地址用
// （SPEAKMORE_INSTALL_BASE=dist/release）。发新版本用 npm run ship，它会调这里打包、再传上去。
//
// 每种装法一棵树（layout.mjs 的 TARGETS）：
//   darwin-<芯片>       Mac 终端安装的家目录：app/（代码、运行时依赖、编好的小帮手、install.sh）和
//                       runtime/（原版的 Electron.app：命令行和后台应用都用它跑，用的人不需要装 Node）
//   win32-x64           Windows：一样是 app\（带 install.ps1）和 runtime\（原版的 Electron）。也在这台 Mac 上打：
//                       小帮手用项目自带的 Go 交叉编译（scripts/build/go.sh），运行库按 win32-x64 装（npm 的 --os、--cpu）
//   darwin-<芯片>-app   签了名、过了公证的 SpeakMore.app。要本机配好签名和公证（.machine.env 的 MAC_SIGNING_IDENTITY、
//                       MAC_NOTARY_PROFILE）；没配也打（临时签名或只签名、不公证）、也记清单，好在本机试更新，只是不打 dmg、发不出去
// 树里的文件按内容切块（chunker.mjs），每块压好存成 store/<sha256>，同一块只存一份；更新只下本机缺的块。
// 首次安装用的包：Mac 终端安装的 tar.xz、Mac 的 dmg、Windows 的 zip（irm … | iex）和安装程序 Setup.exe。
// Windows 上的都没签名：暂时不签。
//
// 最后才写 channel.json：传的时候它也最后传（release-layout.mjs），任何时刻照着它去取，东西都已经在了。

import { execFileSync, spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { downloadArtifact } from "@electron/get";
import { buildHelper } from "../../src/cli/native-helper.mjs";
import { sha256 as sha256Of } from "../../src/update/chunker.mjs";
import { chunksIn, describeTree, encodeManifest } from "../../src/update/manifest.mjs";
import { packObject } from "../../src/update/objects.mjs";
import { makeDmg } from "../build/dmg.mjs";
import { ELECTRON_MIRROR } from "../build/electron-mirror.mjs";
import { packageMacApp } from "../build/mac-app.mjs";
import { signingConfig } from "../build/signing.mjs";
import { trimWindowsLocales } from "../build/slim.mjs";
import { APP_ENTRIES, stageApp } from "../build/stage-app.mjs";
import { TAR_ANONYMOUS } from "../build/tar.mjs";
import { buildWindowsSetup } from "../build/windows-setup.mjs";
import {
  ARCHS,
  appTarget,
  archiveName,
  CHANNEL,
  CHANNEL_FORMAT,
  dmgName,
  homeTarget,
  objectPath,
  sha256,
  versionDir,
  WINDOWS_ARCHIVE,
  WINDOWS_SETUP,
} from "./release-layout.mjs";

const packageDir = resolve(import.meta.dirname, "../..");
const outDir = join(packageDir, "dist", "release");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const megabytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const WINDOWS = "windows";
const wanted = process.argv.slice(2);
const unknown = wanted.filter((arch) => !ARCHS.includes(arch) && arch !== WINDOWS);
if (unknown.length > 0) {
  console.error(`不认识的芯片：${unknown.join("、")}。能填：${[...ARCHS, WINDOWS].join(" / ")}`);
  process.exit(2);
}
const archs = wanted.length > 0 ? wanted.filter((arch) => arch !== WINDOWS) : ARCHS;
const windows = wanted.length === 0 || wanted.includes(WINDOWS);
// 先读：配错了在编译、打包之前就说
const signing = signingConfig(packageDir);

const { version } = readJson(join(packageDir, "package.json"));
const electronDir = join(packageDir, "node_modules", "electron");
const electronVersion = readJson(join(electronDir, "package.json")).version;
/** electron 这个包里带着每个下载件应有的 SHA-256，而它自己的完整性由我们的锁文件管着 */
const electronChecksums = readJson(join(electronDir, "checksums.json"));

/** 下载（有缓存就用缓存）这个系统、这种芯片的 Electron，核对过校验值之后解到 dest 里 */
async function addRuntime(platform, arch, dest) {
  const zip = await downloadArtifact({
    version: electronVersion,
    platform,
    arch,
    artifactName: "electron",
    mirrorOptions: ELECTRON_MIRROR,
  });
  const name = `electron-v${electronVersion}-${platform}-${arch}.zip`;
  const expected = electronChecksums[name];
  const actual = sha256(zip);
  if (!expected || actual !== expected) {
    throw new Error(`${name} 的校验值对不上：应该是 ${expected ?? "（表里没有）"}，下到的是 ${actual}`);
  }
  mkdirSync(dest, { recursive: true });
  // ditto 解出来的应用包保留着符号链接和签名；unzip 对其中的符号链接处理得不可靠
  execFileSync("ditto", ["-x", "-k", zip, dest]);
}

/** 摆一份家目录里的程序（app/）：命令行入口、许可证，和让更新换上它的那个安装脚本 */
function stageHomeApp(appDir, arch, platform) {
  mkdirSync(appDir, { recursive: true });
  const installer = platform === "win32" ? "install.ps1" : "install.sh";
  stageApp(packageDir, appDir, ["bin", ...APP_ENTRIES, "LICENSE", installer], arch, platform);
  // 锁文件只在装依赖时用得上
  rmSync(join(appDir, "package-lock.json"));
}

/** 对象仓库：store/<sha256>，存的是压过的。同一块只压、只存一次 */
const storeDir = join(outDir, "store");
function putObject(sha, data) {
  const path = join(outDir, objectPath(sha));
  if (!existsSync(path)) writeFileSync(path, packObject(data));
}

/**
 * 每种装法用哪份清单，最后写进 channel.json。每打好一份就落到 targets.json（不上传）：后面哪一步断了
 * （比如 dmg 公证连不上苹果），只补那一步、再照它写 channel.json 就行，不用整个重打（见 ship.sh 开头）
 */
const targets = {};
const TARGETS_FILE = "targets.json";

/**
 * 一棵树切块进对象仓库，清单也存成一个对象
 * @param {{ links?: boolean }} [options] links：树里能不能有符号链接（Windows 上建符号链接要管理员权限，那边的树里不许有）
 */
async function publishTree(root, target, { links = true } = {}) {
  const manifest = await describeTree(root, { put: putObject });
  const link = manifest.entries.find((entry) => entry.type === "link");
  if (!links && link) throw new Error(`${target} 的树里有符号链接 ${link.path}，那边装不上`);
  const encoded = encodeManifest(manifest);
  const sha = sha256Of(encoded);
  putObject(sha, encoded);
  targets[target] = sha;
  writeFileSync(join(outDir, TARGETS_FILE), `${JSON.stringify(targets, null, 2)}\n`);
  const chunks = chunksIn(manifest);
  const bytes = [...chunks.values()].reduce((sum, size) => sum + size, 0);
  const files = manifest.entries.filter((entry) => entry.type === "file").length;
  console.log(`清单 ${target}：${files} 个文件，${chunks.size} 块，共 ${megabytes(bytes)}（清单 ${sha}）`);
}

/** 在后台跑一个命令：几个包同时压（xz、zip 都只用一个核） */
function runInBackground(command, args, options) {
  return new Promise((done, failed) => {
    const child = spawn(command, args, { stdio: ["ignore", "inherit", "inherit"], ...options });
    child.on("error", failed);
    child.on("exit", (code) => (code === 0 ? done() : failed(new Error(`${command} ${args[0]} 退出码 ${code}`))));
  });
}

/** 和 shasum -a 256 的输出同一种格式，安装脚本、下载的人直接拿来核对 */
function writeChecksum(file) {
  writeFileSync(`${file}.sha256`, `${sha256(file)}  ${basename(file)}\n`);
  console.log(`打好了：${file}（${megabytes(statSync(file).size)}）`);
}

if (archs.length > 0) buildHelper(packageDir, { universal: true });
if (windows) buildHelper(packageDir, { platform: "win32" });

const staging = mkdtempSync(join(tmpdir(), "speakmore-release-"));
/** 压首次安装用的包：后台同时跑，最后一起等 */
const packing = [];
/** 先挂上一个空的处理：没等到它之前就失败的话，Node 会当成没人管的失败直接退出、不清临时目录。失败照样在最后的 Promise.all 里抛 */
const inBackground = (job) => {
  job.catch(() => {});
  packing.push(job);
};
try {
  // 上一次打的不留：里面要是混着别的版本，传上去的就不是这一次的
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(join(outDir, versionDir(version)), { recursive: true });
  mkdirSync(storeDir);

  for (const arch of archs) {
    // 每种芯片单独摆一份：本地转写的运行库带着那种芯片的原生库
    const tree = join(staging, homeTarget("darwin", arch));
    stageHomeApp(join(tree, "app"), arch, "darwin");
    // 原版的 Electron.app 不裁：它带着 Electron 自己的签名，删掉里面的文件签名就坏了（slim.mjs）
    await addRuntime("darwin", arch, join(tree, "runtime"));
    await publishTree(tree, homeTarget("darwin", arch));

    const archive = join(outDir, versionDir(version), archiveName(arch));
    // xz 比 gzip 小三成多，macOS 自带的 tar 就解得开。不留本机的用户名、扩展属性这些（tar.mjs）
    const env = { ...process.env, COPYFILE_DISABLE: "1" };
    const args = [
      ...TAR_ANONYMOUS,
      "--options",
      "xz:compression-level=9",
      "-cJf",
      archive,
      "-C",
      tree,
      "app",
      "runtime",
    ];
    inBackground(runInBackground("tar", args, { env }).then(() => writeChecksum(archive)));
  }

  if (windows) {
    const tree = join(staging, homeTarget("win32", "x64"));
    stageHomeApp(join(tree, "app"), "x64", "win32");
    await addRuntime("win32", "x64", join(tree, "runtime"));
    trimWindowsLocales(join(tree, "runtime"));
    await publishTree(tree, homeTarget("win32", "x64"), { links: false });

    const archive = join(outDir, versionDir(version), WINDOWS_ARCHIVE);
    // zip：Windows 10 自带的 tar 不一定解得开 xz，PowerShell 5.1 用 .NET 解 zip 总行。-X 不存 Unix 的属主这些
    inBackground(
      runInBackground("zip", ["-q", "-9", "-r", "-X", archive, "app", "runtime"], { cwd: tree }).then(() =>
        writeChecksum(archive),
      ),
    );
    // 直接下载的安装程序：身上带着同一棵树（zstd 压的），双击就装、装完打开 App
    const setup = join(outDir, versionDir(version), WINDOWS_SETUP);
    inBackground(buildWindowsSetup({ packageDir, version, tree, out: setup }).then(() => writeChecksum(setup)));
  }

  // App 总是打、总是记清单：本机试更新（SPEAKMORE_INSTALL_BASE=dist/release）也有 App 这种装法。
  // 没配签名就是本机的临时签名，配了签名没配公证就只签名（mac-app.mjs）。
  // dmg 只在签名和公证都配了时打：没公证过的 dmg 下回来系统不让开。公证要排队，压包的同时做
  const appsDir = join(staging, "apps");
  for (const arch of archs) {
    const appPath = await packageMacApp({ packageDir, arch, out: appsDir, signing });
    // 清单照着签好名、钉好票据的这一份记：更新拼出来的和它逐字节相同，签名照样验得过
    await publishTree(appPath, appTarget(arch));
    if (!signing?.notaryProfile) continue;
    const dmg = join(outDir, versionDir(version), dmgName(arch));
    makeDmg({ appPath, dmgPath: dmg, signing });
    writeChecksum(dmg);
  }
  if (archs.length > 0 && !signing?.notaryProfile) {
    const what = signing
      ? "没配公证（.machine.env 的 MAC_NOTARY_PROFILE）：App 只签了名、没公证"
      : "没配签名和公证（.machine.env 的 MAC_SIGNING_IDENTITY、MAC_NOTARY_PROFILE）：App 是本机的临时签名";
    console.warn(`${what}，不打安装包（dmg）；只能本机试，发布时传不上去`);
  }
  await Promise.all(packing);
} finally {
  // 后台还在压的话等它们停下再删（出错时）：删到一半的目录压出来的包没人要，但也别让它们对着空目录报一堆错
  await Promise.allSettled(packing);
  rmSync(staging, { recursive: true, force: true });
}

// 安装脚本和发布包放在一起：下载地址上的和仓库里的是同一份
cpSync(join(packageDir, "install.sh"), join(outDir, "install.sh"));
cpSync(join(packageDir, "install.ps1"), join(outDir, "install.ps1"));
const channel = { format: CHANNEL_FORMAT, version, electron: electronVersion, targets };
writeFileSync(join(outDir, CHANNEL), `${JSON.stringify(channel, null, 2)}\n`);
console.log(`\nSpeakMore ${version}（Electron ${electronVersion}）的发布在 ${outDir}`);
