import React from "react";
import { createRoot } from "react-dom/client";
import { browser } from "wxt/browser";
import "../../src/popup.css";
function Popup() {
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
      <p>在本地自由拖动、组合和编辑图文，自动保存草稿。</p>
      <button
        onClick={() =>
          browser.tabs.create({ url: browser.runtime.getURL("/demo.html") })
        }
      >
        打开精修工作台 ↗
      </button>
      <a href="https://xiumi.us" target="_blank" rel="noreferrer">
        前往秀米 →
      </a>
      <small>
        v0.4.1 · 实验版
        <br />
        本地编辑 · 拖拽组合 · 图层精修
      </small>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Popup />);
