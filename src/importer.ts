import DOMPurify from "dompurify";
export interface ImportedArticle {
  html: string;
  warnings: string[];
  images: number;
}
export function importArticle(html: string): ImportedArticle {
  if (!html.trim())
    throw new Error(
      "未收到富文本 HTML，请从秀米导出页重新复制，不要使用纯文本粘贴。",
    );
  if (html.length > 5_000_000) throw new Error("文章超过 5 MB，请先分段导入。");
  const clean = DOMPurify.sanitize(html, {
    FORBID_TAGS: [
      "style",
      "link",
      "iframe",
      "object",
      "embed",
      "form",
      "input",
      "button",
      "textarea",
      "base",
      "foreignObject",
    ],
    FORBID_ATTR: ["contenteditable", "autofocus"],
  });
  const root = document.createElement("div");
  root.innerHTML = clean;
  root.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith("data-xep-")) el.removeAttribute(attr.name);
    }
  });
  if (!root.textContent?.trim() && !root.querySelector("img,svg"))
    throw new Error("复制内容中没有可导入的文字或图片。");
  const warnings = [
    "导入的是发布用 HTML，无法还原秀米全部原生组件信息；未验证公众号最终显示。",
  ];
  if (root.querySelector("svg,video,audio,canvas"))
    warnings.push(
      "含 SVG 或媒体等特殊内容：只作预览，相关结构不开放拆分；普通复制可能丢失互动效果。",
    );
  if (DOMPurify.removed.length)
    warnings.push("已移除不适合本地编辑的执行内容或标签，请核对预览。");
  if (root.querySelector('img[src^="http"]') || /url\(/i.test(root.innerHTML))
    warnings.push(
      "预览会按原图片或背景地址加载资源；临时链接或防盗链可能导致图片失效。",
    );
  return {
    html: root.innerHTML,
    warnings,
    images: root.querySelectorAll("img").length,
  };
}
export function prepareImportedRoot(root: HTMLElement) {
  for (const el of Array.from(
    root.querySelectorAll<HTMLElement>("section,div"),
  )) {
    if (
      !el.children.length ||
      el.querySelector("svg,video,audio,canvas,iframe,table")
    )
      continue;
    const style = getComputedStyle(el);
    const children = Array.from(el.children) as HTMLElement[];
    const normal = children.every((c) => {
      const s = getComputedStyle(c);
      return (
        !["absolute", "fixed", "sticky"].includes(s.position) &&
        !["left", "right"].includes(s.float) &&
        !["inline-block", "table-cell"].includes(s.display)
      );
    });
    if (
      !["flex", "inline-flex", "grid", "inline-grid", "table"].includes(
        style.display,
      ) &&
      normal &&
      !["absolute", "fixed", "sticky"].includes(style.position)
    )
      el.dataset.xepLayout = "single";
    if (
      ["relative", "absolute"].includes(style.position) &&
      children.length > 1 &&
      children.every((c) => getComputedStyle(c).position === "absolute")
    )
      el.dataset.xepOverlap = "";
  }
}
export function exportArticle(root: HTMLElement) {
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes))
      if (attr.name.startsWith("data-xep-")) el.removeAttribute(attr.name);
  });
  return { html: clone.innerHTML, text: root.textContent ?? "" };
}
