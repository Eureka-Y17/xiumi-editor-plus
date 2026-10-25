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
    await page.route("https://xiumi.us/**", (route) =>
      route.fulfill({
        contentType: "text/html",
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
    const opened = await worker.evaluate("chrome.tabs.query({active:true,currentWindow:true}).then(([tab]) => chrome.tabs.sendMessage(tab.id,{type:'xep:open'}))");
    expect(opened).toEqual({ opened: true });
    await expect(page.getByRole('complementary', { name: '秀米编辑增强面板' })).toHaveCount(1);
  } finally {
    await context.close();
  }
});
