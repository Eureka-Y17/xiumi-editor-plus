import React, { useState } from "react";
import { X, ClipboardPaste } from "lucide-react";
import { importArticle, type ImportedArticle } from "./importer";
export function ImportDialog({
  onImport,
  onClose,
}: {
  onImport: (article: ImportedArticle) => void;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  return (
    <div className="import-backdrop">
      <section
        className="import-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="导入秀米推文"
      >
        <button
          className="dialog-close"
          aria-label="关闭导入"
          onClick={onClose}
        >
          <X size={18} />
        </button>
        <ClipboardPaste size={28} />
        <h2>把完整推文，带进来。</h2>
        <p>
          在秀米点击「导出」，按提示 Ctrl+C；
          <br />
          然后点击下方区域，按 Ctrl+V。
        </p>
        <div
          className="paste-target"
          contentEditable
          suppressContentEditableWarning
          tabIndex={0}
          role="textbox"
          aria-label="粘贴秀米富文本"
          autoFocus
          onPaste={(event) => {
            event.preventDefault();
            try {
              const imported = importArticle(
                event.clipboardData.getData("text/html"),
              );
              onImport(imported);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <ClipboardPaste size={22} />
          <strong>点击这里，再按 Ctrl+V</strong>
          <span>读取完整富文本，不需要填写接口或登录</span>
        </div>
        {error && (
          <p className="import-error" role="alert">
            {error}
          </p>
        )}
        <small>
          在本机处理。将替换当前工作台内容，请先复制或下载需要保留的修改。
          <br />
          不会修改秀米原稿，也不保证还原特殊 SVG 或字体效果。
        </small>
      </section>
    </div>
  );
}
