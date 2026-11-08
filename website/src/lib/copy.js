import { useEffect, useRef, useState } from "react";

/**
 * 复制一段字。canCopy：剪贴板能不能用（老浏览器、非 https 用不了，浏览器拒绝过一次也算），用不了时调用方把字写出来让人自己选；
 * 第一帧就按真实情况算，手机上不会先闪一下写出来的字再换成按钮。copied：复制成功后亮 1.8 秒
 * @param {string} text
 */
export function useCopy(text) {
  const [copied, setCopied] = useState(false);
  const [canCopy, setCanCopy] = useState(() => Boolean(navigator.clipboard?.writeText));
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      // 浏览器拒绝了（没给权限、页面不在前台）：换成把字写出来
      console.warn("复制失败", error);
      setCanCopy(false);
    }
  }

  return { copied, canCopy, copy };
}
