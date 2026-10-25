import { afterEach, expect, it, vi } from "vitest";
import { discoverRegion } from "../src/discovery";
afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
function dimensions() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      return {
        width: this.tagName === "MAIN" ? 1200 : 420,
        height: 500,
        top: 0,
        left: 0,
        right: 420,
        bottom: 500,
        x: 0,
        y: 0,
        toJSON() {},
      };
    },
  );
}
it("局部推荐语文字框不会遮蔽祖先中的封面和其他书目", () => {
  document.body.innerHTML =
    '<main><article id="paper"><h1>十本书</h1><section><img src="one.png"><div contenteditable="true"><p>推荐语</p><p>人脑如何进化</p></div></section><section><h2>第二本书</h2><img src="two.png"><p>另一段推荐语</p></section></article></main>';
  dimensions();
  const result = discoverRegion(document)!;
  expect(result.root.id).toBe("paper");
  expect(result.root.querySelectorAll("img")).toHaveLength(2);
  expect(result.scope).toContain("候选区域");
});
it("不把带有工具栏和素材库的应用外壳当成文章", () => {
  document.body.innerHTML =
    '<div id="app"><button>素材库</button><img src="template.png"><article id="paper"><h1>推文</h1><div contenteditable="true"><p>推荐语</p><p>正文</p></div><img src="cover.png"></article></div>';
  dimensions();
  expect(discoverRegion(document)!.root.id).toBe("paper");
});
it("只找到文字片段时明确提示范围可能不完整", () => {
  document.body.innerHTML =
    '<div contenteditable="true"><p>推荐语</p><p>正文</p></div>';
  dimensions();
  expect(discoverRegion(document)!.scope).toContain("局部文字框");
});
it("没有候选时不回退为整页，也不会选中隐藏编辑框", () => {
  document.body.innerHTML =
    '<div contenteditable="true" style="display:none"><p>隐藏</p></div>';
  dimensions();
  expect(discoverRegion(document)).toBeNull();
});
