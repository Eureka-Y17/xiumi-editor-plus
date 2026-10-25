import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  Layers,
  ChevronDown,
  BookOpen,
  FlaskConical,
  Check,
  RotateCcw,
} from "lucide-react";
import { fixtures } from "../../src/fixtures";
import { EditorAdapter } from "../../src/adapter";
import { Panel } from "../../src/Panel";
import panelCss from "../../src/panel.css?inline";
import "./style.css";
import { ImportDialog } from "../../src/ImportDialog";
import {
  exportArticle,
  prepareImportedRoot,
  type ImportedArticle,
} from "../../src/importer";
function Demo() {
  const [index, setIndex] = useState(0),
    [generation, setGeneration] = useState(0),
    [adapter, setAdapter] = useState<EditorAdapter | null>(null),
    [hidden, setHidden] = useState(false);
  const article = useRef<HTMLElement>(null),
    panelHost = useRef<HTMLDivElement>(null);
  const [imported, setImported] = useState<ImportedArticle | null>(null);
  const [importOpen, setImportOpen] = useState(() =>
    new URLSearchParams(location.search).has("import"),
  );
  const [exportMessage, setExportMessage] = useState("");
  const html = useMemo(
    () => ({ __html: imported?.html ?? fixtures[index].html }),
    [index, generation, imported],
  );
  useEffect(() => {
    if (article.current) {
      if (imported) prepareImportedRoot(article.current);
      setAdapter(
        new EditorAdapter(article.current, imported ? "imported" : "demo"),
      );
    }
  }, [index, generation, imported]);
  async function copyArticle() {
    if (!article.current) return;
    const content = exportArticle(article.current);
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([content.html], { type: "text/html" }),
          "text/plain": new Blob([content.text], { type: "text/plain" }),
        }),
      ]);
      setExportMessage(
        "已复制完整富文本，请到公众号正文编辑器 Ctrl+V，并检查手机预览。",
      );
    } catch {
      setExportMessage(
        "浏览器未允许复制，请先下载 HTML 备份，或检查浏览器的剪贴板设置。",
      );
    }
  }
  function downloadArticle() {
    if (!article.current) return;
    const content = exportArticle(article.current);
    const url = URL.createObjectURL(
      new Blob(
        [
          `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>精修图文</title><body>${content.html}</body></html>`,
        ],
        { type: "text/html;charset=utf-8" },
      ),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "精修图文.html";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  useEffect(() => {
    if (!panelHost.current || !adapter || hidden) return;
    const shadow =
      panelHost.current.shadowRoot ??
      panelHost.current.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = panelCss;
    shadow.append(style);
    const mount = document.createElement("div");
    mount.style.height = "100%";
    shadow.append(mount);
    const root = createRoot(mount);
    root.render(<Panel adapter={adapter} onClose={() => setHidden(true)} />);
    return () => {
      root.unmount();
      shadow.replaceChildren();
    };
  }, [adapter, hidden]);
  return (
    <div className="workspace">
      <nav className="topbar">
        <a
          className="logo"
          href="https://github.com/Eureka-Y17/xiumi-editor-plus"
          target="_blank"
          rel="noreferrer"
        >
          <span className="logo-mark">
            <Layers size={19} />
          </span>
          秀米 <b>PLUS</b>
        </a>
        <span className="top-divider" />
        <span className="workspace-name">
          编辑工作台{" "}
          <span className="pill">{imported ? "IMPORTED" : "DEMO"}</span>
        </span>
        <div className="top-right">
          <button className="import-launch" onClick={() => setImportOpen(true)}>
            导入秀米推文
          </button>
          {imported && (
            <button className="import-launch" onClick={copyArticle}>
              复制到公众号
            </button>
          )}
          <span className="local-state">
            <Check size={13} />
            仅在本地运行
          </span>
          <a
            href="https://github.com/Eureka-Y17/xiumi-editor-plus/blob/main/docs/USER_GUIDE.md"
            target="_blank"
            rel="noreferrer"
          >
            <BookOpen size={15} />
            操作指南 <ArrowUpRight size={13} />
          </a>
        </div>
      </nav>
      <div className="body">
        <aside className="left-rail">
          <div className="rail-heading">你的创作空间</div>
          <h2>
            从细节，
            <br />
            让修改顺手。
          </h2>
          <p className="rail-copy">
            不再困在层层布局里。
            <br />
            看见结构，轻松修改。
          </p>
          <div className="rail-section">
            示例模板 <span>{String(fixtures.length).padStart(2, "0")}</span>
          </div>
          <div className="fixture-list">
            {fixtures.map((f, i) => (
              <button
                key={f.name}
                className={!imported && index === i ? "current" : ""}
                onClick={() => {
                  setImported(null);
                  setExportMessage("");
                  setIndex(i);
                  setGeneration((g) => g + 1);
                }}
              >
                <span className="fixture-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  <strong>{f.name}</strong>
                  <small>{f.description}</small>
                </span>
                {index === i && <span className="fixture-dot" />}
              </button>
            ))}
          </div>
          <div className="rail-note">
            <FlaskConical size={16} />
            <div>
              <strong>安心试一试</strong>
              <p>
                自制模板，随意探索。
                <br />
                切换模板会重置本次修改。
              </p>
            </div>
          </div>
        </aside>
        <main className="editor-space">
          <div className="editor-title">
            <div>
              <span className="breadcrumb">
                工作台 / {imported ? "已导入图文" : "自制示例"}
              </span>
              <h1>
                {imported ? "我的精修图文" : fixtures[index].name}
                <span>{imported ? "仅本地 · 未保存" : "未命名草稿"}</span>
              </h1>
            </div>
            <button
              className="reset-demo"
              onClick={() => setGeneration((g) => g + 1)}
            >
              <RotateCcw size={13} />
              重新开始
            </button>
          </div>
          <div className="editor-toolbar">
            <span className="toolbar-tag">
              图文预览 <ChevronDown size={12} />
            </span>
            <span className="toolbar-divider" />
            <span>选中组件，在右侧调整</span>
            <span className="paper-size">图文预览 · 自适应宽度</span>
          </div>
          <div className="paper-wrap">
            <article
              key={`${index}-${generation}`}
              ref={article}
              className={imported ? "imported-paper" : "paper"}
              data-testid="article"
              onClick={(event) => {
                if (
                  imported &&
                  event.target instanceof Element &&
                  event.target.closest("a")
                )
                  event.preventDefault();
              }}
              dangerouslySetInnerHTML={html}
            />
            <div className="paper-caption">
              XIUMI EDITOR PLUS · LOCAL PLAYGROUND
            </div>
          </div>
          {imported && (
            <div className="export-actions">
              <button onClick={copyArticle}>复制到公众号</button>
              <button onClick={downloadArticle}>下载 HTML 备份</button>
              <p role="status">
                {exportMessage ||
                  "先核对图文，再复制到公众号；刷新页面会丢失未备份的修改。"}
              </p>
              <details>
                <summary>导入说明与兼容提示</summary>
                {imported.warnings.map((w) => (
                  <p key={w}>{w}</p>
                ))}
              </details>
            </div>
          )}
          <div className="demo-warning">
            <span />
            {imported
              ? "编辑的是导入副本，不写回秀米。图片按原地址加载，请核对最终公众号效果。"
              : "演示不连接秀米账号，不保存或上传稿件。真实秀米目前仅支持结构检查。"}
          </div>
        </main>
        <div
          className={`panel-dock ${hidden ? "is-hidden" : ""}`}
          key={`host-${index}-${generation}-${hidden}`}
          ref={panelHost}
        />
        {hidden && (
          <button className="reopen" onClick={() => setHidden(false)}>
            <Layers size={16} />
            打开编辑助手
          </button>
        )}
      </div>
      {importOpen && (
        <ImportDialog
          onClose={() => setImportOpen(false)}
          onImport={(data) => {
            setImported(data);
            setImportOpen(false);
            setGeneration((g) => g + 1);
            setExportMessage("");
          }}
        />
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<Demo />);
