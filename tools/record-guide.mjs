// Actual extension walkthrough capture. Build first; uses an isolated browser profile.
import { chromium, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";
const ext = path.resolve(".output/chrome-mv3");
const c = await chromium.launchPersistentContext("", {
  headless: true,
  channel: "chromium",
  executablePath: process.env.XEP_BROWSER_EXECUTABLE || undefined,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  viewport: { width: 1440, height: 900 },
});
try {
  const w = c.serviceWorkers()[0] || (await c.waitForEvent("serviceworker")),
    p = await c.newPage();
  await p.goto(`chrome-extension://${new URL(w.url()).host}/demo.html`);
  const paper = p.getByTestId("studio-paper");
  await expect(paper.locator("h1")).toBeVisible();
  const initial = await paper.innerHTML();
  let name = "",
    index = 0,
    durations = [];
  async function setup(n) {
    name = n;
    index = 0;
    durations = [];
    await fs.mkdir(`.output/guide-frames/${name}`, { recursive: true });
    await p
      .locator("input[type=file]")
      .first()
      .setInputFiles({
        name: "操作演示.xep.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify({
            format: "xep-studio",
            version: 1,
            title: "操作演示",
            width: 390,
            html: initial,
          }),
        ),
      });
    await expect(paper.locator("h1")).toBeVisible();
    await p.evaluate(() => {
      document.getElementById("record-caption")?.remove();
      document.getElementById("record-cursor")?.remove();
      const label = document.createElement("div");
      label.id = "record-caption";
      label.style.cssText =
        "position:fixed;bottom:38px;left:50%;transform:translateX(-50%);z-index:3000;background:#243c35;color:white;padding:10px 20px;border-radius:24px;font:14px Microsoft YaHei;pointer-events:none";
      document.body.append(label);
      const cursor = document.createElement("div");
      cursor.id = "record-cursor";
      cursor.style.cssText =
        "position:fixed;width:16px;height:16px;border:3px solid white;border-radius:50%;background:#217c61;box-shadow:0 0 0 2px #217c61;pointer-events:none;z-index:3001";
      document.body.append(cursor);
    });
  }
  async function caption(text) {
    await p.evaluate(
      (t) => (document.getElementById("record-caption").textContent = t),
      text,
    );
  }
  async function frame(ms = 350) {
    await p.screenshot({
      path: `.output/guide-frames/${name}/${String(index++).padStart(3, "0")}.png`,
    });
    durations.push(ms);
  }
  async function cursor(x, y) {
    await p.mouse.move(x, y);
    await p.evaluate(
      ({ x, y }) => {
        const n = document.getElementById("record-cursor");
        n.style.left = `${x}px`;
        n.style.top = `${y}px`;
      },
      { x, y },
    );
  }
  async function click(locator) {
    const r = await locator.boundingBox();
    await cursor(r.x + r.width / 2, r.y + r.height / 2);
    await frame(300);
    await locator.click();
    await frame(700);
  }
  async function finish() {
    await frame(1200);
    await fs.writeFile(
      `.output/guide-frames/${name}/durations.json`,
      JSON.stringify(durations),
    );
    console.log(`Recorded ${name}: ${index} actual frames`);
  }
  await setup("select");
  await caption("左键长按约半秒，再拖动框选");
  await frame(1000);
  const r = await paper.locator('[data-label="封面卡片"]').boundingBox();
  await cursor(r.x - 7, r.y - 7);
  await p.mouse.down();
  await p.waitForTimeout(520);
  await frame(650);
  for (let i = 1; i <= 8; i++) {
    await cursor(
      r.x - 7 + ((r.width + 14) * i) / 8,
      r.y - 7 + ((r.height + 14) * i) / 8,
    );
    await frame(160);
  }
  await p.mouse.up();
  await expect(p.locator(".st-layer.selected")).toHaveCount(1);
  await expect(p.locator(".st-layer.selected")).toContainText("封面卡片");
  await caption("完整框住父组件：只选最大层，不重复选择子项");
  await finish();
  await setup("group");
  await caption("Ctrl / ⌘ 多选同级组件，然后组合");
  await click(p.locator(".st-layer-name").filter({ hasText: /^沙色背景板$/ }));
  const green = p
    .locator(".st-layer-name")
    .filter({ hasText: /^绿色文字卡片$/ });
  await green.click({ modifiers: ["Control"] });
  await frame(700);
  await click(p.getByRole("button", { name: "组合", exact: true }));
  await expect(paper.locator("[data-xep-group]")).toHaveCount(1);
  await caption("组合后作为一个组件，整体拖动");
  const handle = p.getByRole("button", { name: "拖动所选组件", exact: true });
  const g = await handle.boundingBox();
  await cursor(g.x + g.width / 2, g.y + g.height / 2);
  await p.mouse.down();
  for (let i = 1; i <= 5; i++) {
    await cursor(
      g.x + g.width / 2 + (25 * i) / 5,
      g.y + g.height / 2 + (16 * i) / 5,
    );
    await frame(180);
  }
  await p.mouse.up();
  await frame(800);
  await click(p.getByRole("button", { name: "取消组合", exact: true }));
  await caption("取消组合后，内部组件仍可分别编辑");
  await finish();
  await setup("layers");
  await caption("图层控制遮挡：绿色文字卡片与沙色背景板");
  await click(
    p.locator(".st-layer-name").filter({ hasText: /^绿色文字卡片$/ }),
  );
  await click(p.getByRole("button", { name: "置于底层", exact: true }));
  await expect(paper.locator('[data-label="绿色文字卡片"]')).toHaveCSS(
    "z-index",
    "0",
  );
  await caption("置底后，背景板遮住文字卡片的一部分");
  await frame(1300);
  await click(p.getByRole("button", { name: "置于顶层", exact: true }));
  await caption("置顶后，文字卡片重新显示在背景板上方");
  await finish();
  await setup("text");
  await caption("选中文字，在右侧文字分类修改内容");
  await paper.locator("h1").click();
  await click(p.getByRole("tab", { name: "文字", exact: true }));
  const text = p.getByRole("textbox", { name: "段落文字", exact: true });
  await text.fill("从好想法，开始好文章。");
  await frame(900);
  await click(p.getByRole("button", { name: "应用文字", exact: true }));
  await expect(paper.locator("h1")).toHaveText("从好想法，开始好文章。");
  await click(p.getByRole("tab", { name: "字体与排版", exact: true }));
  await click(p.getByRole("button", { name: "文字居中", exact: true }));
  await caption("内容与排版分别调整，Ctrl+Z 可撤销文章修改");
  await finish();
} finally {
  await c.close();
}
