import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { browser } from "wxt/browser";
import "../../src/popup.css";
function Popup() {
  useEffect(() => {
    browser.tabs
      .query({ active: true, currentWindow: true })
      .then(async ([tab]) => {
        if (!tab?.id) return;
        const result = await browser.tabs.sendMessage(tab.id, {
          type: "xep:open",
        });
        if (result?.opened) window.close();
      })
      .catch(() => {
        /* Outside Xiumi, keep the demo launcher available. */
      });
  }, []);
  return (
    <main>
      <span className="wordmark">
        秀米 <b>PLUS</b>
      </span>
      <h1>
        让每一处修改，
        <br />
        都更顺手。
      </h1>
      <p>查看结构、精准选择，在自制演示中体验组件编辑。</p>
      <button
        onClick={() =>
          browser.tabs.create({ url: browser.runtime.getURL("/demo.html") })
        }
      >
        打开交互演示 ↗
      </button>
      <a href="https://xiumi.us" target="_blank" rel="noreferrer">
        前往秀米 →
      </a>
      <small>
        v0.1.0 · 实验版
        <br />
        真实秀米仅提供结构检查，修改尚未开放。
      </small>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Popup />);
