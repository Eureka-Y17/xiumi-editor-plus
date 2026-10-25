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
function Demo() {
  const [index, setIndex] = useState(0),
    [generation, setGeneration] = useState(0),
    [adapter, setAdapter] = useState<EditorAdapter | null>(null),
    [hidden, setHidden] = useState(false);
  const article = useRef<HTMLElement>(null),
    panelHost = useRef<HTMLDivElement>(null);
  const html = useMemo(
    () => ({ __html: fixtures[index].html }),
    [index, generation],
  );
  useEffect(() => {
    if (article.current) setAdapter(new EditorAdapter(article.current, "demo"));
  }, [index, generation]);
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
          编辑工作台 <span className="pill">DEMO</span>
        </span>
        <div className="top-right">
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
            让修改更顺手。
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
                className={index === i ? "current" : ""}
                onClick={() => {
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
              <span className="breadcrumb">工作台 / 自制示例</span>
              <h1>
                {fixtures[index].name}
                <span>未命名草稿</span>
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
              className="paper"
              data-testid="article"
              dangerouslySetInnerHTML={html}
            />
            <div className="paper-caption">
              XIUMI EDITOR PLUS · LOCAL PLAYGROUND
            </div>
          </div>
          <div className="demo-warning">
            <span />
            演示不连接秀米账号，不保存或上传稿件。真实秀米目前仅支持结构检查。
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
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<Demo />);
