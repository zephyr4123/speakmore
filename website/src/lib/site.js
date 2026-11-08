// 页面上的各种地址都从 site.config.json 和版本号算出来，组件里不写死域名。

/**
 * @param {{ siteUrl: string, downloadBase: string, mediaBase: string, repository: string }} site
 * @param {string} version 当前发布的版本号，不带 v（取仓库根上 package.json 的）
 */
export function siteLinks(site, version) {
  const base = site.downloadBase.replace(/\/+$/, "");
  const page = site.siteUrl.replace(/\/+$/, "");
  const media = site.mediaBase.replace(/\/+$/, "");
  return {
    version,
    /** 三个直接下载的安装包：两种芯片的 Mac 各一个 dmg，Windows 一个安装程序 */
    downloads: {
      arm64: `${base}/v${version}/SpeakMore-arm64.dmg`,
      x64: `${base}/v${version}/SpeakMore-x64.dmg`,
      windows: `${base}/v${version}/SpeakMore-Setup-x64.exe`,
    },
    /** 终端里装的一行：macOS 的终端、Windows 的 PowerShell */
    install: {
      mac: `curl -fsSL ${base}/install.sh | bash`,
      windows: `irm ${base}/install.ps1 | iex`,
    },
    /** 官网的下载那一段：手机上装不了，复制这个地址到电脑上打开 */
    downloadPage: `${page}/#download`,
    repository: site.repository,
    license: `${site.repository}/blob/main/LICENSE`,
    /** COS 上一张图的地址；path 是 src/media.json 里记的对象名 */
    media: (path) => `${media}/${path}`,
  };
}

/**
 * 访客是不是在手机、平板上：这些设备装不了安装包。iPadOS 的 Safari 默认自称 Mac、大屏安卓平板的 Chrome 默认自称
 * Linux 桌面，都靠触点数认（真的 Mac 没有触屏；Linux 本来也没有安装包）；带触屏的 Windows 笔记本能装，不算
 * @param {{ userAgent: string, maxTouchPoints: number }} device 通常就是 navigator
 */
export function onPhoneOrTablet({ userAgent, maxTouchPoints }) {
  if (/iPhone|iPad|iPod|Android/i.test(userAgent)) return true;
  return /Macintosh|X11|Linux|CrOS/.test(userAgent) && maxTouchPoints > 1;
}
