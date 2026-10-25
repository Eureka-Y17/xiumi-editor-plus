import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import { networkInterfaces } from "node:os";
import { randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import createDOMPurify from "dompurify";
const window = new JSDOM("").window;
const purify = createDOMPurify(window);
const apiBase = "https://api.weixin.qq.com/cgi-bin/";
const hour = 3600_000;
const plain = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
const json = (res, code, data) => {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
};
export function publicIPv4(ip) {
  const parts = ip.split(".").map(Number);
  return (
    parts.length === 4 &&
    parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) &&
    ![0, 10, 127].includes(parts[0]) &&
    !(parts[0] === 169 && parts[1] === 254) &&
    !(parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) &&
    !(
      parts[0] === 192 &&
      (parts[1] === 168 || parts[1] === 0 || parts[1] === 88)
    ) &&
    !(parts[0] === 198 && parts[1] === 51 && parts[2] === 100) &&
    !(parts[0] === 203 && parts[1] === 0 && parts[2] === 113) &&
    !(parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) &&
    !(parts[0] === 198 && [18, 19].includes(parts[1])) &&
    parts[0] < 224
  );
}
export function imageBytes(src) {
  const match = /^data:image\/(png|jpeg|gif);base64,([A-Za-z0-9+/=\s]+)$/.exec(
    src,
  );
  if (!match)
    throw new Error("正文图片仅支持 PNG/JPEG/GIF；请先转为兼容图片。");
  const data = Buffer.from(match[2], "base64");
  if (data.length > 10_000_000)
    throw new Error("图片超过 10 MB，请压缩后重试。");
  if (!data.length) throw new Error("图片为空");
  return {
    data,
    mime: `image/${match[1]}`,
    name: `image.${match[1] === "jpeg" ? "jpg" : match[1]}`,
  };
}
export async function remoteImage(src, redirects = 0) {
  const url = new URL(src);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    redirects > 3
  )
    throw new Error("图片必须来自公共 HTTPS 地址。");
  return await new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        family: 4,
        autoSelectFamily: false,
        timeout: 15_000,
        lookup(host, options, callback) {
          dns.lookup(host, { family: 4 }, (err, address, family) => {
            if (err) return callback(err);
            if (!publicIPv4(address))
              return callback(
                new Error("拒绝访问本机、内网或保留地址的图片。"),
              );
            callback(null, address, family);
          });
        },
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          res.resume();
          return remoteImage(
            new URL(res.headers.location ?? "", url).href,
            redirects + 1,
          ).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error("图片下载失败，请检查链接或防盗链。"));
        }
        const mime = (res.headers["content-type"] ?? "").split(";")[0];
        if (!["image/png", "image/jpeg", "image/gif"].includes(mime)) {
          res.resume();
          return reject(
            new Error("公众号图片仅支持 PNG/JPEG/GIF，请在本地转换后再同步。"),
          );
        }
        const chunks = [];
        let size = 0;
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > 10_000_000) {
            req.destroy();
            reject(new Error("图片超过 10 MB"));
          } else chunks.push(chunk);
        });
        res.on("end", () =>
          resolve({
            data: Buffer.concat(chunks),
            mime,
            name: `image.${mime === "image/jpeg" ? "jpg" : mime.slice(6)}`,
          }),
        );
        res.on("error", () => reject(new Error("图片读取中断")));
      },
    );
    req.on("timeout", () => req.destroy(new Error("图片读取超时")));
    req.on("error", () =>
      reject(new Error("无法读取图片，请检查链接和网络。")),
    );
  });
}
function clean(html) {
  if (typeof html !== "string" || html.length > 22_000_000)
    throw new Error("内容为空或超过 22 MB");
  return purify.sanitize(html, {
    FORBID_TAGS: [
      "script",
      "style",
      "link",
      "iframe",
      "form",
      "input",
      "button",
      "textarea",
      "object",
      "embed",
      "base",
      "foreignObject",
    ],
    FORBID_ATTR: ["autofocus", "contenteditable"],
  });
}
export function createBridge({
  token = randomBytes(24).toString("hex"),
  bases = ["http://127.0.0.1:4318"],
  fetchImpl = fetch,
  imageLoader = remoteImage,
  now = Date.now,
  appid = process.env.WECHAT_APP_ID ?? "",
  secret = process.env.WECHAT_APP_SECRET ?? "",
} = {}) {
  const previews = new Map(),
    jobs = new Map();
  let credentials = { appid, secret },
    access = null;
  async function wx(path, body, tokenValue) {
    let response;
    try {
      response = await fetchImpl(
        apiBase +
          path +
          (tokenValue
            ? `${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(tokenValue)}`
            : ""),
        {
          method: "POST",
          headers:
            body instanceof FormData
              ? {}
              : { "Content-Type": "application/json" },
          body: body instanceof FormData ? body : JSON.stringify(body),
          signal: AbortSignal.timeout(25_000),
        },
      );
    } catch {
      throw new Error(
        "微信接口请求超时或网络中断；若正在新建草稿，请先查看草稿箱，避免重复提交。",
      );
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("微信接口返回异常，请先核对草稿箱再重试。");
    }
    if (!response.ok || data.errcode)
      throw new Error(
        `微信接口错误 ${Number(data.errcode) || response.status}：请检查账号接口权限、IP 白名单、封面和图片格式。`,
      );
    return data;
  }
  async function accessToken() {
    if (access && access.until > now()) return access.value;
    if (!credentials.appid || !credentials.secret)
      throw new Error("请先在连接面板设置公众号 AppID 和 AppSecret。");
    const result = await wx("stable_token", {
      grant_type: "client_credential",
      appid: credentials.appid,
      secret: credentials.secret,
      force_refresh: false,
    });
    if (!result.access_token) throw new Error("微信未返回调用凭据");
    access = {
      value: result.access_token,
      until: now() + (Number(result.expires_in) || 7200) * 1000 - 120_000,
    };
    return access.value;
  }
  async function upload(src, cover = false) {
    const image = src.startsWith("data:")
      ? imageBytes(src)
      : await imageLoader(src);
    const body = new FormData();
    body.append(
      "media",
      new Blob([image.data], { type: image.mime }),
      image.name,
    );
    return await wx(
      cover ? "material/add_material?type=image" : "media/uploadimg",
      body,
      await accessToken(),
    );
  }
  async function draft(body) {
    if (
      typeof body.title !== "string" ||
      !body.title.trim() ||
      [...body.title].length > 32
    )
      throw new Error("公众号标题需要 1–32 个字符，请先调整文章标题。");
    if (typeof body.cover !== "string" || !body.cover.trim())
      throw new Error("需要封面永久素材 ID 或封面 HTTPS 图片地址。");
    const html = clean(body.html),
      doc = new JSDOM(html).window.document;
    try {
      if (
        doc.querySelector("svg,video,audio,canvas") ||
        Array.from(doc.querySelectorAll("[style]")).some((el) =>
          /position\s*:\s*(absolute|fixed)|background(?:-image)?\s*:[^;]*url\(/i.test(
            el.getAttribute("style") ?? "",
          ),
        )
      )
        throw new Error(
          "正文仍有自由定位、SVG/媒体或背景图；请先在编辑台转换为图片再同步。",
        );
      const digest = createHash("sha256")
        .update(
          JSON.stringify([
            credentials.appid,
            body.title,
            body.author,
            body.cover,
            html,
          ]),
        )
        .digest("hex");
      if (jobs.has(digest)) return await jobs.get(digest);
      const work = (async () => {
        const images = new Map();
        for (const img of doc.querySelectorAll("img")) {
          const src = img.getAttribute("src") ?? "";
          if (!src) throw new Error("正文含无地址图片，请删除或替换。");
          if (!images.has(src)) {
            const result = await upload(src);
            if (!result.url) throw new Error("微信未返回正文图片地址");
            images.set(src, result.url);
          }
          img.src = images.get(src);
          img.removeAttribute("srcset");
          img.removeAttribute("sizes");
        }
        let cover = body.cover.trim();
        if (/^https:\/\//i.test(cover) || cover.startsWith("data:")) {
          const result = await upload(cover, true);
          if (!result.media_id) throw new Error("封面上传失败");
          cover = result.media_id;
        }
        const content = doc.body.innerHTML;
        if (content.length > 20000 || Buffer.byteLength(content) > 1_000_000)
          throw new Error("公众号正文过长，请压缩样式或分篇同步。");
        const tokenValue = await accessToken();
        const result = await wx(
          "draft/add",
          {
            articles: [
              {
                article_type: "news",
                title: body.title.trim(),
                author: plain(body.author, 16),
                content,
                thumb_media_id: cover,
                need_open_comment: 0,
                only_fans_can_comment: 0,
              },
            ],
          },
          tokenValue,
        );
        if (!result.media_id)
          throw new Error("微信未返回草稿素材 ID，请先查看草稿箱。");
        return { media_id: result.media_id };
      })();
      jobs.set(digest, work);
      if (jobs.size > 50) jobs.delete(jobs.keys().next().value);
      return await work;
    } finally {
      doc.defaultView.close();
    }
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    const origin = req.headers.origin ?? "";
    if (origin && !/^chrome-extension:\/\/[a-p]{32}$/.test(origin)) {
      return json(res, 403, { error: "只接受浏览器扩展的配对连接。" });
    }
    if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    if (req.method === "OPTIONS") {
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type",
      );
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.writeHead(204);
      res.end();
      return;
    }
    const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    if (req.method === "GET" && /^\/p\/[a-f0-9]{48}$/.test(path)) {
      const id = path.slice(3),
        item = previews.get(id);
      if (!item || item.expires <= now()) {
        previews.delete(id);
        return json(res, 404, { error: "预览已过期或被撤销。" });
      }
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy":
          "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; font-src https: data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      });
      res.end(
        `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>图文预览</title><body style="margin:0;background:white">${item.html}</body></html>`,
      );
      return;
    }
    const provided = Buffer.from(
        (req.headers.authorization ?? "").replace(/^Bearer /, ""),
      ),
      expected = Buffer.from(token);
    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    )
      return json(res, 401, { error: "配对码不正确或本机服务已重启。" });
    try {
      if (req.method === "GET" && path === "/status")
        return json(res, 200, {
          wechat: !!(credentials.appid && credentials.secret),
          previewBases: bases,
          version: "0.4.0",
        });
      if (req.method !== "POST") return json(res, 404, { error: "未知入口" });
      let bytes = 0;
      const chunks = [];
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 25_000_000) {
          json(res, 413, { error: "文章超过 25 MB" });
          return;
        }
        chunks.push(chunk);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (path === "/config") {
        if (
          !/^[\w-]{4,100}$/.test(body.appid ?? "") ||
          typeof body.secret !== "string" ||
          body.secret.length < 8 ||
          body.secret.length > 256
        )
          throw new Error("公众号配置格式不正确");
        credentials = { appid: body.appid, secret: body.secret };
        access = null;
        jobs.clear();
        return json(res, 200, { configured: true });
      }
      if (path === "/previews") {
        const base = bases.includes(body.base) ? body.base : bases[0],
          html = clean(body.html);
        for (const [id, item] of previews)
          if (item.expires <= now()) previews.delete(id);
        while (
          previews.size >= 10 ||
          Array.from(previews.values()).reduce(
            (n, item) => n + item.html.length,
            0,
          ) +
            html.length >
            50_000_000
        )
          previews.delete(previews.keys().next().value);
        const id = randomBytes(24).toString("hex");
        previews.set(id, { html, expires: now() + hour });
        return json(res, 200, {
          url: `${base}/p/${id}`,
          expires: now() + hour,
        });
      }
      if (path === "/previews/revoke") {
        const url = new URL(body.url);
        const id = url.pathname.slice(3);
        previews.delete(id);
        return json(res, 200, { revoked: true });
      }
      if (path === "/wechat/drafts") return json(res, 200, await draft(body));
      return json(res, 404, { error: "未知入口" });
    } catch (e) {
      json(res, 400, {
        error:
          e instanceof SyntaxError
            ? "请求内容不是有效 JSON"
            : (e.message ?? "操作失败"),
      });
    }
  });
  return {
    server,
    token,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const lan = process.argv.includes("--lan"),
    port = 4318;
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter((n) => n && n.family === "IPv4" && !n.internal)
    .map((n) => n.address);
  const bases = lan
    ? ips.map((ip) => `http://${ip}:${port}`)
    : [`http://127.0.0.1:${port}`];
  if (!bases.length) bases.push(`http://127.0.0.1:${port}`);
  const bridge = createBridge({ bases });
  bridge.server.on("error", () => {
    process.stderr.write("服务启动失败：4318 端口可能已被占用。\n");
    process.exitCode = 1;
  });
  bridge.server.listen(port, lan ? "0.0.0.0" : "127.0.0.1", () => {
    process.stdout.write(
      `秀米 Plus 本机预览与草稿服务\n配对码：${bridge.token}\n${lan ? "手机与电脑需连接同一 Wi-Fi；请在编辑台选择手机可访问的地址。" : "当前仅本机访问。手机预览请加 --lan 启动。"}\n地址：${bases.join("、")}\n凭据、预览和同步记录仅保存在内存，关闭服务后清除。\n`,
    );
  });
}
