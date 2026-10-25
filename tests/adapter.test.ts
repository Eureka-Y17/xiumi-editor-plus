import { beforeEach, describe, expect, it } from "vitest";
import { EditorAdapter } from "../src/adapter";
import { fixtures } from "../src/fixtures";
import type { ComponentNode } from "../src/model";
let root: HTMLElement;
function setup(html: string, mode: "demo" | "xiumi-readonly" = "demo") {
  root.innerHTML = html;
  const a = new EditorAdapter(root, mode);
  a.tree();
  return a;
}
const flatten = (nodes: ComponentNode[]): ComponentNode[] =>
  nodes.flatMap((n) => [n, ...flatten(n.children)]);
beforeEach(() => {
  document.body.innerHTML = "<article></article>";
  root = document.querySelector("article")!;
});
describe("编辑操作与数据完整性", () => {
  it("交换响应式图片素材但保留位置、裁切和链接", () => {
    const a = setup(
      '<div><a href="https://example.com"><img src="a.png" srcset="a2.png 2x" alt="A" style="width:100px;object-fit:cover"/></a><img src="b.png" alt="B" style="height:90px"/></div>',
    );
    const images = flatten(a.tree()).filter((n) => n.kind === "image");
    a.swap(images[0].id, images[1].id);
    const [first, second] = root.querySelectorAll("img");
    expect(first.getAttribute("src")).toBe("b.png");
    expect(first.hasAttribute("srcset")).toBe(false);
    expect(second.getAttribute("srcset")).toBe("a2.png 2x");
    expect(first.style.width).toBe("100px");
    expect(first.style.objectFit).toBe("cover");
    expect(root.querySelector("a")!.href).toBe("https://example.com/");
    a.undo();
    expect(root.querySelector("img")!.getAttribute("src")).toBe("a.png");
    a.redo();
    expect(root.querySelector("img")!.getAttribute("src")).toBe("b.png");
  });
  it("同级顺序调整并保持无关内容", () => {
    const a = setup("<p>A</p><p>B</p><p>C</p>");
    a.execute(a.tree()[0].id, "down");
    expect(root.textContent).toBe("BAC");
    a.undo();
    expect(root.textContent).toBe("ABC");
  });
  it("拖动只允许同父节点，向后移动到目标后面", () => {
    const a = setup("<p>A</p><p>B</p><section><p>C</p></section>");
    const tree = a.tree();
    a.reorder(tree[0].id, tree[1].id);
    expect(root.textContent).toBe("BAC");
    expect(() => a.reorder(tree[0].id, tree[2].children[0].id)).toThrow(
      "同一容器",
    );
  });
  it("拆组保留所有内容、链接和列表，可恢复", () => {
    const a = setup(fixtures[10].html);
    const node = a.tree()[1];
    const text = root.textContent;
    const href = root.querySelector("a")!.href;
    a.execute(node.id, "unwrap");
    expect(root.textContent).toBe(text);
    expect(root.querySelector("a")!.href).toBe(href);
    expect(root.querySelectorAll("li")).toHaveLength(2);
    expect(root.querySelector("section")).toBeNull();
    a.restore();
    expect(root.querySelector("section")).not.toBeNull();
    a.undo();
    expect(root.querySelector("section")).toBeNull();
  });
  it("提升一层只开放普通单列父容器", () => {
    const a = setup(
      '<section data-xep-layout="single"><p>A</p></section><p>B</p>',
    );
    a.execute(a.tree()[0].children[0].id, "promote");
    expect(root.children[1].textContent).toBe("A");
  });
  it("图层上移根据实际排序，而非单纯数值加一", () => {
    const a = setup(
      '<div data-xep-overlap><p style="position:absolute;z-index:1">A</p><p style="position:absolute;z-index:100">B</p></div>',
    );
    const children = a.tree()[0].children;
    a.execute(children[0].id, "layerUp");
    const els = root.querySelectorAll("p");
    expect(+els[0].style.zIndex).toBeGreaterThan(+els[1].style.zIndex);
  });
  it("特殊组件及包含特殊组件的外壳不允许修改", () => {
    const a = setup(fixtures[8].html);
    const special = a.tree()[1];
    expect(a.capability(special.id, "unwrap").allowed).toBe(false);
    expect(() => a.execute(special.id, "down")).toThrow();
  });
  it("真实秀米模式的修改、交换、历史和恢复均被拦截", () => {
    const a = setup(fixtures[3].html, "xiumi-readonly");
    const nodes = flatten(a.tree());
    for (const node of nodes)
      expect(a.capability(node.id, "up").allowed).toBe(false);
    const images = nodes.filter((n) => n.kind === "image");
    expect(() => a.swap(images[0].id, images[1].id)).toThrow("尚未验证");
    expect(() => a.restore()).toThrow();
    expect(() => a.undo()).toThrow();
  });
  it("拒绝过期节点与已脱离页面的根节点", () => {
    const a = setup("<p>A</p><p>B</p>");
    const id = a.tree()[0].id;
    root.firstElementChild!.remove();
    expect(a.element(id)).toBeUndefined();
    expect(() => a.execute(id, "down")).toThrow();
  });
  it("外部变化后拒绝覆盖和撤销", () => {
    const a = setup("<p>A</p><p>B</p>");
    a.execute(a.tree()[0].id, "down");
    root.append(document.createElement("p"));
    expect(() => a.undo()).toThrow("环境已变化");
    expect(() => a.execute(a.tree()[0].id, "down")).toThrow("外部修改");
  });
  it("外壳样式损失提示包含背景、边框与间距", () => {
    const a = setup(fixtures[5].html);
    expect(a.warnings(a.tree()[1].id)).toEqual(["背景", "边框", "内外间距"]);
  });
  it.each(fixtures.map((f) => [f.name, f.html]))(
    "识别自制模板 %s",
    (_, html) => {
      root.innerHTML = html;
      const normalized = root.innerHTML;
      const a = new EditorAdapter(root, "demo");
      expect(a.tree().length).toBeGreaterThan(0);
      expect(root.innerHTML).toBe(normalized);
    },
  );
});
