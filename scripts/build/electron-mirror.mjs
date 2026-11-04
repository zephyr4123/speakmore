// 打包要用的 Electron 从哪下：mac-app.mjs（SpeakMore.app）和 release.mjs（终端安装、Windows 带的原版 Electron）共用。
// 走国内镜像 npmmirror：本机连 GitHub 每秒只有几十 KB，缓存被清空时三个平台要下四五十分钟（11-03 发 0.20.0 时碰到），
// 镜像每秒几 MB，目录和 GitHub 一样（v<版本>/）。下到的包两处都按 electron 这个包自带的 checksums.json 核对
// （它的完整性由锁文件管着），镜像给错包就报错。设了环境变量 ELECTRON_MIRROR 的以它为准（@electron/get 先看环境变量），
// 镜像出问题时设成 https://github.com/electron/electron/releases/download/ 就换回 GitHub
export const ELECTRON_MIRROR = Object.freeze({ mirror: "https://npmmirror.com/mirrors/electron/" });
