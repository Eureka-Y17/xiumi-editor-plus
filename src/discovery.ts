// Inspect visible DOM only; this does not infer Xiumi's private document model.
export interface InspectionRegion {
  root: HTMLElement;
  scope: string;
}
const chrome =
  'nav,header,footer,aside,form,[role="toolbar"],[role="navigation"],xep-inspector';
export function isArticleRegion(el: HTMLElement, doc: Document): boolean {
  if (
    el === doc.body ||
    el === doc.documentElement ||
    el.closest(chrome) ||
    el.querySelector("xep-inspector")
  )
    return false;
  if (el.querySelector('button,input,select,textarea,[role="toolbar"]'))
    return false;
  return (
    !!el.querySelector('p,img,section,h1,h2,h3,[contenteditable="true"]') ||
    el.matches('[contenteditable="true"]')
  );
}
function richness(el: HTMLElement) {
  return (
    el.querySelectorAll("p,h1,h2,h3,blockquote").length +
    el.querySelectorAll("img").length * 3 +
    el.querySelectorAll("section").length
  );
}
export function discoverRegion(doc: Document): InspectionRegion | null {
  const native = Array.from(
    doc.querySelectorAll<HTMLElement>(".tn-paper-document-root"),
  ).find((el) => {
    const r = el.getBoundingClientRect();
    const style = doc.defaultView!.getComputedStyle(el);
    return (
      r.width > 200 &&
      r.height > 50 &&
      !el.hidden &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      !el.closest("xep-inspector")
    );
  });
  if (native)
    return {
      root:
        native.querySelector<HTMLElement>(
          ".tn-page-container.active .tn-page",
        ) ?? native,
      scope:
        "识别秀米当前文章区域，过滤编辑外壳；请核对内容。仅高亮检查，原生联动已暂停。",
    };
  const editors = Array.from(
    doc.querySelectorAll<HTMLElement>('[contenteditable="true"]'),
  ).filter((el) => {
    const rect = el.getBoundingClientRect();
    return (
      !el.parentElement?.closest('[contenteditable="true"]') &&
      !el.closest(chrome) &&
      !el.hidden &&
      getComputedStyle(el).display !== "none" &&
      getComputedStyle(el).visibility !== "hidden" &&
      rect.width > 200 &&
      rect.height > 50
    );
  });
  if (!editors.length) return null;
  let best = editors[0],
    bestScore = richness(best);
  for (const editor of editors) {
    const width = editor.getBoundingClientRect().width;
    let el: HTMLElement | null = editor;
    for (let depth = 0; el && depth < 9; depth++, el = el.parentElement) {
      if (!isArticleRegion(el, doc)) break;
      const rect = el.getBoundingClientRect();
      if (rect.width > Math.min(1000, width * 2.2) || rect.width < 200) break;
      const score = richness(el);
      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    }
  }
  const fragment =
    best.matches('[contenteditable="true"]') && !best.querySelector("img");
  return {
    root: best,
    scope: fragment
      ? "可能仅识别到局部文字框，请点选文章范围或扩大一层。"
      : "自动找到候选区域，请核对是否包含整篇推文。",
  };
}
