// 把 SpeakMore 打成一个 macOS 应用（SpeakMore.app）。本机打一个自己用（package.mjs），发版时两种芯片各打一个
// 装进安装包（release.mjs），走的都是这里。小帮手要先编好（build/key-helper），这里只管摆、打包、签名。
//
// 签名：配了 Developer ID（见 signing.mjs）就用它签、开 hardened runtime，再配了公证档案就交给苹果公证、
// 钉上票据，这样的应用拿到别的 Mac 上也能直接打开，重新打包后权限和 key 也不用重给。都没配就是不带身份的本机签名。

import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { packager } from "@electron/packager";
import { ELECTRON_MIRROR } from "./electron-mirror.mjs";
import { osxSignOptions, useCodesignRetry } from "./signing.mjs";
import { trimMacLocales } from "./slim.mjs";
import { APP_ENTRIES, MAC_APP_IGNORE, stageApp } from "./stage-app.mjs";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

/**
 * @param {{ packageDir: string, arch: "arm64" | "x64", out: string, signing: { identity: string, notaryProfile: string | null } | null }} options
 *   packageDir：仓库根目录；out：打到哪个目录下（里面是 SpeakMore-darwin-<芯片>/SpeakMore.app）
 * @returns {Promise<string>} 应用的路径
 */
export async function packageMacApp({ packageDir, arch, out, signing }) {
  const run = (command, args) => execFileSync(command, args, { cwd: packageDir, stdio: "inherit" });
  /** 应用名只在 package.json 的 productName 里写一次：钥匙串条目和应用包都跟着它 */
  const appName = readJson(join(packageDir, "package.json")).productName;

  // 先在一个临时目录里摆出"应用里该有的东西"，只装运行时依赖，再从那里打包
  const staging = mkdtempSync(join(tmpdir(), "speakmore-package-"));
  // 临时目录建出来是 700，打包时原样成了 Contents/Resources/app 的权限：别的用户打不开 App。改成和别的目录一样的 755
  chmodSync(staging, 0o755);
  let bundleDir;
  // 签 Developer ID 要向苹果要几百次时间戳，偶尔一次连不上整个包就失败：换成会重签的 codesign
  if (signing) useCodesignRetry();
  try {
    stageApp(packageDir, staging, APP_ENTRIES, arch);
    [bundleDir] = await packager({
      dir: staging,
      out,
      overwrite: true,
      name: appName,
      // 签了名以后，系统按"这个标识 + 这张证书的团队"认应用：权限、钥匙串都记在它名下，以后别再改
      appBundleId: "com.zephyrxiang.speakmore",
      appCategoryType: "public.app-category.productivity",
      platform: "darwin",
      arch,
      electronVersion: readJson(join(packageDir, "node_modules/electron/package.json")).version,
      // Electron 从国内镜像下（electron-mirror.mjs），按 electron 包自带的校验值核对，不信镜像上的 SHASUMS256.txt
      download: {
        mirrorOptions: ELECTRON_MIRROR,
        checksums: readJson(join(packageDir, "node_modules/electron/checksums.json")),
      },
      // 不打成 asar：原生小帮手要能直接执行，页面和主进程的路径也和开发时保持一致
      asar: false,
      // 依赖在上面已经只装了运行时的那部分
      prune: false,
      ignore: MAC_APP_IGNORE,
      // 原版 Electron 刚解开、还没改名和签名时，把用不到的界面语言删掉（slim.mjs）；之后整个应用一起签
      afterExtract: [({ buildPath }) => trimMacLocales(join(buildPath, "Electron.app"))],
      ...(existsSync(join(packageDir, "assets", "icon.icns")) ? { icon: join(packageDir, "assets", "icon.icns") } : {}),
      extendInfo: {
        // 不写 LSUIElement：程序坞里显示不显示由设置 dockIcon 管（默认显示，app/main.mjs 启动时按它藏）
        NSMicrophoneUsageDescription: "听写需要用麦克风录下你说的话。",
      },
      ...(signing && { osxSign: osxSignOptions(signing.identity) }),
      // 公证要传到苹果那边排队，一般几分钟；交上去的是打好的应用，回来后钉上票据
      ...(signing?.notaryProfile && { osxNotarize: { keychainProfile: signing.notaryProfile } }),
    });
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }

  const appPath = join(bundleDir, `${appName}.app`);
  if (signing === null) {
    // 改过 Info.plist、加过资源之后原来的签名就作废了，Apple 芯片上没有有效签名的应用打不开。
    // 这里签的是不带身份的本机签名：只能在这台机器上用，重新打包后系统会当成另一个应用，三项权限要重新给。
    run("codesign", ["--force", "--deep", "--sign", "-", appPath]);
  }
  run("codesign", ["--verify", "--deep", "--strict", appPath]);
  if (signing?.notaryProfile) {
    // 公证过、钉了票据的，系统的放行检查（Gatekeeper）离线也认
    run("xcrun", ["stapler", "validate", appPath]);
    run("spctl", ["--assess", "--type", "execute", "--verbose", appPath]);
  }
  return appPath;
}
