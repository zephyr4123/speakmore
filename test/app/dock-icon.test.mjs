import assert from "node:assert/strict";
import { test } from "node:test";
import { createDockIcon } from "../../src/app/dock-icon.mjs";

/** 假程序坞和假时钟：记下 show / hide，sleep 只把时钟往前拨 */
function setup(wanted) {
  const calls = [];
  let clock = 10_000;
  const slept = [];
  const sync = createDockIcon({
    dock: { show: async () => calls.push(["show", clock]), hide: () => calls.push(["hide", clock]) },
    wanted: () => wanted.value,
    now: () => clock,
    sleep: async (ms) => {
      slept.push(ms);
      clock += ms;
    },
  });
  return { sync, calls, slept, tick: (ms) => (clock += ms) };
}

test("跟着设置亮出来、藏起来；离上次亮出来够 1 秒了就直接藏", async () => {
  const wanted = { value: true };
  const { sync, calls, slept, tick } = setup(wanted);
  await sync();
  tick(1500);
  wanted.value = false;
  await sync();
  assert.deepEqual(calls, [
    ["show", 10_000],
    ["hide", 11_500],
  ]);
  assert.deepEqual(slept, []);
});

test("刚亮出来不到 1 秒就关：等够 1 秒再藏（Electron 在这 1 秒里的 hide 什么都不做）", async () => {
  const wanted = { value: true };
  const { sync, calls, slept, tick } = setup(wanted);
  await sync();
  tick(300);
  wanted.value = false;
  await sync();
  assert.deepEqual(slept, [700]);
  assert.deepEqual(calls.at(-1), ["hide", 11_000]);
});

test("等的时候又打开了：不藏", async () => {
  const wanted = { value: true };
  const calls = [];
  const sync = createDockIcon({
    dock: { show: async () => calls.push("show"), hide: () => calls.push("hide") },
    wanted: () => wanted.value,
    now: () => 0,
    sleep: async () => {
      wanted.value = true;
    },
  });
  await sync();
  wanted.value = false;
  await sync();
  assert.deepEqual(calls, ["show"]);
});

test("没有程序坞（Windows）什么都不做", async () => {
  await createDockIcon({ dock: undefined, wanted: () => true })();
});
