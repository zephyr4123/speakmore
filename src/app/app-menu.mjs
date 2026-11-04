// Mac 屏幕顶上的应用菜单。程序坞里有图标时我们是普通应用，主窗口在前面时菜单栏上显示的就是这一份；
// 不设的话是 Electron 自带的那份（带开发者工具、Electron 官网的链接）。照原版 Typeless 只留三栏：
// 应用（关于、设置、隐藏、退出）、编辑（输入框里的拷贝、粘贴、撤销这些快捷键靠它）、窗口。
// 从源码运行时多一栏 Electron 自带的显示（刷新、开发者工具），开发时要用

/**
 * @param {object} options
 * @param {(key: string, params?: object) => string} options.t 按界面语言写
 * @param {() => void} options.openSettings 打开设置（同菜单栏图标菜单里的"设置…"）
 * @param {boolean} [options.dev] 从源码运行（没打包）
 */
export function appMenuTemplate({ t, openSettings, dev = false }) {
  const separator = { type: "separator" };
  return [
    {
      // 第一栏系统总是写成应用的名字
      label: "SpeakMore",
      submenu: [
        { role: "about", label: t("appMenu.about") },
        separator,
        { label: t("tray.settings"), accelerator: "CmdOrCtrl+,", click: openSettings },
        separator,
        { role: "hide", label: t("appMenu.hide") },
        { role: "hideOthers", label: t("appMenu.hideOthers") },
        { role: "unhide", label: t("appMenu.showAll") },
        separator,
        { role: "quit", label: t("tray.quit") },
      ],
    },
    {
      label: t("appMenu.edit"),
      submenu: [
        { role: "undo", label: t("appMenu.undo") },
        { role: "redo", label: t("appMenu.redo") },
        separator,
        { role: "cut", label: t("appMenu.cut") },
        { role: "copy", label: t("appMenu.copy") },
        { role: "paste", label: t("appMenu.paste") },
        { role: "selectAll", label: t("appMenu.selectAll") },
      ],
    },
    ...(dev ? [{ role: "viewMenu" }] : []),
    {
      label: t("appMenu.window"),
      submenu: [
        { role: "minimize", label: t("appMenu.minimize") },
        { role: "close", label: t("appMenu.close") },
      ],
    },
  ];
}
