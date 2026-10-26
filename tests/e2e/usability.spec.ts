import { chromium, expect, test } from "@playwright/test";
import path from "node:path";
test("截图回归：横排模板后插、阅读顺序、树定位、对齐、经典色与分类撤销", async () => {
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
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent("serviceworker");
    const id = new URL(worker.url()).host,
      page = await context.newPage();
    await page.goto(`chrome-extension://${id}/demo.html`);
    const paper = page.getByTestId("studio-paper");
    await expect(paper.locator("h1")).toBeVisible();
    const leading = Array.from(
      { length: 40 },
      (_, i) =>
        `<p data-label="前置段落 ${i + 1}">这是一段书单前言，序号 ${i + 1}。</p>`,
    ).join("");
    const html =
      leading +
      '<section id="book" data-label="书单容器" style="padding:16px;background:#f9f5e1"><section id="cover" data-label="图书封面" style="height:120px;width:140px;background:#ddbc91;margin:0 auto 20px;text-align:center">BOOK</section><section id="row" data-label="斜角模板行" style="display:flex;width:100%"><section id="rec" data-label="推荐语框" style="width:100%;border:1px solid #9b5414;padding:12px"><h3>推荐语</h3><p>人脑是如何在漫长进化中获得记忆、规划和抽象思维的？机器的聪明与人的智能究竟有多相似？这段正文不应因为插入文字而变得狭窄。</p></section><span style="width:0;flex:0 0 0"></span></section><section id="narrow" data-label="窄卡片" style="width:140px;margin:12px 0;background:#edf4ef;padding:8px"><p data-label="卡片文字">卡片文字</p></section></section>';
    await page
      .locator("input[type=file]")
      .first()
      .setInputFiles({
        name: "regression.xep.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify({
            format: "xep-studio",
            version: 1,
            title: "推荐语插入回归",
            width: 390,
            html,
          }),
        ),
      });
    await expect(paper.locator("#rec")).toBeAttached();
    await page
      .getByRole("button", { name: "折叠书单容器", exact: true })
      .evaluate((node) => (node as HTMLElement).click());
    await page.locator(".st-tree").evaluate((node) => (node.scrollTop = 0));
    const rec = paper.locator("#rec");
    await rec.click({ position: { x: 5, y: 5 } });
    const selected = page.locator(".st-layer.selected");
    await expect(selected).toContainText("推荐语框");
    const viewport = await page.locator(".st-tree").boundingBox(),
      row = await selected.boundingBox();
    expect(row!.y).toBeGreaterThanOrEqual(viewport!.y - 1);
    expect(row!.y + row!.height).toBeLessThanOrEqual(
      viewport!.y + viewport!.height + 1,
    );
    expect(
      await page.locator(".st-tree").evaluate((node) => node.scrollTop),
    ).toBeGreaterThan(0);
    await expect(
      page.getByRole("button", { name: "上移一层", exact: true }),
    ).toBeDisabled();
    await expect(page.getByTestId("layer-explanation")).toContainText(
      "普通图文没有重叠",
    );
    const width = (await rec.boundingBox())!.width;
    await page
      .getByRole("button", { name: "文字", exact: true })
      .first()
      .click();
    const newText = paper.getByText("在这里写下新的段落。", { exact: true });
    await expect(newText).toHaveCount(1);
    const recAfter = (await rec.boundingBox())!,
      textBox = (await newText.boundingBox())!;
    expect(recAfter.width).toBeCloseTo(width, 0);
    expect(textBox.y).toBeGreaterThanOrEqual(recAfter.y + recAfter.height - 1);
    expect(
      await newText.evaluate((node) => node.previousElementSibling?.id),
    ).toBe("row");
    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+Z" : "Control+Z",
    );
    await expect(newText).toHaveCount(0);
    await expect(rec).toHaveCSS("border-top-width", "1px");
    await rec.click({ position: { x: 5, y: 5 } });
    await page
      .getByRole("button", { name: "向前移动", exact: true })
      .first()
      .click();
    expect(
      await paper
        .locator("#book")
        .evaluate((node) => node.firstElementChild?.id),
    ).toBe("row");
    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+Z" : "Control+Z",
    );
    expect(
      await paper
        .locator("#book")
        .evaluate((node) => node.firstElementChild?.id),
    ).toBe("cover");
    await rec.click({ position: { x: 5, y: 5 } });
    await page.getByRole("tab", { name: "结构", exact: true }).click();
    await page.getByRole("button", { name: "后插空行", exact: true }).click();
    expect(
      await paper
        .locator('[data-label="空行"]')
        .evaluate((node) => node.previousElementSibling?.id),
    ).toBe("row");
    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+Z" : "Control+Z",
    );
    const narrow = paper.locator("#narrow");
    await narrow.click({ position: { x: 4, y: 4 } });
    await page.getByRole("tab", { name: "位置", exact: true }).click();
    const originalX = (await narrow.boundingBox())!.x;
    await expect(
      page.getByRole("button", { name: "组件靠右", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "组件靠右", exact: true }).click();
    expect((await narrow.boundingBox())!.x).toBeGreaterThan(originalX + 50);
    // A focused but unchanged property input must not swallow article undo.
    await page.getByRole("textbox", { name: "组件宽度", exact: true }).focus();
    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+Z" : "Control+Z",
    );
    expect((await narrow.boundingBox())!.x).toBeCloseTo(originalX, 0);
    await page.getByRole("tab", { name: "色彩", exact: true }).click();
    await expect(page.getByRole("button", { name: /^经典色 / })).toHaveCount(8);
    await page
      .getByRole("button", { name: "经典色 浅杏 #e5c598", exact: true })
      .click();
    await expect(narrow).toHaveCSS("background-color", "rgb(229, 197, 152)");
    await page.getByRole("textbox", { name: "颜色值", exact: true }).focus();
    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+Z" : "Control+Z",
    );
    await expect(narrow).toHaveCSS("background-color", "rgb(237, 244, 239)");
    for (const tab of ["顺序", "位置", "布局", "色彩", "链接", "结构"]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      const sizes = await page.locator(".st-prop-page").evaluate((node) => ({
        height: node.clientHeight,
        scroll: node.scrollHeight,
      }));
      expect(
        sizes.scroll,
        `${tab} should fit without scrolling`,
      ).toBeLessThanOrEqual(sizes.height + 1);
    }
    await narrow.locator("p").click();
    await page.getByRole("tab", { name: "文字", exact: true }).click();
    for (const sub of ["编辑内容", "字体与排版"]) {
      await page.getByRole("tab", { name: sub, exact: true }).click();
      expect(
        await page
          .locator(".st-prop-page")
          .evaluate((node) => node.scrollHeight <= node.clientHeight + 1),
      ).toBe(true);
    }
    await page.getByRole("button", { name: "文字居中", exact: true }).click();
    await expect(narrow.locator("p")).toHaveCSS("text-align", "center");
    await page.getByRole("tab", { name: "编辑内容", exact: true }).click();
    const draft = page.getByRole("textbox", { name: "段落文字", exact: true });
    await draft.focus();
    await draft.press("End");
    await draft.pressSequentially("未应用");
    const before = await paper.innerHTML();
    await draft.press(process.platform === "darwin" ? "Meta+Z" : "Control+Z");
    expect(await paper.innerHTML()).toBe(before);
    await page.getByRole("tab", { name: "色彩", exact: true }).click();
    await page.screenshot({
      path: "docs/screenshots/studio-properties-tabs.png",
      fullPage: true,
    });
  } finally {
    await context.close();
  }
});
