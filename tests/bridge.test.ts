// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import { createBridge, publicIPv4 } from "../tools/bridge.mjs";
let bridge: ReturnType<typeof createBridge> | undefined;
afterEach(async () => {
  if (bridge) await bridge.close();
  bridge = undefined;
});
async function start(options: Parameters<typeof createBridge>[0] = {}) {
  bridge = createBridge({ token: "paired-test-token", ...options });
  await new Promise<void>((r) => bridge!.server.listen(0, "127.0.0.1", r));
  const address = bridge.server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  return {
    base,
    api: async (path: string, body?: unknown, auth = "paired-test-token") =>
      fetch(base + path, {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${auth}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
  };
}
it("服务拒绝未配对请求与恶意网页来源，Unicode配对码不会令进程崩溃", async () => {
  const { base, api } = await start();
  expect((await api("/status", undefined, "é".repeat(17))).status).toBe(401);
  expect(
    (
      await fetch(base + "/status", {
        headers: {
          Origin: "https://evil.test",
          Authorization: "Bearer paired-test-token",
        },
      })
    ).status,
  ).toBe(403);
  expect((await api("/status")).status).toBe(200);
});
it("预览包含清理后的文章、禁止脚本的CSP，可撤销且不会暴露配对码", async () => {
  const { base, api } = await start();
  const created = await (
    await api("/previews", {
      html: '<h1>标题</h1><script>alert(1)</script><img onerror="bad()" src="https://example.com/a.png">',
    })
  ).json();
  const page = await fetch(base + new URL(created.url).pathname);
  const html = await page.text();
  expect(html).toContain("标题");
  expect(html).not.toMatch(/script|onerror|paired-test-token/);
  expect(page.headers.get("content-security-policy")).toContain(
    "default-src 'none'",
  );
  await api("/previews/revoke", { url: created.url });
  expect((await fetch(base + new URL(created.url).pathname)).status).toBe(404);
});
it("二维码预览按时失效，不接受任意外部预览地址", async () => {
  let time = 0;
  const { base, api } = await start({
    now: () => time,
    bases: ["http://192.168.1.2:4318"],
  });
  const created = await (
    await api("/previews", { html: "<p>正文</p>", base: "https://evil.test" })
  ).json();
  expect(created.url).toMatch(/^http:\/\/192.168.1.2:4318\/p\/[a-f0-9]{48}$/);
  time = 3_600_001;
  expect((await fetch(base + new URL(created.url).pathname)).status).toBe(404);
});
it("图片下载只接受公共IPv4，拒绝内网与环回", () => {
  for (const ip of [
    "127.0.0.1",
    "10.1.2.3",
    "192.168.1.1",
    "172.20.0.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
  ])
    expect(publicIPv4(ip)).toBe(false);
  expect(publicIPv4("8.8.8.8")).toBe(true);
});
it("同步未配置公众号时给出错误，不虚报成功", async () => {
  const { api } = await start({ appid: "", secret: "" });
  const response = await api("/wechat/drafts", {
    title: "测试",
    html: "<p>正文</p>",
    cover: "cover",
  });
  expect(response.status).toBe(400);
  expect((await response.json()).error).toContain("设置公众号");
});
it("新建草稿先换取图片URL，相同内容重复点击复用结果，不发布", async () => {
  const calls: { path: string; body: unknown }[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    const body =
      typeof init?.body === "string" ? JSON.parse(init.body) : init?.body;
    calls.push({ path, body });
    const result = path.endsWith("stable_token")
      ? { access_token: "test-token", expires_in: 7200 }
      : path.endsWith("uploadimg")
        ? { url: "https://mmbiz.qpic.cn/test.png" }
        : { media_id: "draft-one" };
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  const { api } = await start({
    appid: "test-app",
    secret: "test-secret",
    fetchImpl,
  });
  const body = {
    title: "测试图文",
    html: '<p>正文</p><img src="data:image/png;base64,aGVsbG8=">',
    cover: "cover-id",
  };
  expect((await (await api("/wechat/drafts", body)).json()).media_id).toBe(
    "draft-one",
  );
  expect((await (await api("/wechat/drafts", body)).json()).media_id).toBe(
    "draft-one",
  );
  expect(calls.filter((c) => c.path.endsWith("draft/add"))).toHaveLength(1);
  expect(JSON.stringify(calls.at(-1)?.body)).toContain(
    "https://mmbiz.qpic.cn/test.png",
  );
  expect(calls.some((c) => /publish|mass|send/.test(c.path))).toBe(false);
});
it("未转换的绝对定位与SVG拒绝同步，微信错误不伪装为草稿成功", async () => {
  const { api } = await start({
    appid: "test",
    secret: "testsecret",
    fetchImpl: (async () =>
      new Response(
        JSON.stringify({ errcode: 40164, errmsg: "invalid ip" }),
      )) as typeof fetch,
  });
  const bad = await api("/wechat/drafts", {
    title: "测试",
    html: '<p style="position:absolute">文字</p>',
    cover: "cover",
  });
  expect((await bad.json()).error).toContain("自由定位");
  const failed = await api("/wechat/drafts", {
    title: "测试",
    html: "<p>文字</p>",
    cover: "cover",
  });
  expect((await failed.json()).error).toContain("40164");
});
