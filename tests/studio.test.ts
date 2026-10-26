import { beforeEach, expect, it } from "vitest";
import { StudioEngine, cleanStudioHtml } from "../src/studio-engine";
import { readProject, projectFile } from "../src/project-store";
let root: HTMLElement, e: StudioEngine;
function setup(html: string) {
  root = document.createElement("article");
  document.body.replaceChildren(root);
  root.innerHTML = html;
  e = new StudioEngine(root);
  return e.tree();
}
const id = (selector: string) => e.idFor(root.querySelector(selector)!)!;
beforeEach(() => {
  setup('<p id="a">甲</p><p id="b">乙</p><p id="c">丙</p>');
});
it("组合按文档顺序保留内容与链接，整体移动后可取消组合和撤销", () => {
  root.querySelector("#b")!.innerHTML = '<a href="https://example.com">乙</a>';
  e = new StudioEngine(root);
  const group = e.group([id("#b"), id("#a")]);
  expect(root.firstElementChild!.textContent).toBe("甲乙");
  expect(root.querySelector("a")!.href).toBe("https://example.com/");
  e.move([group], id("#c"), "after");
  e.ungroup(group);
  expect(root.textContent).toBe("丙甲乙");
  e.undo();
  e.tree();
  expect(root.querySelector("[data-xep-group]")!.textContent).toBe("甲乙");
});
it("组合拒绝跨父层，拖动拒绝循环与画布跨界，不产生部分修改", () => {
  setup('<section id="g"><p id="a">甲</p></section><p id="b">乙</p>');
  const before = root.innerHTML;
  expect(() => e.group([id("#a"), id("#b")])).toThrow("同一个");
  expect(() => e.move([id("#g")], id("#a"), "inside")).toThrow("自己");
  expect(root.innerHTML).toBe(before);
});
it("任何普通文字与背景都能调整同级遮挡次序，并撤销", () => {
  setup(
    '<section data-xep-canvas="1"><p id="a">文字</p><section id="b" style="background-color:red;height:20px"></section></section>',
  );
  e.layer([id("#a")], "front");
  expect(root.querySelector<HTMLElement>("#a")!.style.zIndex).toBe("1");
  expect(root.querySelector<HTMLElement>("#a")!.style.position).toBe(
    "relative",
  );
  e.undo();
  expect(root.querySelector<HTMLElement>("#a")!.style.zIndex).toBe("");
});
it("自由移动是一次事务，位置、文本和链接在撤销重做后完整", () => {
  setup(
    '<section data-xep-canvas="1"><p id="a" style="position:absolute;left:20px;top:30px"><a href="https://example.com">甲</a></p><p>乙</p></section>',
  );
  e.translate([id("#a")], 15, -10);
  expect(root.querySelector<HTMLElement>("#a")!.style.left).toBe("35px");
  e.undo();
  expect(root.querySelector<HTMLElement>("#a")!.style.top).toBe("30px");
  e.redo();
  expect(root.querySelector("a")!.href).toBe("https://example.com/");
});
it("普通组件不能自由平移，锁定组件不可编辑或删除", () => {
  expect(() => e.translate([id("#a")], 10, 10)).toThrow("叠放");
  e.lock(id("#a"));
  expect(() => e.setText(id("#a"), "改动")).toThrow("锁定");
  expect(() => e.remove([id("#a")])).toThrow("锁定");
  e.lock(id("#a"));
  e.setText(id("#a"), "可编辑");
  expect(root.firstElementChild!.textContent).toBe("可编辑");
});
it("复制清除重复DOM ID，删除、插入可整体撤销", () => {
  e.duplicate([id("#a")]);
  expect(root.querySelectorAll("#a")).toHaveLength(1);
  expect(root.children).toHaveLength(4);
  const added = e.insert("heading");
  e.remove([added]);
  e.undo();
  expect(root.querySelector("h2")).not.toBeNull();
});
it("文字、字体、颜色、布局样式不接受CSS执行或远程URL注入", () => {
  e.style([id("#a")], { fontWeight: "700", fontSize: "20px" });
  expect(root.querySelector<HTMLElement>("#a")!.style.fontWeight).toBe("700");
  e.style([id("#a")], { width: "200", padding: "12 20" });
  expect(root.querySelector<HTMLElement>("#a")!.style.width).toBe("200px");
  expect(root.querySelector<HTMLElement>("#a")!.style.padding).toBe(
    "12px 20px",
  );
  expect(() =>
    e.style([id("#a")], { backgroundImage: "url(https://bad.test/a)" }),
  ).toThrow("样式");
  expect(() => e.link(id("#a"), "javascript:alert(1)")).toThrow("HTTPS");
});
it("表格单元格可编辑文字，不能被拖出或当成组合", () => {
  setup(
    '<table><tbody><tr><td id="a">甲</td><td id="b">乙</td></tr></tbody></table>',
  );
  e.setText(id("#a"), "新内容");
  expect(root.querySelector("td")!.textContent).toBe("新内容");
  expect(() => e.group([id("#a"), id("#b")])).toThrow("表格");
  expect(() => e.move([id("#a")], id("#b"))).toThrow("整张表格");
});
it("工程往返保留组合与锁定标记，重新导入过滤脚本", () => {
  const file = projectFile({
    id: "local",
    title: "测试",
    html: '<section data-xep-group="1"><p data-xep-locked="1">文字</p></section><script>alert(1)</script>',
    width: 390,
    updated: 0,
  });
  const parsed = readProject(JSON.parse(file));
  expect(parsed.html).toContain("data-xep-group");
  expect(parsed.html).toContain("data-xep-locked");
  expect(parsed.html).not.toContain("script");
  expect(() =>
    readProject({
      format: "xep-studio",
      version: 1,
      html: "a",
      title: "b",
      width: -1,
    }),
  ).toThrow("格式");
});
it("导入工程移除可执行标签与事件，图片协议受限", () => {
  expect(
    cleanStudioHtml(
      '<img src="x" onerror="alert(1)"><iframe src="https://bad.test"></iframe>',
    ),
  ).not.toMatch(/onerror|iframe/);
  expect(() => e.image("javascript:alert(1)")).toThrow("HTTPS");
});

it("画布内带外边距的组件组合与拆分后保留绝对位置", () => {
  setup(
    '<section data-xep-canvas="1" id="canvas"><p id="a" style="position:absolute;left:20px;top:30px;margin:5px">甲</p><p id="b" style="position:absolute;left:80px;top:90px;margin:0">乙</p></section>',
  );
  const rect = (left: number, top: number, width: number, height: number) => ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON() {},
  });
  root.querySelector("#canvas")!.getBoundingClientRect = () =>
    rect(100, 200, 400, 300);
  root.querySelector("#a")!.getBoundingClientRect = () =>
    rect(125, 235, 40, 50);
  root.querySelector("#b")!.getBoundingClientRect = () =>
    rect(180, 290, 60, 30);
  const g = e.group([id("#a"), id("#b")]);
  e.translate([g], 10, 10);
  e.ungroup(g);
  expect(root.querySelector<HTMLElement>("#a")!.style.left).toBe("30px");
  expect(root.querySelector<HTMLElement>("#b")!.style.top).toBe("100px");
});
it("选中的画布可直接接收新文字，图片链接不会破坏画布定位", () => {
  setup(
    '<section id="canvas" data-xep-canvas="1"><img id="pic" src="a.png" style="position:absolute;left:20px;top:30px;width:120px;height:90px"></section>',
  );
  e.insert("text", id("#canvas"), "inside");
  expect(root.querySelector("#canvas")!.children).toHaveLength(2);
  e.link(id("#pic"), "https://example.com");
  e.tree();
  const link = root.querySelector("a")!;
  expect(link.style.left).toBe("20px");
  e.link(e.idFor(link)!, "");
  expect(root.querySelector<HTMLImageElement>("#pic")!.style.left).toBe("20px");
  expect(root.querySelector("a")).toBeNull();
});
it("富文本选区格式保留换行且清理执行内容", () => {
  e.setRichText(
    id("#a"),
    "第一行<div><b>第二行</b></div><div>第三行<script>bad()</script></div>",
  );
  expect(e.text(id("#a"))).toBe("第一行\n第二行\n第三行");
  expect(root.querySelector("#a b")).not.toBeNull();
  expect(root.querySelector("script")).toBeNull();
});

it("文字默认跳出横向模板在下方插入，不拆坏推荐语容器", () => {
  setup(
    '<section id="book"><img src="a.png"><section id="row" style="display:flex"><section id="a" style="width:100%;border:1px solid red"><h3>推荐语</h3><p>长段落</p></section><span>装饰</span></section></section>',
  );
  const before = root.querySelector("#a")!.outerHTML;
  const inserted = e.insert("text", id("#a"));
  expect(e.element(inserted)!.parentElement!.id).toBe("book");
  expect(root.querySelector("#row")!.nextElementSibling).toBe(
    e.element(inserted),
  );
  expect(root.querySelector("#a")!.outerHTML).toBe(before);
  e.undo();
  expect(root.querySelector("#a")!.outerHTML).toBe(before);
  expect(root.querySelector("#row")!.children).toHaveLength(2);
});
it("前插后插空行均在横向块外，默认画布插入也落入文流", () => {
  setup(
    '<section id="row" style="display:grid;grid-template-columns:1fr 1fr"><p id="a">甲</p><p>乙</p></section><section id="canvas" data-xep-canvas="1"><p id="inside" style="position:absolute">画布</p></section>',
  );
  const before = e.insert("blank", id("#a"), "before");
  const after = e.insert("blank", id("#a"), "after");
  expect(root.querySelector("#row")!.previousElementSibling).toBe(
    e.element(before),
  );
  expect(root.querySelector("#row")!.nextElementSibling).toBe(e.element(after));
  const text = e.insert("text", id("#inside"));
  expect(root.querySelector("#canvas")!.nextElementSibling).toBe(
    e.element(text),
  );
  expect(e.element(text)!.style.position).toBe("");
});
it("前后移动恢复文章顺序，选中横排内部时移动整块", () => {
  setup(
    '<p id="first">首段</p><section id="row" style="display:flex"><section id="a"><p>推荐语</p></section></section><p id="last">末段</p>',
  );
  e.order([id("#a")], "up");
  expect(root.firstElementChild!.id).toBe("row");
  expect(e.orderCapability([id("#a")], "up").allowed).toBe(false);
  e.order([id("#a")], "down");
  expect(root.children[1].id).toBe("row");
  e.undo();
  expect(root.firstElementChild!.id).toBe("row");
});
it("普通无重叠内容禁用遮挡按钮，说明应该移动阅读顺序", () => {
  setup('<p id="a">甲</p><p id="b">乙</p>');
  const cap = e.layerCapability([id("#a")], "up");
  expect(cap.allowed).toBe(false);
  expect(cap.reason).toContain("向前移动");
  const original = root.innerHTML;
  expect(() => e.layer([id("#a")], "up")).toThrow("普通图文");
  expect(root.innerHTML).toBe(original);
});
it("普通组件允许左右对齐，垂直对齐明确需要画布", () => {
  setup(
    '<section><section id="a" style="width:120px"><p>文字</p></section></section>',
  );
  e.align([id("#a")], "right");
  expect(root.querySelector<HTMLElement>("#a")!.style.marginLeft).toBe("auto");
  expect(root.querySelector<HTMLElement>("#a")!.style.marginRight).toBe("0px");
  expect(e.alignmentCapability([id("#a")], "top").allowed).toBe(false);
  expect(() => e.align([id("#a")], "top")).toThrow("垂直对齐");
  e.undo();
  expect(root.querySelector<HTMLElement>("#a")!.style.marginLeft).toBe("");
});
it("撤销重做后保留同一结构的选择，并可继续编辑", () => {
  const current = id("#a");
  e.style([current], { backgroundColor: "#e5c598" });
  const restored = e.undoSelection([current]);
  expect(restored).toHaveLength(1);
  expect(e.element(restored[0])!.id).toBe("a");
  expect(e.element(restored[0])!.style.backgroundColor).toBe("");
  const redone = e.undoSelection(restored, true);
  expect(e.element(redone[0])!.style.backgroundColor).toBe(
    "rgb(229, 197, 152)",
  );
});
