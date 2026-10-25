import type { Capability, Command, ComponentNode, Kind } from "./model";
import {
  hasBackground,
  styleOf,
  replaceParagraphText,
  textRuns,
} from "./appearance";

const blocked =
  "svg,iframe,video,audio,canvas,script,object,embed,[data-xep-special]";
const candidates =
  "section,div,p,h1,h2,h3,h4,blockquote,img,ul,ol,li,figure,svg,iframe,video,table,span,strong,em,b,i,a,font";
export class EditorAdapter {
  private ids = new WeakMap<Element, string>();
  private elements = new Map<string, HTMLElement>();
  private counter = 0;
  private undoStack: { before: string; after: string }[] = [];
  private redoStack: { before: string; after: string }[] = [];
  private baseline: string;
  private expected: string;
  private revision = 0;
  constructor(
    public readonly root: HTMLElement,
    public readonly mode: "demo" | "imported" | "xiumi-readonly",
  ) {
    this.baseline = this.expected = root.innerHTML;
  }
  private id(el: Element) {
    let id = this.ids.get(el);
    if (!id) {
      id = `node-${++this.counter}`;
      this.ids.set(el, id);
    }
    return id;
  }
  tree(): ComponentNode[] {
    this.elements.clear();
    const bounds = this.root.getBoundingClientRect();
    const walk = (
      el: HTMLElement,
      parentId: string | null,
      depth: number,
    ): ComponentNode[] => {
      if (
        depth > 40 ||
        this.elements.size >= 1500 ||
        el.matches("script,style,link,button,input,textarea") ||
        el.hidden
      )
        return [];
      if (this.mode === "xiumi-readonly") {
        const style = styleOf(el);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          el.matches(
            '.op-dock,[role="toolbar"],.tn-operator-depot,.tn-out-comp-edit-op-depot',
          )
        )
          return [];
        const rect = el.getBoundingClientRect();
        // Framework helper copies may be descendants of the editor yet render
        // outside the paper. Never offer those copies as article components.
        if (
          bounds.width > 0 &&
          bounds.height > 0 &&
          (rect.width <= 0 ||
            rect.height <= 0 ||
            rect.right <= bounds.left ||
            rect.left >= bounds.right ||
            rect.bottom <= bounds.top ||
            rect.top >= bounds.bottom)
        )
          return el.matches(blocked)
            ? []
            : Array.from(el.children).flatMap((c) =>
                walk(c as HTMLElement, parentId, depth + 1),
              );
        // These are editor/page shells, not article components. Retain their descendants.
        if (
          el.matches(
            '.tn-page-container,.tn-page-inst,.tn-page,[tn-comp-role="cube"],[tn-comp-role="page"],[tn-comp-role="layer"]',
          )
        )
          return Array.from(el.children).flatMap((c) =>
            walk(c as HTMLElement, parentId, depth + 1),
          );
        const ownText = Array.from(el.childNodes).some(
          (n) => n.nodeType === 3 && !!n.textContent?.trim(),
        );
        const decorated =
          hasBackground(el) ||
          [
            style.borderTopWidth,
            style.borderRightWidth,
            style.borderBottomWidth,
            style.borderLeftWidth,
            style.paddingTop,
            style.paddingRight,
            style.paddingBottom,
            style.paddingLeft,
            style.marginTop,
            style.marginRight,
            style.marginBottom,
            style.marginLeft,
          ].some((v) => parseFloat(v) > 0) ||
          /flex|grid/.test(style.display) ||
          !!el.dataset.label;
        if (
          el.matches("div,section,span") &&
          !ownText &&
          !decorated &&
          !el.matches(blocked)
        )
          return Array.from(el.children).flatMap((c) =>
            walk(c as HTMLElement, parentId, depth + 1),
          );
      }
      if (!el.matches(candidates))
        return Array.from(el.children).flatMap((c) =>
          walk(c as HTMLElement, parentId, depth + 1),
        );
      const id = this.id(el);
      this.elements.set(id, el);
      const kind: Kind = el.matches(blocked)
        ? "special"
        : el.tagName === "IMG"
          ? "image"
          : el.matches("p,h1,h2,h3,h4,blockquote,span,strong,em,b,i,a,font")
            ? "text"
            : hasBackground(el)
              ? "background"
              : el.querySelector(blocked)
                ? "special"
                : "layout";
      const label =
        el.dataset.label ||
        (kind === "image"
          ? (el as HTMLImageElement).alt
          : el.textContent?.trim().slice(0, 24)) ||
        (kind === "background"
          ? "背景板"
          : kind === "image"
            ? "图片"
            : kind === "text"
              ? "文字"
              : "布局");
      return [
        {
          id,
          kind,
          label,
          parentId,
          children: el.matches(blocked)
            ? []
            : Array.from(el.children).flatMap((c) =>
                walk(c as HTMLElement, id, depth + 1),
              ),
        },
      ];
    };
    return Array.from(this.root.children).flatMap((c) =>
      walk(c as HTMLElement, null, 0),
    );
  }
  element(id: string) {
    const el = this.elements.get(id);
    return el && this.root.isConnected && this.root.contains(el)
      ? el
      : undefined;
  }
  idFor(target: Element) {
    let el: Element | null = target;
    while (el && el !== this.root) {
      const id = this.ids.get(el);
      if (id && this.elements.has(id)) return id;
      el = el.parentElement;
    }
    return null;
  }
  get canUndo() {
    return this.undoStack.length > 0;
  }
  get canRedo() {
    return this.redoStack.length > 0;
  }
  get canRestore() {
    return (
      this.mode !== "xiumi-readonly" && this.root.innerHTML !== this.baseline
    );
  }
  private editable(el?: HTMLElement, propertyOnly = false): Capability {
    if (this.mode === "xiumi-readonly")
      return {
        allowed: false,
        reason: "真实秀米保存机制尚未验证，当前仅支持结构检查。",
      };
    if (!el || !this.root.isConnected || !this.root.contains(el))
      return { allowed: false, reason: "组件已失效，请重新选择。" };
    if (this.root.innerHTML !== this.expected)
      return {
        allowed: false,
        reason: "内容已被外部修改，请重新载入演示以避免覆盖。",
      };
    if (
      el.matches(blocked) ||
      (!propertyOnly && el.querySelector(blocked)) ||
      el.closest(blocked)
    )
      return { allowed: false, reason: "特殊或交互组件不支持修改。" };
    return { allowed: true, reason: "" };
  }
  capability(id: string, command: Command): Capability {
    const el = this.element(id);
    const base = this.editable(el);
    if (!base.allowed || !el) return base;
    if (
      (command === "up" && !el.previousElementSibling) ||
      (command === "down" && !el.nextElementSibling)
    )
      return { allowed: false, reason: "已到容器边界。" };
    if (command === "up" || command === "down") {
      const sibling =
        command === "up" ? el.previousElementSibling : el.nextElementSibling;
      if (sibling && !this.editable(sibling as HTMLElement).allowed)
        return { allowed: false, reason: "不能跨越特殊组件。" };
    }
    if (
      command === "promote" &&
      (el.parentElement === this.root ||
        !el.parentElement?.matches('[data-xep-layout="single"]') ||
        !this.editable(el.parentElement).allowed)
    )
      return { allowed: false, reason: "仅支持从普通单列布局中提升一层。" };
    if (
      command === "unwrap" &&
      (!el.matches('[data-xep-layout="single"]') || !el.children.length)
    )
      return { allowed: false, reason: "仅支持拆分有内容的普通单列布局。" };
    if (
      ["layerUp", "layerDown", "front", "back"].includes(command) &&
      (!el.parentElement?.matches("[data-xep-overlap]") ||
        !["absolute", "relative"].includes(el.style.position))
    )
      return { allowed: false, reason: "仅支持演示中已标记的同级重叠组件。" };
    return base;
  }
  private transact(fn: () => void) {
    const before = this.root.innerHTML;
    fn();
    const after = this.root.innerHTML;
    if (before !== after) {
      this.undoStack.push({ before, after });
      if (this.undoStack.length > 40) this.undoStack.shift();
      this.redoStack = [];
      this.expected = after;
      this.revision++;
      this.root.dispatchEvent(new CustomEvent("xep:change", { bubbles: true }));
    }
  }
  appearance(id: string) {
    const el = this.element(id);
    if (!el) return null;
    const style = styleOf(el);
    return {
      color: style.color,
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage,
      borderColor: style.borderColor,
      hasBackground: hasBackground(el),
    };
  }
  propertyCapability(
    id: string,
    property: "color" | "backgroundColor" | "borderColor" | "text",
  ): Capability {
    const el = this.element(id);
    const cap = this.editable(el, property !== "text");
    if (!cap.allowed || !el) return cap;
    if (
      property === "text" &&
      (!el.matches("p,h1,h2,h3,h4,blockquote,span,strong,em,b,i,a,font,li") ||
        el.querySelector("img,section,div,ul,ol,table,video,audio,svg"))
    )
      return {
        allowed: false,
        reason:
          "请选择文字段或具体文字节点，不能替换包含图片和布局的整块内容。",
      };
    return cap;
  }
  setColor(
    id: string,
    property: "color" | "backgroundColor" | "borderColor",
    color: string,
  ) {
    const cap = this.propertyCapability(id, property);
    if (!cap.allowed) throw new Error(cap.reason);
    if (
      !["color", "backgroundColor", "borderColor"].includes(property) ||
      !/^#[\da-f]{6}$/i.test(color)
    )
      throw new Error("请选择有效的六位十六进制颜色。");
    this.transact(() => {
      this.element(id)!.style[property] = color;
    });
  }
  clearBackgroundImage(id: string) {
    const cap = this.propertyCapability(id, "backgroundColor");
    if (!cap.allowed) throw new Error(cap.reason);
    this.transact(() => {
      this.element(id)!.style.backgroundImage = "none";
    });
  }
  text(id: string) {
    const el = this.element(id);
    return el ? textRuns(el).text : "";
  }
  setText(id: string, value: string) {
    const cap = this.propertyCapability(id, "text");
    if (!cap.allowed) throw new Error(cap.reason);
    if (value.length > 100_000) throw new Error("单段文字过长，请分段编辑。");
    this.transact(() => replaceParagraphText(this.element(id)!, value));
  }
  execute(id: string, command: Command) {
    const cap = this.capability(id, command);
    if (!cap.allowed) throw new Error(cap.reason);
    const el = this.element(id)!;
    this.transact(() => {
      if (command === "up")
        el.parentElement!.insertBefore(el, el.previousElementSibling);
      if (command === "down") el.nextElementSibling!.after(el);
      if (command === "promote") el.parentElement!.after(el);
      if (command === "unwrap") el.replaceWith(...Array.from(el.childNodes));
      if (["layerUp", "layerDown", "front", "back"].includes(command)) {
        const siblings = Array.from(
          el.parentElement!.children,
        ) as HTMLElement[];
        const order = siblings
          .map((node, index) => ({
            node,
            index,
            z: Number(node.style.zIndex) || 0,
          }))
          .sort((a, b) => a.z - b.z || a.index - b.index)
          .map((x) => x.node);
        const i = order.indexOf(el);
        order.splice(i, 1);
        const position =
          command === "front"
            ? order.length
            : command === "back"
              ? 0
              : command === "layerUp"
                ? Math.min(i + 1, order.length)
                : Math.max(0, i - 1);
        order.splice(position, 0, el);
        order.forEach((node, index) => {
          node.style.zIndex = String(index);
        });
      }
    });
  }
  swap(first: string, second: string) {
    const a = this.element(first),
      b = this.element(second);
    for (const el of [a, b]) {
      const cap = this.editable(el);
      if (!cap.allowed) throw new Error(cap.reason);
      if (el?.tagName !== "IMG") throw new Error("请选择两张普通图片。");
    }
    if (a === b) throw new Error("请选择另一张图片。");
    this.transact(() => {
      for (const attr of ["src", "srcset", "sizes", "alt"]) {
        const av = a!.getAttribute(attr),
          bv = b!.getAttribute(attr);
        bv === null ? a!.removeAttribute(attr) : a!.setAttribute(attr, bv);
        av === null ? b!.removeAttribute(attr) : b!.setAttribute(attr, av);
      }
    });
  }
  reorder(source: string, target: string) {
    const a = this.element(source),
      b = this.element(target);
    for (const el of [a, b]) {
      const cap = this.editable(el);
      if (!cap.allowed) throw new Error(cap.reason);
    }
    if (!a || !b || a === b || a.parentElement !== b.parentElement)
      throw new Error("仅支持同一容器内拖动排序。");
    this.transact(() => {
      const children = Array.from(a.parentElement!.children);
      if (children.indexOf(a) < children.indexOf(b)) b.after(a);
      else b.before(a);
    });
  }
  undo() {
    this.history(false);
  }
  redo() {
    this.history(true);
  }
  private history(redo: boolean) {
    if (
      this.mode === "xiumi-readonly" ||
      !this.root.isConnected ||
      this.root.innerHTML !== this.expected
    )
      throw new Error("内容环境已变化，无法恢复操作。");
    const from = redo ? this.redoStack : this.undoStack,
      to = redo ? this.undoStack : this.redoStack;
    const item = from.pop();
    if (!item) return;
    this.root.innerHTML = redo ? item.after : item.before;
    this.expected = this.root.innerHTML;
    to.push(item);
    this.revision++;
  }
  restore() {
    if (
      this.mode === "xiumi-readonly" ||
      !this.root.isConnected ||
      this.root.innerHTML !== this.expected
    )
      throw new Error("内容环境已变化，无法恢复。");
    this.transact(() => {
      this.root.innerHTML = this.baseline;
    });
  }
  token() {
    return this.revision;
  }
  warnings(id: string) {
    const el = this.element(id);
    if (!el) return [];
    return [
      el.style.background || el.style.backgroundImage ? "背景" : "",
      el.style.border ? "边框" : "",
      el.style.padding || el.style.margin ? "内外间距" : "",
    ].filter(Boolean);
  }
}
