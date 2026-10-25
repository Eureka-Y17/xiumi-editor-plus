import { beforeEach, expect, it } from "vitest";
import {
  importArticle,
  exportArticle,
  prepareImportedRoot,
} from "../src/importer";
import { EditorAdapter } from "../src/adapter";
beforeEach(() => {
  document.body.innerHTML = "<article></article>";
});
it("保留富文本样式、图片、背景、链接和嵌套", () => {
  const result = importArticle(
    '<section style="background:#faf7e0;padding:20px"><h2>书单</h2><p style="line-height:2">推荐语</p><a href="https://example.com"><img alt="封面" src="https://example.com/cover.png"></a></section>',
  );
  const root = document.querySelector("article")!;
  root.innerHTML = result.html;
  expect(result.images).toBe(1);
  expect(root.querySelector("section")!.style.padding).toBe("20px");
  expect(root.querySelector("p")!.style.lineHeight).toBe("2");
  expect(root.querySelector("a")!.href).toBe("https://example.com/");
});
it("移除执行代码、内联事件、iframe和外部样式表", () => {
  const result = importArticle(
    '<script>alert(1)</script><link rel="stylesheet" href="https://example.com/style.css"><style>body{display:none}</style><iframe src="https://example.com"></iframe><p onclick="alert(1)">安全正文</p><a href="javascript:alert(1)">链接</a>',
  );
  expect(result.html).not.toMatch(
    /script|onclick|iframe|stylesheet|<style|javascript:/i,
  );
  expect(result.html).toContain("安全正文");
});
it("纯文本或空富文本不会被误认为完整组件导入", () => {
  expect(() => importArticle("")).toThrow("富文本");
  expect(() => importArticle("<br>")).toThrow("没有可导入");
});
it("导入自动标记普通单列、排除多列与SVG，并且导出移除助手标记", () => {
  const root = document.querySelector("article")!;
  root.innerHTML = importArticle(
    '<section style="padding:20px"><p>正文</p></section><div style="display:flex"><p>A</p><p>B</p></div><section><svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg></section>',
  ).html;
  prepareImportedRoot(root);
  expect(root.children[0].getAttribute("data-xep-layout")).toBe("single");
  expect(root.children[1].hasAttribute("data-xep-layout")).toBe(false);
  expect(root.children[2].hasAttribute("data-xep-layout")).toBe(false);
  const result = exportArticle(root);
  expect(result.html).not.toContain("data-xep-");
  expect(root.children[0].hasAttribute("data-xep-layout")).toBe(true);
  expect(result.html).toContain("padding:20px");
});
it("导入副本可排序、拆组与撤销，不写回来源", () => {
  const original = "<section><p>推荐语</p><p>正文</p></section>";
  const root = document.querySelector("article")!;
  root.innerHTML = importArticle(original).html;
  prepareImportedRoot(root);
  const a = new EditorAdapter(root, "imported");
  const tree = a.tree();
  a.execute(tree[0].id, "unwrap");
  expect(root.querySelector("section")).toBeNull();
  a.undo();
  expect(root.querySelector("section")).not.toBeNull();
  expect(original).toBe("<section><p>推荐语</p><p>正文</p></section>");
});
it("清除输入中的伪造助手标记，SVG仍给出兼容提示", () => {
  const result = importArticle(
    '<section data-xep-overlap><p data-xep-layout="single">正文</p><svg viewBox="0 0 10 10"><circle r="3"/></svg></section>',
  );
  expect(result.html).not.toContain("data-xep-");
  expect(result.warnings.join()).toContain("SVG");
});
it("超过导入大小上限时拒绝", () => {
  expect(() => importArticle("a".repeat(5_000_001))).toThrow("5 MB");
});
