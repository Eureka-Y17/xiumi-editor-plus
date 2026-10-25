import { beforeEach, expect, it } from "vitest";
import { EditorAdapter } from "../src/adapter";
import { hasBackground, textRuns } from "../src/appearance";
let root: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = "<article></article>";
  root = document.querySelector("article")!;
});
function setup(html: string, mode: "imported" | "xiumi-readonly" = "imported") {
  root.innerHTML = html;
  const a = new EditorAdapter(root, mode);
  a.tree();
  return a;
}
it("纯色、渐变与背景图片均识别为背景板，透明布局保持普通布局", () => {
  const a = setup(
    '<section style="background-color:#f9f5e1"><p>正文</p></section><div style="background-image:linear-gradient(red,blue)">渐变</div><div style="background-image:url(cover.png)">图片</div><div style="background-color:transparent">透明</div>',
  );
  expect(a.tree().map((n) => n.kind)).toEqual([
    "background",
    "background",
    "background",
    "layout",
  ]);
});
it("读取计算样式中的背景色，适用于CSS类背景", () => {
  const style = document.createElement("style");
  style.textContent = ".cream{background-color:#f9f5e1}";
  document.head.append(style);
  try {
    const a = setup('<section class="cream"><p>正文</p></section>');
    expect(a.tree()[0].kind).toBe("background");
  } finally {
    style.remove();
  }
});
it("只修改选中背景，保留边框、间距与图片，可撤销", () => {
  const a = setup(
    '<section style="background-color:#eee;border:1px solid red;padding:20px"><img src="a.png"><p>正文</p></section><p>其他段落</p>',
  );
  const id = a.tree()[0].id;
  a.setColor(id, "backgroundColor", "#123456");
  expect(root.querySelector("section")!.style.backgroundColor).toBe(
    "rgb(18, 52, 86)",
  );
  expect(root.querySelector("section")!.style.padding).toBe("20px");
  expect(root.querySelector("img")!.src).toContain("a.png");
  a.undo();
  expect(root.querySelector("section")!.style.backgroundColor).toBe(
    "rgb(238, 238, 238)",
  );
});
it("渐变不会被修改底色静默移除；移除背景图是单独可撤销动作", () => {
  const a = setup(
    '<section style="background:linear-gradient(red,blue)">正文</section>',
  );
  const id = a.tree()[0].id;
  a.setColor(id, "backgroundColor", "#ffffff");
  expect(root.firstElementChild!.getAttribute("style")).toContain(
    "linear-gradient",
  );
  a.clearBackgroundImage(id);
  expect((root.firstElementChild as HTMLElement).style.backgroundImage).toBe(
    "none",
  );
  a.undo();
  expect(hasBackground(root.firstElementChild as HTMLElement)).toBe(true);
});
it("背景板包含SVG时允许改容器颜色，但不允许拆SVG结构", () => {
  const a = setup(
    '<section style="background:#eee"><svg><rect width="10" height="10"/></svg><p>正文</p></section>',
  );
  const id = a.tree()[0].id;
  expect(a.tree()[0].kind).toBe("background");
  expect(a.propertyCapability(id, "backgroundColor").allowed).toBe(true);
  expect(a.capability(id, "unwrap").allowed).toBe(false);
  a.setColor(id, "backgroundColor", "#123456");
  expect(root.querySelector("svg")).not.toBeNull();
});
it("编辑文字时保留未变更的加粗、颜色、链接与其他段落", () => {
  const a = setup(
    '<p>欢迎<strong style="color:red">阅读</strong>，查看<a href="https://example.com">书单</a>。</p><p>其他段落</p>',
  );
  const id = a.tree()[0].id;
  a.setText(id, "欢迎阅读，查看精选书单。");
  expect(root.querySelector("p")!.textContent).toBe("欢迎阅读，查看精选书单。");
  expect(root.querySelector("strong")!.textContent).toBe("阅读");
  expect(root.querySelector("strong")!.style.color).toBe("red");
  expect(root.querySelector("a")!.href).toBe("https://example.com/");
  expect(root.children[1].textContent).toBe("其他段落");
  a.undo();
  expect(root.querySelector("p")!.textContent).toBe("欢迎阅读，查看书单。");
});
it("文字编辑支持换行与emoji，输入按文字处理不执行HTML", () => {
  const a = setup("<p>第一行<br>第二行😀</p>");
  const id = a.tree()[0].id;
  expect(a.text(id)).toBe("第一行\n第二行😀");
  a.setText(id, "第一行\n新一行🙂<img>");
  expect(textRuns(root.querySelector("p")!).text).toBe("第一行\n新一行🙂<img>");
  expect(root.querySelector("img")).toBeNull();
});
it("禁止用文字替换包含图片的结构，也拒绝非法颜色和真实页写操作", () => {
  const a = setup('<section><img src="a.png"><p>正文</p></section>');
  expect(() => a.setText(a.tree()[0].id, "丢弃图片")).toThrow();
  expect(() => a.setColor(a.tree()[0].id, "color", "url(evil)")).toThrow();
  const live = setup("<p>原稿</p>", "xiumi-readonly");
  expect(() => live.setColor(live.tree()[0].id, "color", "#ffffff")).toThrow(
    "尚未验证",
  );
  expect(() => live.setText(live.tree()[0].id, "修改")).toThrow();
});

it("真实页结构跳过页面外壳、隐藏副本与工具层，保留可见文章组件", () => {
  const a = setup(
    '<div class="tn-page-inst"><section tn-comp-role="page"><div tn-comp-role="layer"><section style="background-color:#f9f5e1"><p>实际正文</p><img src="cover.png"></section></div></section><div style="display:none"><p>隐藏副本</p></div><div class="op-dock"><p>工具浮层</p></div></div>',
    "xiumi-readonly",
  );
  const tree = a.tree();
  expect(tree).toHaveLength(1);
  expect(tree[0].kind).toBe("background");
  expect(tree[0].children.map((n) => n.kind)).toEqual(["text", "image"]);
});

it("多层无样式空外壳不产生未命名链，保留背景与图文", () => {
  const a = setup(
    '<div><div></div><div><div><section style="background-color:#f9f5e1"><p>推荐语</p><img src="cover.png"></section></div></div></div>',
    "xiumi-readonly",
  );
  const tree = a.tree();
  expect(tree).toHaveLength(1);
  expect(tree[0].kind).toBe("background");
  expect(tree[0].children.map((n) => n.label)).toEqual(["推荐语", "图片"]);
});
