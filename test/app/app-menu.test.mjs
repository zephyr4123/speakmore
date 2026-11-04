import assert from "node:assert/strict";
import { test } from "node:test";
import { appMenuTemplate } from "../../src/app/app-menu.mjs";
import { createTranslator } from "../../src/i18n/index.mjs";

const zh = createTranslator("zh-CN");
const roles = (menu) => menu.submenu.filter((item) => item.role).map((item) => item.role);

test("应用菜单只有三栏：应用、编辑、窗口；没有 Electron 自带的开发者工具和帮助", () => {
  const menu = appMenuTemplate({ t: zh, openSettings: () => {} });
  assert.deepEqual(
    menu.map((item) => item.label),
    ["SpeakMore", "编辑", "窗口"],
  );
  assert.deepEqual(roles(menu[0]), ["about", "hide", "hideOthers", "unhide", "quit"]);
  // 输入框里的拷贝、粘贴、撤销这些快捷键靠编辑菜单
  assert.deepEqual(roles(menu[1]), ["undo", "redo", "cut", "copy", "paste", "selectAll"]);
  assert.deepEqual(roles(menu[2]), ["minimize", "close"]);
  assert.ok(!JSON.stringify(menu).includes("toggleDevTools"));
});

test("每一项都按界面语言写；设置…是 ⌘, 打开设置", () => {
  let opened = 0;
  const [app, edit] = appMenuTemplate({ t: zh, openSettings: () => opened++ });
  for (const item of [...app.submenu, ...edit.submenu]) {
    if (item.type !== "separator") assert.ok(item.label, JSON.stringify(item));
  }
  assert.deepEqual(
    app.submenu.filter((item) => item.label).map((item) => item.label),
    ["关于 SpeakMore", "设置…", "隐藏 SpeakMore", "隐藏其他", "全部显示", "退出 SpeakMore"],
  );
  const settings = app.submenu.find((item) => item.label === "设置…");
  assert.equal(settings.accelerator, "CmdOrCtrl+,");
  settings.click();
  assert.equal(opened, 1);
});
