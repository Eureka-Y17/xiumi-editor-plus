import { chromium, expect, test } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { createBridge } from "../../tools/bridge.mjs";
test("本地编辑台：自由拖拽、所有组件图层、组合、文字、持久化与交付", async () => {
  const extension = path.resolve(".output/chrome-mv3");
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    executablePath: process.env.XEP_BROWSER_EXECUTABLE || undefined,
    headless: true,
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
    viewport: { width: 1540, height: 1100 },
  });
  try {
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent("serviceworker");
    const id = new URL(worker.url()).host,
      page = await context.newPage();
    await page.goto(`chrome-extension://${id}/demo.html`);
    const paper = page.getByTestId("studio-paper");
    await expect(paper.locator("h1")).toContainText("把好想法");
    await page.screenshot({
      path: "docs/screenshots/studio.png",
      fullPage: true,
    });
    const green = paper.locator('[data-label="绿色文字卡片"]');
    await page
      .locator(".st-layer-name")
      .filter({ hasText: /^绿色文字卡片$/ })
      .click();
    await page.getByRole("button", { name: "置于底层", exact: true }).click();
    await expect(green).toHaveCSS("z-index", "0");
    const handle = page.getByRole("button", {
      name: "拖动所选组件",
      exact: true,
    });
    await expect(handle).toBeVisible();
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + 25,
      box.y + box.height / 2 + 20,
      { steps: 6 },
    );
    await page.mouse.up();
    await expect(green).toHaveCSS("left", "110px");
    await expect(green).toHaveCSS("top", "98px");
    await page.screenshot({
      path: "docs/screenshots/studio-layers.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "撤销", exact: true }).click();
    await expect(green).toHaveCSS("left", "85px");
    await page.getByRole("button", { name: "重做", exact: true }).click();
    await expect(green).toHaveCSS("left", "110px");
    // Restore layer and drag, then group two adjacent root components.
    await page.getByRole("button", { name: "撤销", exact: true }).click();
    await page.getByRole("button", { name: "撤销", exact: true }).click();
    await page
      .locator(".st-layer-name")
      .filter({ hasText: /^封面卡片$/ })
      .click();
    await page
      .locator(".st-layer-name")
      .filter({ hasText: /^自由叠放画布$/ })
      .click({
        modifiers: [process.platform === "darwin" ? "Meta" : "Control"],
      });
    await page.getByRole("button", { name: "组合", exact: true }).click();
    await expect(paper.locator(":scope > [data-xep-group]")).toHaveCount(1);
    await page.getByRole("button", { name: "取消组合", exact: true }).click();
    await expect(paper.locator(":scope > [data-xep-group]")).toHaveCount(0);
    // Use a compact document for direct flow dragging and rich-text editing.
    await page
      .locator("input[type=file]")
      .first()
      .setInputFiles({
        name: "test.xep.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify({
            format: "xep-studio",
            version: 1,
            title: "自动化测试图文",
            width: 390,
            html: '<h1>文章标题</h1><p data-label="甲段">第一段文字</p><p data-label="乙段">第二段文字</p>',
          }),
        ),
      });
    await expect(paper.locator("p")).toHaveCount(2);
    await paper.locator("p").last().click();
    await expect(handle).toBeVisible();
    const dragBox = (await handle.boundingBox())!;
    const first = (await paper.locator("p").first().boundingBox())!;
    await page.mouse.move(dragBox.x + 4, dragBox.y + 6);
    await page.mouse.down();
    await page.mouse.move(first.x + 50, first.y + 2, { steps: 8 });
    await page.mouse.up();
    await expect(paper.locator("p").first()).toHaveText("第二段文字");
    await paper.locator("p").first().dblclick();
    await expect(
      page.getByRole("dialog", { name: "编辑文字", exact: true }),
    ).toBeVisible();
    const rich = page.getByRole("textbox", { name: "富文本编辑区域" });
    await rich.fill("这是一段新的文字");
    await rich.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await page.getByRole("button", { name: "加粗", exact: true }).click();
    await page
      .getByRole("button", { name: "应用并返回文章", exact: true })
      .click();
    await expect(paper.locator("p").first()).toHaveText("这是一段新的文字");
    expect(await paper.locator("p").first().innerHTML()).toMatch(
      /bold|700|<b>|strong/,
    );
    await expect(page.getByText("已保存在本机", { exact: true })).toBeVisible();
    await page.reload();
    await expect(paper.locator("p").first()).toHaveText("这是一段新的文字");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "备份工程", exact: true }).click();
    const backup = await downloadPromise;
    expect(backup.suggestedFilename()).toBe("自动化测试图文.xep.json");
    await page
      .getByRole("button", { name: "叠放画布", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "复制到公众号", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("已复制图文");
    expect(await paper.locator("[data-xep-canvas]").count()).toBeGreaterThan(0);
    await page.getByRole("button", { name: "粘贴导入", exact: true }).click();
    await page.getByRole("textbox", { name: "粘贴秀米富文本" }).click();
    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+V" : "Control+V",
    );
    await expect(
      paper.locator('img[src^="data:image/png;base64,"]'),
    ).toHaveCount(1);
    expect(await paper.innerHTML()).not.toContain("position: absolute");
  } finally {
    await context.close();
  }
});

test("本机连接：实际生成二维码、打开预览及模拟公众号草稿同步", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "xep-delivery-test-"));
  const extension = path.join(temp, "extension");
  await fs.cp(path.resolve(".output/chrome-mv3"), extension, {
    recursive: true,
  });
  const manifestPath = path.join(extension, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  manifest.host_permissions = ["http://127.0.0.1/*"];
  await fs.writeFile(manifestPath, JSON.stringify(manifest));
  const bridge = createBridge({
    token: "e2e-pairing-code",
    bases: ["http://127.0.0.1:4318"],
    fetchImpl: (async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      return new Response(
        JSON.stringify(
          path.endsWith("stable_token")
            ? { access_token: "mock-token", expires_in: 7200 }
            : path.endsWith("uploadimg")
              ? { url: "https://mmbiz.qpic.cn/mock.png" }
              : { media_id: "mock-draft-id" },
        ),
        { headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch,
  });
  await new Promise<void>((resolve) =>
    bridge.server.listen(4318, "127.0.0.1", resolve),
  );
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
    await expect(page.getByTestId("studio-paper")).toBeVisible();
    await page.getByRole("button", { name: "连接", exact: true }).click();
    await page
      .getByRole("textbox", { name: "本机配对码" })
      .fill("e2e-pairing-code");
    await page
      .getByRole("button", { name: "连接本地服务", exact: true })
      .click();
    await expect(
      page.getByText("已连接本机服务。", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("textbox", { name: "公众号 AppID" })
      .fill("test-appid");
    await page
      .getByRole("textbox", { name: "公众号 AppSecret" })
      .fill("not-a-real-secret");
    await page
      .getByRole("button", { name: "设置公众号连接", exact: true })
      .click();
    await page.getByRole("textbox", { name: "封面素材 ID" }).fill("mock-cover");
    await page
      .getByRole("button", { name: "一键同步到公众号草稿箱", exact: true })
      .click();
    await expect(page.getByRole("status").last()).toContainText(
      "已新建公众号草稿",
    );
    await page.getByRole("button", { name: "手机预览", exact: true }).click();
    await page
      .getByRole("button", { name: "生成预览二维码", exact: true })
      .click();
    await expect(page.getByAltText("手机预览二维码")).toHaveAttribute(
      "src",
      /^data:image\/png/,
    );
    const url = await page
      .getByRole("link", { name: "打开预览页面", exact: true })
      .getAttribute("href");
    const response = await fetch(url!);
    expect(await response.text()).toContain("把好想法");
    await page.screenshot({
      path: "docs/screenshots/studio-qr.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "撤销此预览", exact: true }).click();
    expect((await fetch(url!)).status).toBe(404);
  } finally {
    await context.close();
    await bridge.close();
    await fs.rm(temp, { recursive: true, force: true });
  }
});
