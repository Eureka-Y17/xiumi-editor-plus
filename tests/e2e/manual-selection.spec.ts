import { chromium, expect, test } from "@playwright/test";
import path from "node:path";
test("长按框选最大层、取消与短拖兼容，离线手册及连接引导", async () => {
  const ext = path.resolve(".output/chrome-mv3");
  const c = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    executablePath: process.env.XEP_BROWSER_EXECUTABLE || undefined,
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
    viewport: { width: 1540, height: 1100 },
  });
  try {
    const w = c.serviceWorkers()[0] || (await c.waitForEvent("serviceworker"));
    const p = await c.newPage();
    await p.goto(`chrome-extension://${new URL(w.url()).host}/demo.html`);
    const paper = p.getByTestId("studio-paper");
    const card = paper.locator('[data-label="封面卡片"]');
    await expect(card).toBeVisible();
    const r = (await card.boundingBox())!;
    const original = await paper.innerHTML();
    await p.mouse.move(r.x - 6, r.y - 6);
    await p.mouse.down();
    await p.waitForTimeout(520);
    await expect(p.getByTestId("selection-marquee")).toBeVisible();
    await p.mouse.move(r.x + r.width + 6, r.y + r.height + 6, { steps: 8 });
    await p.mouse.up();
    await expect(p.locator(".st-layer.selected")).toHaveCount(1);
    await expect(p.locator(".st-layer.selected")).toContainText("封面卡片");
    expect(await paper.innerHTML()).toBe(original);
    await p.mouse.move(r.x + r.width + 6, r.y + r.height + 6);
    await p.mouse.down();
    await p.waitForTimeout(520);
    await p.mouse.move(r.x - 6, r.y - 6, { steps: 8 });
    await p.mouse.up();
    await expect(p.locator(".st-layer.selected")).toHaveCount(1);
    await p.mouse.move(r.x - 6, r.y - 6);
    await p.mouse.down();
    await p.waitForTimeout(520);
    await p.mouse.move(r.x + 50, r.y + 50);
    await p.keyboard.press("Escape");
    await p.mouse.up();
    await expect(p.getByTestId("selection-marquee")).toHaveCount(0);
    await expect(p.locator(".st-layer.selected")).toContainText("封面卡片");
    expect(await paper.innerHTML()).toBe(original);
    await card.locator("h1").click();
    await p.keyboard.down("Control");
    await p.mouse.move(r.x - 6, r.y - 6);
    await p.mouse.down();
    await p.waitForTimeout(520);
    await p.mouse.move(r.x + r.width + 6, r.y + r.height + 6, { steps: 8 });
    await p.mouse.up();
    await expect(p.locator(".st-layer.selected")).toHaveCount(1);
    await expect(p.locator(".st-layer.selected")).toContainText("封面卡片");
    const canvas = (await paper
      .locator('[data-label="自由叠放画布"]')
      .boundingBox())!;
    await p.mouse.move(canvas.x - 6, canvas.y - 6);
    await p.mouse.down();
    await p.waitForTimeout(520);
    await p.mouse.move(
      canvas.x + canvas.width + 6,
      canvas.y + canvas.height + 6,
      { steps: 8 },
    );
    await p.mouse.up();
    await p.keyboard.up("Control");
    await expect(p.locator(".st-layer.selected")).toHaveCount(2);
    expect(await paper.innerHTML()).toBe(original);
    await p.getByRole("button", { name: "操作手册", exact: true }).click();
    const manual = p.getByRole("dialog", { name: "操作手册", exact: true });
    await expect(manual).toBeVisible();
    await p.getByRole("button", { name: /选择与长按框选/ }).click();
    await expect(manual).toContainText("0.45 秒");
    await p.getByRole("button", { name: "播放动图", exact: true }).click();
    await expect(manual.locator("img")).toHaveJSProperty("naturalWidth", 1200);
    await p.getByRole("button", { name: "暂停动图", exact: true }).click();
    await expect(manual.locator("img")).toHaveAttribute(
      "src",
      "/guide/select.png",
    );
    await p.getByRole("button", { name: /第一次连接与手机二维码/ }).click();
    await expect(manual).toContainText("start-preview.cmd");
    await p.keyboard.press("Escape");
    await expect(manual).toHaveCount(0);
    expect(await paper.innerHTML()).toBe(original);
    await p.getByRole("button", { name: "连接", exact: true }).click();
    await expect(p.getByRole("dialog", { name: "预览与同步" })).toContainText(
      "第一次使用手机二维码",
    );
    await expect(p.getByRole("dialog", { name: "预览与同步" })).toContainText(
      "双击启动",
    );
    await expect(
      p
        .getByRole("dialog", { name: "预览与同步" })
        .getByRole("link", { name: /下载本机服务包/ }),
    ).toHaveAttribute("href", /releases/);
    await p.screenshot({
      path: "docs/screenshots/studio-connection-guide.png",
    });
    await p.getByRole("button", { name: "关闭预览", exact: true }).click();
    await p.getByRole("button", { name: "操作手册", exact: true }).click();
    await p.getByRole("button", { name: /排序、拖动与组合/ }).click();
    await p.screenshot({ path: "docs/screenshots/studio-manual.png" });
  } finally {
    await c.close();
  }
});
