import { toPng } from "html-to-image";
import { exportArticle } from "./importer";
export function wrapArticle(html: string, width: number) {
  return `<section style="box-sizing:border-box;width:${width}px;max-width:100%;padding:24px;margin:0 auto;font:16px/1.8 system-ui,sans-serif;color:#263d36;overflow-wrap:anywhere">${html}</section>`;
}
// The editable project keeps its layers. Only the outgoing copy is flattened.
export async function deliveryContent(root: HTMLElement, width: number) {
  const snapshot = root.innerHTML;
  const clone = root.cloneNode(true) as HTMLElement;
  const originals = Array.from(root.querySelectorAll<HTMLElement>("*"));
  const copies = Array.from(clone.querySelectorAll<HTMLElement>("*"));
  const composites = originals.filter(
    (el) =>
      (el.tagName === "IMG" &&
        (el as HTMLImageElement).src.startsWith("data:image/webp")) ||
      el.hasAttribute("data-xep-canvas") ||
      el.hasAttribute("data-xep-overlap") ||
      getComputedStyle(el).backgroundImage.includes("url("),
  );
  const top = composites.filter(
    (el) => !composites.some((parent) => parent !== el && parent.contains(el)),
  );
  for (const el of top) {
    if (el.offsetWidth < 1 || el.offsetHeight < 1)
      throw new Error("叠放区域没有可导出的尺寸，请先设置宽高。");
    let png: string;
    try {
      png = await toPng(el, {
        pixelRatio: 2,
        skipFonts: true,
        cacheBust: true,
      });
    } catch {
      throw new Error(
        "叠放区域图片合成失败，可能是远程图片禁止跨域。请替换为本地图片后重试，原工程未改变。",
      );
    }
    const image = document.createElement("img");
    image.src = png;
    image.alt = el.textContent?.trim().slice(0, 200) ?? "组合图文";
    image.style.cssText = `display:block;width:${el.offsetWidth}px;max-width:100%;height:auto;margin:${el.style.margin || "0"};`;
    copies[originals.indexOf(el)].replaceWith(image);
  }
  if (root.innerHTML !== snapshot)
    throw new Error("导出时文章发生了变化，请完成编辑后重新复制或同步。");
  return wrapArticle(exportArticle(clone).html, width);
}
