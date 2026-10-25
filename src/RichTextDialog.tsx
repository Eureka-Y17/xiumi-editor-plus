import React, { useEffect, useRef, useState } from "react";
import { cleanInlineHtml } from "./rich-text";
export function RichTextDialog({
  html,
  onApply,
  onClose,
}: {
  html: string;
  onApply: (html: string) => void;
  onClose: () => void;
}) {
  const area = useRef<HTMLDivElement>(null),
    range = useRef<Range | null>(null);
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (area.current) {
      area.current.innerHTML = html;
      area.current.focus();
    }
    const remember = () => {
      const selection = window.getSelection();
      if (selection?.rangeCount && area.current?.contains(selection.anchorNode))
        range.current = selection.getRangeAt(0).cloneRange();
    };
    document.addEventListener("selectionchange", remember);
    return () => document.removeEventListener("selectionchange", remember);
  }, []);
  function command(cmd: string, value?: string) {
    area.current?.focus();
    if (range.current) {
      const s = window.getSelection();
      s?.removeAllRanges();
      s?.addRange(range.current);
    }
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(cmd, false, value);
  }
  return (
    <div className="st-modal-backdrop">
      <section className="st-rich-dialog" role="dialog" aria-label="编辑文字">
        <h2>编辑文字</h2>
        <p>可以直接输入，也可选中一部分文字单独设置格式。</p>
        <div className="st-rich-tools">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => command("bold")}
          >
            <b>加粗</b>
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => command("italic")}
          >
            <i>斜体</i>
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => command("underline")}
          >
            <u>下划线</u>
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => command("strikeThrough")}
          >
            删除线
          </button>
          <label>
            文字颜色
            <input
              aria-label="选区文字颜色"
              type="color"
              onChange={(e) => command("foreColor", e.target.value)}
            />
          </label>
          <select
            aria-label="选区字号"
            defaultValue="3"
            onChange={(e) => command("fontSize", e.target.value)}
          >
            <option value="2">小字</option>
            <option value="3">正文</option>
            <option value="4">中号</option>
            <option value="5">大号</option>
            <option value="6">标题</option>
          </select>
          <button onClick={() => command("removeFormat")}>清除格式</button>
        </div>
        <div
          ref={area}
          className="st-rich-area"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-label="富文本编辑区域"
          onPaste={(e) => {
            e.preventDefault();
            command("insertText", e.clipboardData.getData("text/plain"));
          }}
        />
        <div className="st-rich-link">
          <input
            aria-label="选区链接"
            placeholder="https://… 选中文字后添加链接"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            disabled={!/^https:\/\//i.test(url)}
            onClick={() => command("createLink", url)}
          >
            添加链接
          </button>
        </div>
        <div className="st-rich-actions">
          <button onClick={onClose}>取消</button>
          <button
            className="st-primary"
            onClick={() =>
              onApply(cleanInlineHtml(area.current?.innerHTML ?? ""))
            }
          >
            应用并返回文章
          </button>
        </div>
      </section>
    </div>
  );
}
