import { EditorAdapter } from "./adapter";
import DOMPurify from "dompurify";
import { prepareImportedRoot } from "./importer";
import { cleanInlineHtml } from "./rich-text";

export type InsertKind =
  | "blank"
  | "text"
  | "heading"
  | "quote"
  | "list"
  | "divider"
  | "card"
  | "columns"
  | "table"
  | "canvas";
export const starter = `<section data-label="封面卡片" style="background:#edf4ef;padding:28px 24px;border-radius:16px"><p style="font-size:12px;letter-spacing:3px;color:#4f806b">YOUR NEXT STORY</p><h1 style="font-size:28px;line-height:1.4;margin:16px 0">把好想法，排成好文章。</h1><p style="color:#617269">点击选择，双击编辑文字。拖动组件，重新安排你的故事。</p></section><section data-xep-canvas="1" data-xep-overlap="" data-label="自由叠放画布" style="position:relative;height:260px;margin:24px 0;border-radius:12px;background:#f5f1e8"><section data-label="沙色背景板" style="position:absolute;left:24px;top:24px;width:220px;height:150px;background:#ddbc91;border-radius:16px;z-index:0"></section><section data-label="绿色文字卡片" style="position:absolute;left:85px;top:78px;width:240px;height:150px;padding:20px;background:#25745e;color:#fff;border-radius:16px;z-index:1"><h2 style="font-size:20px;margin:0 0 8px">每一层，都能自由安排</h2><p style="font-size:13px">拖动这张卡片，或在右侧选择「置底」。</p></section></section><p style="line-height:1.8">这里是正文。支持文字、图片、背景、组合、列布局和表格。普通图文按阅读顺序排列；叠放画布中的组件可自由移动。</p>`;
export function cleanStudioHtml(html: string) {
  if (html.length > 20_000_000)
    throw new Error("内容超过 20 MB，请压缩图片或分篇编辑。");
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: [
      "script",
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
}
const templates: Record<InsertKind, string> = {
  blank: '<p data-label="空行" style="min-height:1.8em;margin:12px 0"><br></p>',
  text: '<p style="line-height:1.8">在这里写下新的段落。</p>',
  heading: '<h2 style="font-size:24px;line-height:1.5">新的章节标题</h2>',
  quote:
    '<blockquote style="border-left:4px solid #25745e;padding:16px;background:#edf4ef">值得记下的一句话。</blockquote>',
  list: '<ul style="line-height:1.8"><li>第一项</li><li>第二项</li><li>第三项</li></ul>',
  divider:
    '<section data-label="分隔线" style="height:2px;background:#ccd9d1;margin:24px 0"></section>',
  card: '<section data-xep-group="1" data-label="图文卡片" style="padding:20px;background:#f4f0e7;border:1px solid #e4d8c6;border-radius:12px"><h3>卡片标题</h3><p>将相关的内容组合在一起。</p></section>',
  columns:
    '<section data-label="双列布局" style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><section style="padding:16px;background:#edf4ef"><h3>左侧内容</h3><p>第一列正文</p></section><section style="padding:16px;background:#f4f0e7"><h3>右侧内容</h3><p>第二列正文</p></section></section>',
  table:
    '<table style="border-collapse:collapse;width:100%"><tbody><tr><td style="border:1px solid #ccd9d1;padding:10px">项目</td><td style="border:1px solid #ccd9d1;padding:10px">说明</td></tr><tr><td style="border:1px solid #ccd9d1;padding:10px">内容</td><td style="border:1px solid #ccd9d1;padding:10px">在此填写</td></tr></tbody></table>',
  canvas:
    '<section data-xep-canvas="1" data-xep-overlap="" data-label="叠放画布" style="position:relative;height:280px;background:#f4f0e7;border-radius:12px;margin:20px 0"><section data-label="背景板" style="position:absolute;left:24px;top:24px;width:220px;height:150px;background:#ddbc91;border-radius:14px;z-index:0"></section><p data-label="可拖动文字卡片" style="position:absolute;left:85px;top:95px;width:230px;height:125px;margin:0;padding:20px;background:#25745e;color:white;z-index:1;border-radius:12px">拖动这张文字卡片，体验真正的前后叠放。</p></section>',
};
export class StudioEngine extends EditorAdapter {
  protected override editable(el?: HTMLElement, propertyOnly = false) {
    const base = super.editable(el, true);
    if (!base.allowed || propertyOnly || !el) return base;
    // Xiumi exports empty zero-width SVGs as layout shims, not interactive media.
    const special = Array.from(
      el.querySelectorAll(
        "svg,iframe,video,audio,canvas,script,object,embed,[data-xep-special]",
      ),
    ).some(
      (node) =>
        !(
          node.tagName.toLowerCase() === "svg" &&
          !node.children.length &&
          !node.textContent?.trim() &&
          !node.hasAttribute("data-xep-special") &&
          getComputedStyle(node).width === "0px"
        ),
    );
    return special
      ? {
          allowed: false,
          reason: "含特殊内容的组件可整体排序，内部拆分暂不支持。",
        }
      : base;
  }
  constructor(root: HTMLElement) {
    prepareImportedRoot(root);
    root
      .querySelectorAll<HTMLElement>("[data-xep-overlap]")
      .forEach((el) => (el.dataset.xepCanvas = "1"));
    super(root, "imported");
    this.tree();
  }
  override capability(
    id: string,
    command: Parameters<EditorAdapter["capability"]>[1],
  ) {
    if (this.element(id)?.closest('[data-xep-locked="1"]'))
      return { allowed: false, reason: "组件已锁定，请先解锁。" };
    return super.capability(id, command);
  }
  private nodes(ids: string[], structural = true) {
    const nodes = [...new Set(ids)].map((id) => this.element(id));
    if (!nodes.length) throw new Error("请先选择组件。");
    for (const el of nodes) {
      const cap = this.editable(el, !structural);
      if (!cap.allowed) throw new Error(cap.reason);
      if (el?.closest('[data-xep-locked="1"]'))
        throw new Error("组件已锁定，请先解锁。");
    }
    return nodes as HTMLElement[];
  }
  private topNodes(ids: string[], structural = true) {
    const nodes = this.nodes(ids, structural);
    return nodes
      .filter(
        (el) => !nodes.some((other) => other !== el && other.contains(el)),
      )
      .sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1,
      );
  }
  insert(
    kind: InsertKind,
    after?: string,
    placement: "before" | "after" | "inside" = "after",
  ) {
    const fragment = document.createElement("div");
    fragment.innerHTML = templates[kind];
    return this.insertNode(
      fragment.firstElementChild as HTMLElement,
      after,
      placement,
    );
  }
  /** Return a vertical insertion slot outside text and horizontal template shells. */
  flowAnchor(picked: HTMLElement) {
    let target = picked;
    for (
      let cursor: HTMLElement | null = picked;
      cursor && cursor !== this.root;
      cursor = cursor.parentElement
    ) {
      const s = getComputedStyle(cursor);
      if (
        cursor.matches("p,h1,h2,h3,h4,blockquote,ul,ol,table") ||
        cursor.hasAttribute("data-xep-canvas") ||
        ["grid", "inline-grid", "table", "inline-table"].includes(s.display) ||
        (["flex", "inline-flex"].includes(s.display) &&
          !s.flexDirection.startsWith("column"))
      )
        target = cursor;
    }
    return target;
  }
  private insertNode(
    el: HTMLElement,
    after?: string,
    placement: "before" | "after" | "inside" = "after",
  ) {
    const picked = after ? this.element(after) : undefined;
    const target = picked
      ? placement === "inside"
        ? picked
        : this.flowAnchor(picked)
      : undefined;
    if (after && !picked) throw new Error("所选组件已失效，请重新选择。");
    const cap = this.editable(target ?? this.root, true);
    if (!cap.allowed && target) throw new Error(cap.reason);
    const rootCap = this.editable(this.root, true);
    if (!rootCap.allowed) throw new Error(rootCap.reason);
    if (target?.closest('[data-xep-locked="1"]'))
      throw new Error("组件已锁定，请先解锁。");
    if (placement === "inside" && (!target || !target.matches("section,div")))
      throw new Error("请先选择布局或叠放画布。");
    this.transact(() => {
      if (placement === "inside" && target?.hasAttribute("data-xep-canvas")) {
        Object.assign(el.style, {
          position: "absolute",
          left: "30px",
          top: "30px",
          width: "220px",
          zIndex: String(target.children.length),
        });
        target.append(el);
      } else if (placement === "inside") target!.append(el);
      else if (target)
        placement === "before" ? target.before(el) : target.after(el);
      else this.root.append(el);
    });
    this.tree();
    return this.idFor(el)!;
  }
  orderCapability(ids: string[], direction: "up" | "down") {
    try {
      const targets = this.orderTargets(ids);
      const parent = targets[0].parentElement;
      if (targets.some((n) => n.parentElement !== parent))
        return { allowed: false, reason: "请选择同一文章容器中的组件。" };
      const boundary = this.orderNeighbor(
        direction === "up" ? targets[0] : targets[targets.length - 1],
        direction,
      );
      if (!boundary)
        return {
          allowed: false,
          reason:
            direction === "up"
              ? "已经是当前容器的第一项。"
              : "已经是当前容器的最后一项。",
        };
      if (
        !this.editable(boundary as HTMLElement, true).allowed ||
        (boundary as HTMLElement).closest('[data-xep-locked="1"]')
      )
        return { allowed: false, reason: "不能跨过锁定或特殊组件。" };
      for (const n of targets) {
        const cap = this.editable(n, true);
        if (!cap.allowed || n.closest('[data-xep-locked="1"]'))
          return { allowed: false, reason: cap.reason || "外层组件已锁定。" };
      }
      return {
        allowed: true,
        reason: "交换当前同级组件的顺序，保留内部结构。",
      };
    } catch (e) {
      return { allowed: false, reason: (e as Error).message };
    }
  }
  private layoutShim(node: Element) {
    return (
      node.matches("svg,span") &&
      !node.children.length &&
      !node.textContent?.trim() &&
      getComputedStyle(node).width === "0px"
    );
  }
  private orderNeighbor(node: Element, direction: "up" | "down") {
    let next =
      direction === "up"
        ? node.previousElementSibling
        : node.nextElementSibling;
    while (next && this.layoutShim(next))
      next =
        direction === "up"
          ? next.previousElementSibling
          : next.nextElementSibling;
    return next;
  }
  private orderTargets(ids: string[]) {
    const targets = this.topNodes(ids, false).map((node) => {
      let target = node;
      // Only escape a wrapper with no peers. Never skip real same-level components.
      while (
        target.parentElement &&
        target.parentElement !== this.root &&
        Array.from(target.parentElement.children).filter(
          (n) => !this.layoutShim(n),
        ).length === 1 &&
        !target.parentElement.hasAttribute("data-xep-canvas")
      )
        target = target.parentElement;
      if (target.matches("td,th,tr") || target.closest("td,th"))
        throw new Error("请移动整张表格，不要移动单元格。");
      if (target.parentElement?.hasAttribute("data-xep-canvas"))
        throw new Error("画布内请拖动坐标或调整遮挡；上下排序请选择整个画布。");
      return target;
    });
    return [...new Set(targets)];
  }
  order(ids: string[], direction: "up" | "down") {
    const cap = this.orderCapability(ids, direction);
    if (!cap.allowed) throw new Error(cap.reason);
    const targets = this.orderTargets(ids);
    for (const n of targets) {
      const check = this.editable(n, true);
      if (!check.allowed || n.closest('[data-xep-locked="1"]'))
        throw new Error(check.reason || "外层组件已锁定。");
    }
    const parent = targets[0].parentElement!;
    this.transact(() => {
      if (direction === "up") {
        const before = this.orderNeighbor(targets[0], "up")!;
        for (const n of targets) parent.insertBefore(n, before);
      } else {
        const after = this.orderNeighbor(
          targets[targets.length - 1],
          "down",
        )!.nextSibling;
        for (const n of targets) parent.insertBefore(n, after);
      }
    });
    this.tree();
    return targets.map((n) => this.idFor(n)!);
  }
  undoSelection(ids: string[], redo = false) {
    const paths = ids.flatMap((id) => {
      const node = this.element(id);
      if (!node) return [];
      const path: number[] = [];
      let current: HTMLElement | null = node;
      while (current && current !== this.root) {
        path.unshift(
          Array.from(current.parentElement!.children).indexOf(current),
        );
        current = current.parentElement;
      }
      return [path];
    });
    redo ? super.redo() : super.undo();
    this.tree();
    return paths.flatMap((path) => {
      let node: Element | null = this.root;
      for (const index of path) node = node?.children.item(index) ?? null;
      const id = node ? this.idFor(node) : null;
      return id ? [id] : [];
    });
  }

  setRichText(id: string, html: string) {
    this.nodes([id]);
    const cap = this.propertyCapability(id, "text");
    if (!cap.allowed) throw new Error(cap.reason);
    const cleaned = cleanInlineHtml(html);
    this.transact(() => {
      this.element(id)!.innerHTML = cleaned;
    });
  }
  override setText(id: string, value: string) {
    this.nodes([id]);
    super.setText(id, value);
  }
  replaceImage(id: string, src: string) {
    const el = this.nodes([id])[0];
    if (
      el.tagName !== "IMG" ||
      !/^data:image\/(png|jpeg|gif|webp);base64,/i.test(src)
    )
      throw new Error("请选择普通图片和有效图片文件");
    this.transact(() => {
      el.setAttribute("src", src);
      el.removeAttribute("srcset");
      el.removeAttribute("sizes");
    });
  }
  image(src: string, after?: string) {
    if (!/^(https:\/\/|data:image\/(png|jpeg|gif|webp);base64,)/i.test(src))
      throw new Error("图片仅支持 HTTPS 地址或 PNG/JPEG/GIF/WebP 本地文件。");
    const img = document.createElement("img");
    img.src = src;
    img.alt = "图片";
    img.style.cssText =
      "display:block;max-width:100%;width:100%;height:auto;border-radius:8px";
    return this.insertNode(img, after);
  }
  style(ids: string[], values: Record<string, string>) {
    const nodes = this.nodes(ids, false);
    const lengths = new Set([
      "fontSize",
      "letterSpacing",
      "textIndent",
      "padding",
      "margin",
      "borderRadius",
      "borderWidth",
      "width",
      "height",
      "gap",
    ]);
    values = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        key,
        lengths.has(key) &&
        value
          .trim()
          .split(/\s+/)
          .every((n) => /^-?\d+(?:\.\d+)?$/.test(n))
          ? value
              .trim()
              .split(/\s+/)
              .map((n) => `${n}px`)
              .join(" ")
          : value,
      ]),
    );
    const allowed = [
      "color",
      "backgroundColor",
      "backgroundImage",
      "fontSize",
      "fontFamily",
      "fontWeight",
      "fontStyle",
      "textDecoration",
      "lineHeight",
      "letterSpacing",
      "textAlign",
      "textIndent",
      "padding",
      "margin",
      "borderRadius",
      "borderWidth",
      "borderStyle",
      "borderColor",
      "width",
      "height",
      "opacity",
      "objectFit",
      "transform",
      "display",
      "gap",
      "gridTemplateColumns",
    ];
    for (const [k, v] of Object.entries(values)) {
      if (!allowed.includes(k) || /[;{}<>]|url\s*\(|expression|var\(/i.test(v))
        throw new Error("不支持的样式值。");
    }
    this.transact(() =>
      nodes.forEach((el) => {
        for (const [k, v] of Object.entries(values))
          (el.style as unknown as Record<string, string>)[k] = v;
      }),
    );
  }
  remove(ids: string[]) {
    const nodes = this.topNodes(ids);
    this.transact(() => nodes.forEach((el) => el.remove()));
  }
  duplicate(ids: string[]) {
    const nodes = this.topNodes(ids);
    this.transact(() =>
      nodes.forEach((el) => {
        const copy = el.cloneNode(true) as HTMLElement;
        copy.removeAttribute("id");
        copy.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
        if (el.parentElement?.hasAttribute("data-xep-canvas")) {
          copy.style.left = `${parseFloat(el.style.left || "0") + 16}px`;
          copy.style.top = `${parseFloat(el.style.top || "0") + 16}px`;
        }
        el.after(copy);
      }),
    );
  }
  rename(id: string, name: string) {
    const el = this.nodes([id], false)[0];
    this.transact(() => {
      el.dataset.label = name.trim().slice(0, 60) || "组件";
    });
  }
  lock(id: string) {
    const el = this.element(id);
    if (!el) throw new Error("组件失效");
    const cap = this.editable(el, true);
    if (!cap.allowed) throw new Error(cap.reason);
    this.transact(() => {
      if (el.dataset.xepLocked) delete el.dataset.xepLocked;
      else el.dataset.xepLocked = "1";
    });
  }
  group(ids: string[]) {
    const nodes = this.topNodes(ids);
    if (nodes.some((n) => n.matches("td,th,tr")))
      throw new Error("表格单元格不能组合，请选择整张表格。");
    if (nodes.length < 2)
      throw new Error("按住 Ctrl / ⌘ 多选至少两个同级组件。");
    const parent = nodes[0].parentElement!;
    if (nodes.some((n) => n.parentElement !== parent))
      throw new Error("请先将组件移动到同一个父容器再组合。");
    const ordered = Array.from(parent.children).filter((n) =>
      nodes.includes(n as HTMLElement),
    ) as HTMLElement[];
    const wrapper = document.createElement("section");
    wrapper.dataset.xepGroup = "1";
    wrapper.dataset.label = "组合";
    wrapper.dataset.xepLayout = "single";
    const canvas = parent.hasAttribute("data-xep-canvas");
    const rects = ordered.map((n) => n.getBoundingClientRect());
    const base = parent.getBoundingClientRect();
    const left =
        Math.min(...rects.map((r) => r.left)) -
        base.left -
        parent.clientLeft +
        parent.scrollLeft,
      top =
        Math.min(...rects.map((r) => r.top)) -
        base.top -
        parent.clientTop +
        parent.scrollTop;
    this.transact(() => {
      ordered[0].before(wrapper);
      if (canvas) {
        wrapper.dataset.xepCanvas = "1";
        wrapper.dataset.xepOverlap = "";
        Object.assign(wrapper.style, {
          position: "absolute",
          left: `${left}px`,
          top: `${top}px`,
          width: `${Math.max(...rects.map((r) => r.right)) - base.left - parent.clientLeft + parent.scrollLeft - left}px`,
          height: `${Math.max(...rects.map((r) => r.bottom)) - base.top - parent.clientTop + parent.scrollTop - top}px`,
          zIndex: String(
            Math.max(...ordered.map((n) => Number(n.style.zIndex) || 0)),
          ),
        });
        ordered.forEach((n, i) => {
          n.style.left = `${rects[i].left - base.left - parent.clientLeft + parent.scrollLeft - left - (parseFloat(getComputedStyle(n).marginLeft) || 0)}px`;
          n.style.top = `${rects[i].top - base.top - parent.clientTop + parent.scrollTop - top - (parseFloat(getComputedStyle(n).marginTop) || 0)}px`;
        });
      }
      wrapper.append(...ordered);
    });
    this.tree();
    return this.idFor(wrapper)!;
  }
  ungroup(id: string) {
    const el = this.nodes([id])[0];
    if (!el.hasAttribute("data-xep-group"))
      throw new Error("请选择组合；普通背景外壳请使用拆分外壳。");
    if (el.style.transform && el.style.transform !== "none")
      throw new Error("请先将组合旋转恢复为 0° 再取消组合。");
    if (
      el.parentElement?.hasAttribute("data-xep-canvas") &&
      !el.hasAttribute("data-xep-canvas")
    )
      throw new Error("请先把组合内转换为叠放画布，以保留子组件位置。");
    this.transact(() => {
      if (el.parentElement?.hasAttribute("data-xep-canvas")) {
        const x = parseFloat(el.style.left) || 0,
          y = parseFloat(el.style.top) || 0;
        Array.from(el.children).forEach((n) => {
          const child = n as HTMLElement;
          child.style.left = `${x + (parseFloat(child.style.left) || 0)}px`;
          child.style.top = `${y + (parseFloat(child.style.top) || 0)}px`;
        });
      }
      el.replaceWith(...Array.from(el.childNodes));
    });
  }
  move(
    ids: string[],
    targetId: string,
    where: "before" | "after" | "inside" = "before",
  ) {
    const nodes = this.topNodes(ids);
    const target = this.nodes([targetId])[0];
    if (nodes.some((n) => n.matches("td,th,tr")) || target.matches("td,th,tr"))
      throw new Error("请移动整张表格，不要拖出单元格。");
    if (nodes.some((n) => n === target || n.contains(target)))
      throw new Error("不能把组件移动到自己内部。");
    const parent = where === "inside" ? target : target.parentElement!;
    if (where === "inside" && !parent.matches("section,div,li,blockquote"))
      throw new Error("只能放入布局或组合容器。");
    if (
      parent.hasAttribute("data-xep-canvas") ||
      nodes.some((n) => n.parentElement?.hasAttribute("data-xep-canvas"))
    )
      throw new Error(
        "画布组件请直接拖动坐标，跨入或移出画布请先切换为普通布局。",
      );
    this.transact(() => {
      if (where === "inside") parent.append(...nodes);
      else {
        const marker = where === "after" ? target.nextSibling : target;
        for (const n of nodes) parent.insertBefore(n, marker);
      }
    });
  }
  canvas(id: string) {
    const el = this.nodes([id])[0];
    if (!el.matches("section,div")) throw new Error("请选择布局或组合容器。");
    const children = Array.from(el.children) as HTMLElement[];
    if (!children.length) throw new Error("空容器请先添加内容。");
    const base = el.getBoundingClientRect(),
      rects = children.map((n) => n.getBoundingClientRect());
    this.transact(() => {
      el.dataset.xepCanvas = "1";
      el.dataset.xepOverlap = "";
      el.style.position = "relative";
      el.style.display = "block";
      el.style.height = `${Math.max(240, base.height)}px`;
      children.forEach((n, i) => {
        n.dataset.xepFlow = n.getAttribute("style") ?? "";
        Object.assign(n.style, {
          position: "absolute",
          margin: "0",
          left: `${rects[i].left - base.left - el.clientLeft + el.scrollLeft}px`,
          top: `${rects[i].top - base.top - el.clientTop + el.scrollTop}px`,
          width: `${rects[i].width}px`,
          height: `${rects[i].height}px`,
          zIndex: String(i),
        });
      });
    });
  }
  flow(id: string) {
    const el = this.nodes([id])[0];
    if (!el.hasAttribute("data-xep-canvas"))
      throw new Error("请选择叠放画布。");
    this.transact(() => {
      Array.from(el.children).forEach((n) => {
        const child = n as HTMLElement;
        if (child.dataset.xepFlow !== undefined) {
          child.setAttribute("style", child.dataset.xepFlow);
          delete child.dataset.xepFlow;
        } else {
          ["position", "left", "top", "z-index", "height"].forEach((k) =>
            child.style.removeProperty(k),
          );
          child.style.maxWidth = "100%";
        }
      });
      delete el.dataset.xepCanvas;
      delete el.dataset.xepOverlap;
      el.style.height = "auto";
    });
  }
  translate(ids: string[], dx: number, dy: number) {
    const nodes = this.topNodes(ids);
    if (!Number.isFinite(dx) || !Number.isFinite(dy))
      throw new Error("无效位移");
    if (nodes.some((n) => !n.parentElement?.hasAttribute("data-xep-canvas")))
      throw new Error("自由移动需要将组件放进叠放画布。");
    this.transact(() =>
      nodes.forEach((n) => {
        n.style.left = `${Math.round((parseFloat(n.style.left) || 0) + dx)}px`;
        n.style.top = `${Math.round((parseFloat(n.style.top) || 0) + dy)}px`;
      }),
    );
  }
  position(id: string, x: number, y: number) {
    const el = this.nodes([id])[0];
    this.translate(
      [id],
      x - (parseFloat(el.style.left) || 0),
      y - (parseFloat(el.style.top) || 0),
    );
  }
  layerCapability(ids: string[], action: "up" | "down" | "front" | "back") {
    try {
      const nodes = this.topNodes(ids, false),
        parent = nodes[0].parentElement!;
      if (nodes.some((n) => n.parentElement !== parent))
        return { allowed: false, reason: "请先选择同一父容器里的组件。" };
      const siblings = Array.from(parent.children) as HTMLElement[];
      if (siblings.length < 2)
        return {
          allowed: false,
          reason: "当前父容器里没有其他组件可调整遮挡。",
        };
      if (
        siblings.some(
          (n) =>
            !this.editable(n, true).allowed ||
            n.closest('[data-xep-locked="1"]'),
        )
      )
        return {
          allowed: false,
          reason: "同级包含锁定或特殊组件，不能调整遮挡。",
        };
      const overlap = nodes.some((n) => {
        const a = n.getBoundingClientRect();
        return siblings.some((other) => {
          if (other === n) return false;
          const b = other.getBoundingClientRect();
          return (
            a.width > 0 &&
            a.height > 0 &&
            b.width > 0 &&
            b.height > 0 &&
            Math.min(a.right, b.right) > Math.max(a.left, b.left) &&
            Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)
          );
        });
      });
      if (!parent.hasAttribute("data-xep-canvas") && !overlap)
        return {
          allowed: false,
          reason:
            "普通图文没有重叠，前后遮挡不会改变上下位置；请使用“向前移动 / 向后移动”。",
        };
      const order = siblings
        .map((n, i) => ({ n, i, z: Number(getComputedStyle(n).zIndex) || 0 }))
        .sort((a, b) => a.z - b.z || a.i - b.i)
        .map((v) => v.n);
      const edge =
        action === "up" || action === "front"
          ? order.slice(-nodes.length)
          : order.slice(0, nodes.length);
      if (edge.every((n) => nodes.includes(n)))
        return {
          allowed: false,
          reason:
            action === "up" || action === "front"
              ? "已在当前父层的最上方。"
              : "已在当前父层的最下方。",
        };
      return { allowed: true, reason: "只改变遮挡顺序，不移动文章位置。" };
    } catch (e) {
      return { allowed: false, reason: (e as Error).message };
    }
  }
  layer(ids: string[], action: "up" | "down" | "front" | "back") {
    const cap = this.layerCapability(ids, action);
    if (!cap.allowed) throw new Error(cap.reason);
    const nodes = this.topNodes(ids, false);
    const parent = nodes[0].parentElement;
    if (nodes.some((n) => n.parentElement !== parent))
      throw new Error("只能调整同一父容器内的前后顺序；跨父层请先调整结构。");
    const siblings = Array.from(parent!.children) as HTMLElement[];
    if (
      siblings.some(
        (n) =>
          !this.editable(n, true).allowed || n.closest('[data-xep-locked="1"]'),
      )
    )
      throw new Error("存在特殊组件，不能重排该上下文。");
    let order = siblings
      .map((n, i) => ({ n, i, z: Number(getComputedStyle(n).zIndex) || 0 }))
      .sort((a, b) => a.z - b.z || a.i - b.i)
      .map((v) => v.n);
    const selected = order.filter((n) => nodes.includes(n)),
      rest = order.filter((n) => !nodes.includes(n));
    if (action === "front") order = [...rest, ...selected];
    else if (action === "back") order = [...selected, ...rest];
    else {
      const scan = action === "up" ? [...order].reverse() : [...order];
      for (const n of scan)
        if (nodes.includes(n)) {
          const i = order.indexOf(n),
            j = i + (action === "up" ? 1 : -1);
          if (j >= 0 && j < order.length && !nodes.includes(order[j]))
            [order[i], order[j]] = [order[j], order[i]];
        }
    }
    this.transact(() =>
      order.forEach((n, i) => {
        if (
          getComputedStyle(n).position === "static" ||
          !getComputedStyle(n).position
        )
          n.style.position = "relative";
        n.style.zIndex = String(i);
      }),
    );
  }
  alignmentCapability(
    ids: string[],
    axis: "left" | "center" | "right" | "top" | "middle" | "bottom",
  ) {
    try {
      const nodes = this.topNodes(ids, false),
        parent = nodes[0].parentElement!;
      if (nodes.some((n) => n.parentElement !== parent))
        return { allowed: false, reason: "请先选择同一个父容器内的组件。" };
      if (parent.hasAttribute("data-xep-canvas"))
        return {
          allowed: true,
          reason: "以父画布的边缘或中心为参照，移动整个组件。",
        };
      if (["top", "middle", "bottom"].includes(axis))
        return {
          allowed: false,
          reason: "普通文章沿上下方向自然排版；垂直对齐需要叠放画布。",
        };
      const parentStyle = getComputedStyle(parent),
        available =
          parent.clientWidth -
          (parseFloat(parentStyle.paddingLeft) || 0) -
          (parseFloat(parentStyle.paddingRight) || 0);
      if (
        available > 0 &&
        nodes.every((n) => n.getBoundingClientRect().width >= available - 1)
      )
        return {
          allowed: false,
          reason:
            "组件已占满父容器宽度，没有可见的左右移动空间；请先减小组件宽度。文字对齐请到“文字”分类设置。",
        };
      if (
        available > 0 &&
        nodes.every((n) => {
          const pos = this.horizontalAlignment(n, axis);
          return Math.abs(pos.delta) < 0.75;
        })
      )
        return {
          allowed: false,
          reason: "组件已在所选对齐位置，无需重复移动。",
        };
      return {
        allowed: true,
        reason: "相对于父容器对齐整个组件；不改变文字段落的对齐方式。",
      };
    } catch (e) {
      return { allowed: false, reason: (e as Error).message };
    }
  }
  private horizontalAlignment(n: HTMLElement, axis: string) {
    const parent = n.parentElement!,
      s = getComputedStyle(parent);
    const box = parent.getBoundingClientRect(),
      own = n.getBoundingClientRect();
    const scale = parent.offsetWidth ? box.width / parent.offsetWidth : 1;
    const unit = scale || 1;
    const left =
      box.left +
      ((parseFloat(s.borderLeftWidth) || 0) +
        (parseFloat(s.paddingLeft) || 0)) *
        unit;
    const width =
      (parent.clientWidth -
        (parseFloat(s.paddingLeft) || 0) -
        (parseFloat(s.paddingRight) || 0)) *
      unit;
    const desired =
      left +
      (axis === "right"
        ? width - own.width
        : axis === "center"
          ? (width - own.width) / 2
          : 0);
    return { delta: (desired - own.left) / unit };
  }
  align(
    ids: string[],
    axis: "left" | "center" | "right" | "top" | "middle" | "bottom",
  ) {
    const cap = this.alignmentCapability(ids, axis);
    if (!cap.allowed) throw new Error(cap.reason);
    const nodes = this.topNodes(ids, false);
    const parent = nodes[0].parentElement!;
    if (!parent.hasAttribute("data-xep-canvas")) {
      const offsets = nodes.map((n) => this.horizontalAlignment(n, axis).delta);
      this.transact(() =>
        nodes.forEach((n, i) => {
          const s = getComputedStyle(n);
          // Keep flex sizing, transforms and the flow slot intact. Auto margins
          // cannot move a flex-grow item when its peers consume all free space.
          const positioned = [
            "relative",
            "absolute",
            "fixed",
            "sticky",
          ].includes(s.position);
          let base = positioned ? parseFloat(s.left) || 0 : 0;
          if (["absolute", "fixed"].includes(s.position) && s.left === "auto")
            base = n.offsetLeft - (parseFloat(s.marginLeft) || 0);
          if (!positioned) n.style.position = "relative";
          if (["absolute", "fixed"].includes(s.position))
            n.style.right = "auto";
          n.style.left = `${base + offsets[i]}px`;
        }),
      );
      return;
    }
    this.transact(() =>
      nodes.forEach((n) => {
        if (["left", "center", "right"].includes(axis))
          n.style.left = `${axis === "left" ? 0 : axis === "center" ? (parent.clientWidth - n.offsetWidth) / 2 : parent.clientWidth - n.offsetWidth}px`;
        else
          n.style.top = `${axis === "top" ? 0 : axis === "middle" ? (parent.clientHeight - n.offsetHeight) / 2 : parent.clientHeight - n.offsetHeight}px`;
      }),
    );
  }
  link(id: string, url: string) {
    const el = this.nodes([id])[0];
    if (url && !/^https:\/\//i.test(url))
      throw new Error("链接请输入 HTTPS 地址。");
    if (el.querySelector("section,div,table"))
      throw new Error("请选中文字段或图片设置链接。");
    this.transact(() => {
      const existing =
        el.tagName === "A" ? el : (el.closest("a") ?? el.querySelector("a"));
      const positionKeys = [
        "position",
        "left",
        "top",
        "width",
        "height",
        "zIndex",
        "transform",
      ] as const;
      if (existing) {
        if (url) existing.setAttribute("href", url);
        else {
          const image = existing.querySelector("img");
          if (image && existing.hasAttribute("data-xep-image-link"))
            for (const key of positionKeys)
              image.style[key] = (existing as HTMLElement).style[key];
          existing.replaceWith(...Array.from(existing.childNodes));
        }
      } else if (url) {
        const a = document.createElement("a");
        a.href = url;
        if (el.tagName === "IMG") {
          a.dataset.label = "图片链接";
          if (el.parentElement?.hasAttribute("data-xep-canvas")) {
            a.dataset.xepImageLink = "1";
            a.style.display = "block";
            for (const key of positionKeys) {
              a.style[key] = el.style[key];
              el.style[key] = "";
            }
            el.style.position = "static";
            el.style.width = "100%";
            el.style.height = "100%";
          }
          el.before(a);
          a.append(el);
        } else {
          a.append(...Array.from(el.childNodes));
          el.append(a);
        }
      }
    });
  }
  resize(id: string, width: number, height: number) {
    const el = this.nodes([id], false)[0];
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width < 16 ||
      height < 16
    )
      throw new Error("尺寸不能小于 16 像素");
    this.transact(() => {
      el.style.width = `${Math.round(width)}px`;
      el.style.height = `${Math.round(height)}px`;
    });
  }
}
