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
    await page.goto(`chrome-extension://${id}/demo.html`);
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
        contentType: "text/html; charset=utf-8",
        body: '<html><body><div contenteditable="true" style="width:500px;height:500px"><p>隔离夹具：真实站点尚未验证</p><p>第二段</p></div></body></html>',
      }),
    );
    await page.goto("https://xiumi.us/xep-test-fixture");
    await page.getByRole("button", { name: /秀米 Plus/ }).click();
    await expect(page.getByText("结构检查模式 · 修改尚未验证")).toBeVisible();
    await page.locator(".node").first().click();
    await expect(
      page.getByRole("button", { name: "向后移动", exact: true }),
    ).toBeDisabled();
    await page.screenshot({
      path: "docs/screenshots/readonly-fixture.png",
      fullPage: true,
    });
    await page.reload();
    await expect(page.getByRole("button", { name: /秀米 Plus/ })).toHaveCount(
      1,
    );
    await page.bringToFront();
    const opened = await worker.evaluate(
      "chrome.tabs.query({active:true,currentWindow:true}).then(([tab]) => chrome.tabs.sendMessage(tab.id,{type:'xep:open'}))",
    );
    expect(opened).toEqual({ opened: true });
    await expect(
      page.getByRole("complementary", { name: "秀米编辑增强面板" }),
    ).toHaveCount(1);
    await page.route("https://xiumi.us/nested-fixture", (route) =>
      route.fulfill({
        contentType: "text/html; charset=utf-8",
        body: '<main style="width:1200px"><button>素材库（不能被算入文章）</button><article id="paper" style="width:500px"><h1>十本书 · 一次线上共读</h1><section><img alt="第一本书" src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" width="100" height="100"><div contenteditable="true" style="width:420px;min-height:100px"><p>推荐语</p><p>人脑是如何在漫长进化中获得记忆的？</p></div></section><section><h2>第二本书</h2><img alt="第二本书" src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" width="100" height="100"><p>人工智能的底层逻辑</p></section></article></main>',
      }),
    );
    await page.goto("https://xiumi.us/nested-fixture");
    await page.getByRole("button", { name: /秀米 Plus/ }).click();
    await expect(page.locator("#paper")).toHaveCount(1);
    await expect(
      page.locator(".node").filter({ hasText: "第一本书" }),
    ).toHaveCount(1);
    await expect(
      page.locator(".node").filter({ hasText: "第二本书" }),
    ).toHaveCount(3);
    await expect(
      page.getByText("自动找到候选区域，请核对是否包含整篇推文。"),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "点选文章范围", exact: true })
      .click();
    await page.locator("article [contenteditable] p").first().click();
    await expect(
      page.getByText("手动选择的区域；可扩大一层，直到包含推文首尾。"),
    ).toBeVisible();
    await expect(page.locator(".tree-row")).toHaveCount(2);
    await page.getByRole("button", { name: "扩大一层", exact: true }).click();
    await expect(
      page.locator(".node").filter({ hasText: "第一本书" }),
    ).toHaveCount(1);
    await page.getByRole("button", { name: "重新识别", exact: true }).click();
    await expect(
      page.getByText("自动找到候选区域，请核对是否包含整篇推文。"),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "点选文章范围", exact: true })
      .click();
    await page.keyboard.press("Escape");
    await expect(page.locator(".region-picker-hint")).toHaveCount(0);
  } finally {
    await context.close();
  }
});
