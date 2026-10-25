import { chromium, expect, test } from "@playwright/test";
import path from "node:path";
test("安装真实扩展并验证演示、面板与只读保护", async () => {
  const extension = path.resolve(".output/chrome-mv3");
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    executablePath: process.env.XEP_BROWSER_EXECUTABLE || undefined,
    headless: true,
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
    viewport: { width: 1440, height: 1050 },
  });
  try {
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent("serviceworker");
    const id = new URL(worker.url()).host,
      page = await context.newPage();
    await page.goto(`chrome-extension://${id}/demo.html?legacy=1`);
    await expect(
      page.getByRole("complementary", { name: "秀米编辑增强面板" }),
    ).toBeVisible();
    await page.getByRole("button", { name: /单列拆组/ }).click();
    await page.locator(".node").filter({ hasText: "单列卡片" }).click();
    await page.getByRole("button", { name: "拆分外壳", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "确认拆组" })).toBeVisible();
    await page.getByRole("button", { name: "确认拆组", exact: true }).click();
    await expect(page.locator("article section")).toHaveCount(0);
    await page.getByRole("button", { name: "撤销", exact: true }).click();
    await expect(page.locator("article section")).toHaveCount(1);
    await page.getByRole("button", { name: /并排双图/ }).click();
    const before = await page
      .locator("article img")
      .first()
      .getAttribute("src");
    await page.locator(".node").filter({ hasText: "山间来信" }).click();
    await page
      .getByRole("button", { name: "与另一张图片交换", exact: true })
      .click();
    await page.locator(".node").filter({ hasText: "海边日记" }).click();
    expect(
      await page.locator("article img").first().getAttribute("src"),
    ).not.toBe(before);
    await page.getByRole("button", { name: "收起面板" }).click();
    await page.getByRole("button", { name: "打开编辑助手" }).click();
    await expect(
      page.getByRole("complementary", { name: "秀米编辑增强面板" }),
    ).toBeVisible();
    await page.getByRole("button", { name: /山野来信/ }).click();
    await page.screenshot({
      path: "docs/screenshots/workspace.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: /重叠图层/ }).click();
    await page.locator(".node").filter({ hasText: "苔绿卡片" }).click();
    await page.getByRole("button", { name: "置顶", exact: true }).click();
    await expect(page.locator('article [data-label="苔绿卡片"]')).toHaveCSS(
      "z-index",
      "1",
    );
    await page.screenshot({
      path: "docs/screenshots/layers.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: /长文章/ }).click();
    await expect(page.locator(".tree-row")).toHaveCount(101);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator(".editor-space")).toBeVisible();
    await page.screenshot({
      path: "docs/screenshots/mobile.png",
      fullPage: false,
    });
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page
      .getByRole("button", { name: "导入秀米推文", exact: true })
      .click();
    await page.evaluate(async () => {
      const cover = (color: string, title: string) => {
        const canvas = document.createElement("canvas");
        canvas.width = 200;
        canvas.height = 260;
        const c = canvas.getContext("2d")!;
        c.fillStyle = color;
        c.fillRect(0, 0, 200, 260);
        c.strokeStyle = "#fff8";
        c.strokeRect(12, 12, 176, 236);
        c.fillStyle = "#fff";
        c.font = "22px sans-serif";
        c.fillText(title, 25, 80);
        c.font = "12px sans-serif";
        c.fillText("FIELD NOTES", 25, 220);
        return canvas.toDataURL("image/png");
      };
      const html = `<section style="background:#f9f5e1;padding:20px;border:1px solid #a66"><h2>导出 HTML 夹具书单</h2><p style="line-height:2">推荐语：把生活的留白，交给阅读。</p><div><img alt="书封一" src="${cover("#527b67", "BOOK / 01")}" style="width:120px;height:160px"><img alt="书封二" src="${cover("#b18b60", "BOOK / 02")}" style="width:100px;height:140px"></div></section>`;
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
    });
    await page.getByRole("textbox", { name: "粘贴秀米富文本" }).click();
    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+V" : "Control+V",
    );
    await expect(
      page.getByText("已导入图文 · 编辑不会影响秀米原稿"),
    ).toBeVisible();
    await expect(page.locator("article img")).toHaveCount(2);
    await page.locator(".node").first().click();
    await page.getByRole("button", { name: "颜色与文字", exact: true }).click();
    await page.getByRole("textbox", { name: "颜色值" }).fill("#e1f0e5");
    await page.getByRole("button", { name: "应用颜色", exact: true }).click();
    await expect(page.locator("article > section")).toHaveCSS(
      "background-color",
      "rgb(225, 240, 229)",
    );
    await page.getByRole("button", { name: "撤销", exact: true }).click();
    await expect(page.locator("article > section")).toHaveCSS(
      "background-color",
      "rgb(249, 245, 225)",
    );
    await page.getByRole("button", { name: "重做", exact: true }).click();
    await expect(page.locator("article > section")).toHaveCSS(
      "background-color",
      "rgb(225, 240, 229)",
    );
    await page.getByRole("button", { name: /组件结构/ }).click();
    await page
      .locator(".node")
      .filter({ hasText: /^推荐语：/ })
      .click();
    await page.getByRole("button", { name: "颜色与文字", exact: true }).click();
    await page
      .getByRole("textbox", { name: "段落文字" })
      .fill("推荐语：读一本好书，遇见新的世界。");
    await page.getByRole("button", { name: "应用文字", exact: true }).click();
    await expect(page.locator("article p")).toHaveText(
      "推荐语：读一本好书，遇见新的世界。",
    );
    await page.screenshot({
      path: "docs/screenshots/properties.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: /组件结构/ }).click();
    await page.locator(".node").filter({ hasText: "书封一" }).click();
    await page
      .getByRole("button", { name: "与另一张图片交换", exact: true })
      .click();
    await page.locator(".node").filter({ hasText: "书封二" }).click();
    await expect(page.locator("article img").first()).toHaveAttribute(
      "alt",
      "书封二",
    );
    await expect(page.locator("article img").first()).toHaveCSS(
      "width",
      "120px",
    );
    await page
      .getByRole("button", { name: "复制到公众号", exact: true })
      .first()
      .click();
    await expect(
      page.getByText(
        "已复制完整富文本，请到公众号正文编辑器 Ctrl+V，并检查手机预览。",
      ),
    ).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "下载 HTML 备份", exact: true })
      .click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("精修图文.html");
    await page.screenshot({
      path: "docs/screenshots/imported-workspace.png",
      fullPage: true,
    });
    await page.route("https://xiumi.us/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<article><p>原生编辑器不再注入助手</p></article>",
      }),
    );
    await page.goto("https://xiumi.us/local-only-check");
    await expect(page.locator("xep-inspector")).toHaveCount(0);
  } finally {
    await context.close();
  }
});
