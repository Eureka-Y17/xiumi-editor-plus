import React from "react";
import { createRoot } from "react-dom/client";
import { EditorAdapter } from "../src/adapter";
import { Panel } from "../src/Panel";
import css from "../src/panel.css?inline";
import { browser } from "wxt/browser";
import { discoverRegion, isArticleRegion } from "../src/discovery";
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
    const openWorkspace = () => {
      void browser.runtime.sendMessage({ type: "xep:workspace" });
    };
    let cancelPicker: (() => void) | undefined;
    function launch() {
      cancelPicker?.();
      mount.style.height = "";
      app.render(
        <button className="xep-launcher" onClick={open}>
          ✧ 秀米 Plus · 查看结构
        </button>,
      );
    }
    function open() {
      cancelPicker?.();
      const region = discoverRegion(document);
      if (!region) {
        app.render(
          <div className="xep-panel" style={{ height: "auto", padding: 22 }}>
            <strong>还未找到可检查的图文区域</strong>
            <p>
              请进入秀米图文编辑页，或点选文章范围。iframe 内的内容暂不支持。
            </p>
            <button onClick={launch}>返回</button>
            <button onClick={pickRegion}>点选文章范围</button>
            <button onClick={openWorkspace}>导入推文精修 ↗</button>
          </div>,
        );
        return;
      }
      showRegion(region.root, region.scope);
    }
    function showRegion(editor: HTMLElement, scope: string) {
      mount.style.height = "min(950px, calc(100vh - 105px))";
      const parent = editor.parentElement;
      app.render(
        <Panel
          adapter={new EditorAdapter(editor, "xiumi-readonly")}
          onClose={launch}
          scope={scope}
          onPickRegion={pickRegion}
          onRescan={open}
          onOpenWorkspace={openWorkspace}
          onExpandRegion={
            parent && isArticleRegion(parent, document)
              ? () =>
                  showRegion(
                    parent,
                    "已扩大一层，请核对图片和文章首尾是否都在范围内。",
                  )
              : undefined
          }
        />,
      );
    }
    function pickRegion() {
      cancelPicker?.();
      const frame = document.createElement("div");
      frame.className = "region-picker-frame";
      const hint = document.createElement("div");
      hint.className = "region-picker-hint";
      hint.textContent =
        "移动到文章区域，单击选取；Esc 取消。选中后可「扩大一层」。";
      shadow.append(frame, hint);
      let target: HTMLElement | null = null;
      const move = (event: MouseEvent) => {
        if (event.composedPath().includes(host)) return;
        const candidate =
          event.target instanceof Element
            ? event.target.closest<HTMLElement>(
                'article,main,section,div,[contenteditable="true"]',
              )
            : null;
        target =
          candidate && isArticleRegion(candidate, document) ? candidate : null;
        if (!target) {
          frame.style.display = "none";
          return;
        }
        const rect = target.getBoundingClientRect();
        Object.assign(frame.style, {
          display: "block",
          left: `${rect.left}px`,
          top: `${rect.top}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
        });
      };
      const click = (event: MouseEvent) => {
        if (event.composedPath().includes(host)) return;
        move(event);
        if (!target) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const selected = target;
        cancelPicker?.();
        showRegion(selected, "手动选择的区域；可扩大一层，直到包含推文首尾。");
      };
      const key = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          event.preventDefault();
          cancelPicker?.();
        }
      };
      document.addEventListener("mousemove", move, true);
      document.addEventListener("click", click, true);
      document.addEventListener("keydown", key, true);
      cancelPicker = () => {
        document.removeEventListener("mousemove", move, true);
        document.removeEventListener("click", click, true);
        document.removeEventListener("keydown", key, true);
        frame.remove();
        hint.remove();
        cancelPicker = undefined;
      };
    }
    launch();
    const onMessage = (message: unknown) => {
      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        message.type === "xep:source-status"
      )
        return Promise.resolve({ ready: true });
      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        message.type === "xep:return-hint"
      ) {
        const hint = document.createElement("div");
        hint.className = "region-picker-hint";
        hint.textContent =
          "精修内容已复制。请按秀米原生流程粘贴；助手不会自动覆盖或保存原稿。";
        shadow.append(hint);
        ctx.setTimeout(() => hint.remove(), 10000);
        return Promise.resolve({ shown: true });
      }
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
      cancelPicker?.();
      browser.runtime.onMessage.removeListener(onMessage);
      app.unmount();
      host.remove();
    });
  },
});
