import { chromium, expect, test } from "@playwright/test";
import path from "node:path";

test("复杂导入布局：弹性横线真实对齐、同级块交换及SVG完整保留", async () => {
  const extension = path.resolve(".output/chrome-mv3");
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    executablePath: process.env.XEP_BROWSER_EXECUTABLE || undefined,
    headless: true,
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
    viewport: { width: 1440, height: 900 },
  });
  try {
    const worker =
      context.serviceWorkers()[0] ||
      (await context.waitForEvent("serviceworker"));
    const page = await context.newPage();
    await page.goto(
      `chrome-extension://${new URL(worker.url()).host}/demo.html`,
    );
    const paper = page.getByTestId("studio-paper");
    await expect(paper.locator("h1")).toBeVisible();
    // Self-authored content; reproduces layout mechanics without private articles.
    const html =
      '<section style="display:flex"><section style="width:100%"><section style="display:flex;transform:rotateX(180deg)"><section id="line" data-label="弹性横线" style="flex:100 100 0%;width:auto;height:30px"><section style="height:8px;background:#e5c598"></section></section><section style="flex:100 100 0%"></section></section><section id="cover" data-label="图书块" style="text-align:center;height:100px;background:#f9f5e1"><section style="display:inline-block;width:48%">自制图书封面</section></section><section id="rec" data-label="推荐语块" style="padding:12px;border:1px solid #9b5414"><svg style="width:0px" viewBox="0 0 1 1"></svg><p>自制推荐语文字。</p><svg width="10" height="10"><rect width="10" height="10" fill="green"/></svg></section></section></section>';
    await page
      .locator("input[type=file]")
      .first()
      .setInputFiles({
        name: "layout.xep.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify({
            format: "xep-studio",
            version: 1,
            title: "布局回归",
            width: 390,
            html,
          }),
        ),
      });
    await page
      .locator(".st-layer-name")
      .filter({ hasText: /^弹性横线$/ })
      .click();
    await page.getByRole("tab", { name: "位置", exact: true }).click();
    const line = paper.locator("#line");
    const before = (await line.boundingBox())!;
    await page.getByRole("button", { name: "组件靠右", exact: true }).click();
    const after = (await line.boundingBox())!;
    expect(after.x).toBeGreaterThan(before.x + 100);
    expect(after.width).toBeCloseTo(before.width, 0);
    expect(after.x + after.width).toBeCloseTo(
      (await line.locator("..").boundingBox())!.x +
        (await line.locator("..").boundingBox())!.width,
      0,
    );
    await expect(
      page.getByRole("button", { name: "组件靠右", exact: true }),
    ).toBeDisabled();
    await page.keyboard.press("Control+Z");
    expect((await line.boundingBox())!.x).toBeCloseTo(before.x, 0);
    await page
      .locator(".st-layer-name")
      .filter({ hasText: /^图书块$/ })
      .click();
    await page.getByRole("tab", { name: "顺序", exact: true }).click();
    const original = await paper.innerHTML(),
      svg = await paper.locator("#rec").innerHTML();
    const cover = paper.locator("#cover");
    const y = (await cover.boundingBox())!.y;
    await page
      .getByRole("button", { name: "向后移动", exact: true })
      .first()
      .click();
    expect(await cover.evaluate((n) => n.previousElementSibling?.id)).toBe(
      "rec",
    );
    expect((await cover.boundingBox())!.y).toBeGreaterThan(y);
    expect(await paper.locator("#rec").innerHTML()).toBe(svg);
    await page.keyboard.press("Control+Z");
    expect(await paper.innerHTML()).toBe(original);
  } finally {
    await context.close();
  }
});
