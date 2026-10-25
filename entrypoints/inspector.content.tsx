import React from "react";
import { createRoot } from "react-dom/client";
import { EditorAdapter } from "../src/adapter";
import { Panel } from "../src/Panel";
import css from "../src/panel.css?inline";
import { browser } from "wxt/browser";
export default defineContentScript({
  matches: ["https://xiumi.us/*", "https://*.xiumi.us/*"],
  main(ctx) {
    if (document.querySelector("xep-inspector")) return;
    const host = document.createElement("xep-inspector");
    host.style.cssText =
      "position:fixed;right:18px;top:86px;z-index:2147483646;";
    const shadow = host.attachShadow({ mode: "open" }),
      style = document.createElement("style");
    style.textContent = css;
    shadow.append(style);
    const mount = document.createElement("div");
    shadow.append(mount);
    document.body.append(host);
    const app = createRoot(mount);
    function launch() {
      mount.style.height = "";
      app.render(
        <button className="xep-launcher" onClick={open}>
          ✧ 秀米 Plus · 查看结构
        </button>,
      );
    }
    function open() {
      const editors = Array.from(
        document.querySelectorAll<HTMLElement>('[contenteditable="true"]'),
      )
        .filter(
          (el) =>
            !el.parentElement?.closest('[contenteditable="true"]') &&
            el.getBoundingClientRect().width > 200 &&
            el.getBoundingClientRect().height > 50,
        )
        .sort(
          (a, b) =>
            b.getBoundingClientRect().height - a.getBoundingClientRect().height,
        );
      const editor = editors[0];
      if (!editor) {
        app.render(
          <div className="xep-panel" style={{ height: "auto", padding: 22 }}>
            <strong>还未找到可检查的图文区域</strong>
            <p>
              请进入秀米图文编辑页后重试。特殊编辑器或 iframe 内的内容暂不支持。
            </p>
            <button onClick={launch}>返回</button>
          </div>,
        );
        return;
      }
      mount.style.height = "min(850px, calc(100vh - 105px))";
      app.render(
        <Panel
          adapter={new EditorAdapter(editor, "xiumi-readonly")}
          onClose={launch}
        />,
      );
    }
    launch();
    const onMessage = (message: unknown) => {
      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        message.type === "xep:open"
      ) {
        open();
        return Promise.resolve({ opened: true });
      }
    };
    browser.runtime.onMessage.addListener(onMessage);
    ctx.onInvalidated(() => {
      browser.runtime.onMessage.removeListener(onMessage);
      app.unmount();
      host.remove();
    });
  },
});
