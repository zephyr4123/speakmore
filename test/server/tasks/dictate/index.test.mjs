import assert from "node:assert/strict";
import { test } from "node:test";
import { dictate } from "../../../../src/server/tasks/dictate/index.mjs";
import { NO_SPEECH_MARK } from "../../../../src/server/tasks/dictate/prompt.mjs";

// 成品字形（设置里的 outputScript）：客户端要繁体时在 set_mode_config 里给 output_script。
// 默认简体：老客户端不发 set_mode_config 也照样用

const TRANSCRIBED = "我而家用紧呢一个platform，然之后我用语音输入文字嘅时候";

test("没给 output_script 时照旧是简体", () => {
  assert.deepEqual(dictate.bind({}).transcribe.finish(TRANSCRIBED), { text: TRANSCRIBED, source: null });
  assert.deepEqual(dictate.bind({ output_script: "simplified" }).native.finish("我們後天開會。"), {
    text: "我们后天开会",
    source: null,
  });
});

test("traditional-hk：成品转成繁体（香港字形），英文和粤语用字不动", () => {
  assert.deepEqual(dictate.bind({ output_script: "traditional-hk" }).transcribe.finish(TRANSCRIBED), {
    text: "我而家用緊呢一個platform，然之後我用語音輸入文字嘅時候",
    source: null,
  });
});

test("traditional-tw：用台湾字形", () => {
  assert.equal(
    dictate.bind({ output_script: "traditional-tw" }).transcribe.finish("这个软件里面设置的模型在哪里？").text,
    "這個軟件裡面設置的模型在哪裡？",
  );
});

test("三种走法都转：直出、整理、离线", () => {
  const bound = dictate.bind({ output_script: "traditional-hk" });
  assert.equal(bound.native.finish("我们后天开会。").text, "我們後天開會");
  assert.equal(bound.polish.finish("这个软件挺好用的。", "这个软件挺好用的").text, "這個軟件挺好用的");
  assert.equal(bound.transcribe.finish("  好的  ").text, "好的");
});

test("没有人声、没有输出时还是空的；不认识的字形抛错，不悄悄按简体做", () => {
  const bound = dictate.bind({ output_script: "traditional-hk" });
  assert.equal(bound.transcribe.finish("").text, "");
  assert.equal(bound.native.finish(NO_SPEECH_MARK).text, "");
  assert.throws(() => dictate.bind({ output_script: "zh-Hant" }), /simplified \/ traditional-hk \/ traditional-tw/);
});

test("中文数字紧挨着拉丁字母时换成阿拉伯数字：三D → 3D、二D → 2D（本机模型会把 3D 写成三D）", () => {
  const bound = dictate.bind({});
  assert.equal(bound.transcribe.finish("可以整啲大或者中嘅三D耳機").text, "可以整啲大或者中嘅3D耳機");
  assert.equal(bound.transcribe.finish("二D 同 二d 都試下").text, "2D 同 2d 都試下");
  assert.equal(bound.transcribe.finish("兩D、两D").text, "2D、2D");
  assert.equal(bound.transcribe.finish("四K 同 五G").text, "4K 同 5G");
  // 云端的直出、整理那两步也走同一个收尾
  assert.equal(bound.native.finish("做三D模型").text, "做3D模型");
  assert.equal(bound.polish.finish("做三D模型。", "做三D模型").text, "做3D模型");
});

test("只换单个字、只换紧挨着的：空开的三 D 和成串的中文数字都不动", () => {
  const bound = dictate.bind({});
  assert.equal(bound.transcribe.finish("三 D 唔換").text, "三 D 唔換");
  // 粤语的"一D"是"一啲"，不能换成 1D
  assert.equal(bound.transcribe.finish("我呢度有一D嘢").text, "我呢度有一D嘢");
  assert.equal(bound.transcribe.finish("二百六十RPM").text, "二百六十RPM");
  // 数字后面不是拉丁字母、或者中文数字后面跟的是汉字，都不动
  assert.equal(bound.transcribe.finish("三個人、三個").text, "三個人、三個");
});

test("换成阿拉伯数字之后照样按设置转字形", () => {
  assert.equal(dictate.bind({ output_script: "traditional-hk" }).transcribe.finish("呢個三D模型").text, "呢個3D模型");
  assert.equal(dictate.bind({ output_script: "traditional-tw" }).transcribe.finish("这个三D模型").text, "這個3D模型");
});
