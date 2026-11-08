// 繁体界面的文案（src/i18n/locales/zh-TW.mjs）从简体（zh-CN.mjs）自动转出来，不手写：
// opencc 的台湾用语（twp）连字形带"設定、檔案、預設"这类说法一起换，再修几处它转错的。
// 改了简体文案就运行 npm run i18n:zh-tw；忘了的话 test/i18n/zh-tw.test.mjs 会指出来。
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Converter } from "opencc-js/cn2t";
import zhCN from "../../src/i18n/locales/zh-CN.mjs";

/** opencc 转错的，或台湾不这么说的：转完再换 */
const FIXES = [
  ["隻用", "只用"], // "是只用本机模型"的"只"被当成了量词
  ["許可權", "權限"],
  ["“", "「"],
  ["”", "」"],
];

const toTaiwan = Converter({ from: "cn", to: "twp" });

/** 一句话，或一整份文案（键不动，只转字） */
export function traditional(value) {
  if (typeof value === "string") return FIXES.reduce((text, [from, to]) => text.replaceAll(from, to), toTaiwan(value));
  return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, traditional(inner)]));
}

// 直接运行时落盘（import.meta.main 要 Node 22.18 起，engines 允许更早的）
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = new URL("../../src/i18n/locales/zh-TW.mjs", import.meta.url);
  const header = "// 自动生成，别手改：改了 zh-CN.mjs 就运行 npm run i18n:zh-tw\n";
  writeFileSync(file, `${header}export default ${JSON.stringify(traditional(zhCN), null, 2)};\n`);
  console.log(`写好了：${file.pathname}`);
}
