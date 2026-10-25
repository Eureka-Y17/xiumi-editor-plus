import React, { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  Layers,
  MousePointer2,
  ChevronRight,
  ChevronDown,
  Undo2,
  Redo2,
  X,
  RefreshCw,
  GripVertical,
  Image,
  Type,
  Box,
  ArrowUpRight,
  UnfoldVertical,
  PanelRightClose,
  HelpCircle,
} from "lucide-react";
import { EditorAdapter } from "./adapter";
import { kindNames, type Command, type ComponentNode } from "./model";
import { browser } from "wxt/browser";
import { PropertyEditor } from "./PropertyEditor";
export function Panel({
  adapter,
  onClose,
  scope,
  onPickRegion,
  onExpandRegion,
  onRescan,
  onOpenWorkspace,
}: {
  adapter: EditorAdapter;
  onClose?: () => void;
  scope?: string;
  onPickRegion?: () => void;
  onExpandRegion?: () => void;
  onRescan?: () => void;
  onOpenWorkspace?: () => void;
}) {
  const [tree, setTree] = useState<ComponentNode[]>([]),
    [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState("structure"),
    [message, setMessage] = useState("选择一个组件，开始探索。");
  const [swapFrom, setSwapFrom] = useState<string | null>(null),
    [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{
    id: string;
    token: number;
    kind: "unwrap" | "restore";
  } | null>(null);
  const [guide, setGuide] = useState(false);
  const highlight = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const chooseRef = useRef<(id: string, scroll: boolean) => void>(() => {});
  const readonly = adapter.mode === "xiumi-readonly";
  const all: ComponentNode[] = [];
  const flatten = (nodes: ComponentNode[]) =>
    nodes.forEach((n) => {
      all.push(n);
      flatten(n.children);
    });
  flatten(tree);
  const node = all.find((n) => n.id === selected),
    el = selected ? adapter.element(selected) : undefined;
  const refresh = () => {
    setTree(adapter.tree());
    setSelected((id) => (id && adapter.element(id) ? id : null));
  };
  useEffect(() => {
    setSelected(null);
    setSwapFrom(null);
    setConfirm(null);
    setCollapsed(new Set());
    refresh();
  }, [adapter]);
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const panel = panelRef.current;
    browser.storage.local
      .get(["xepGuideSeen", "xepPanelWidth"])
      .then((prefs) => {
        if (!live) return;
        setGuide(!prefs.xepGuideSeen);
        if (panel && typeof prefs.xepPanelWidth === "number")
          panel.style.width = `${Math.min(520, Math.max(300, prefs.xepPanelWidth))}px`;
      })
      .catch(() => {});
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (panel)
          void browser.storage.local
            .set({
              xepPanelWidth: Math.round(panel.getBoundingClientRect().width),
            })
            .catch(() => {});
      }, 500);
    });
    if (panel) observer.observe(panel);
    return () => {
      live = false;
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 80);
    });
    observer.observe(adapter.root, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    const click = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const id = adapter.idFor(event.target);
      if (id) chooseRef.current(id, false);
    };
    adapter.root.addEventListener("click", click);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      adapter.root.removeEventListener("click", click);
    };
  }, [adapter]);
  // An overlay marks selection without adding attributes to the article or its undo history.
  useEffect(() => {
    const update = () => {
      const target = selected ? adapter.element(selected) : undefined;
      const overlay = highlight.current;
      if (!overlay) return;
      if (!target) {
        overlay.style.display = "none";
        return;
      }
      const r = target.getBoundingClientRect();
      Object.assign(overlay.style, {
        display: "block",
        left: `${r.left}px`,
        top: `${r.top}px`,
        width: `${r.width}px`,
        height: `${r.height}px`,
      });
    };
    update();
    const timer = setInterval(update, 250);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [selected, adapter, tree]);
  function choose(id: string, scroll = true) {
    if (swapFrom && swapFrom !== id) {
      try {
        adapter.swap(swapFrom, id);
        setMessage("两张图片已交换，位置与裁切保持不变。");
      } catch (error) {
        setMessage((error as Error).message);
      }
      setSwapFrom(null);
      refresh();
    }
    setSelected(id);
    if (scroll)
      adapter
        .element(id)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    const next = new Set(collapsed);
    let parent = all.find((n) => n.id === id)?.parentId;
    while (parent) {
      next.delete(parent);
      parent = all.find((n) => n.id === parent)?.parentId;
    }
    setCollapsed(next);
  }
  chooseRef.current = choose;
  function run(fn: () => void, text: string) {
    try {
      fn();
      setMessage(text);
      setSwapFrom(null);
      refresh();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  function action(command: Command) {
    if (!selected) return;
    if (command === "unwrap") {
      setConfirm({ id: selected, token: adapter.token(), kind: "unwrap" });
      return;
    }
    run(() => adapter.execute(selected, command), "修改完成，可撤销此操作。");
  }
  const icon = (kind: string) =>
    kind === "image" ? (
      <Image size={15} />
    ) : kind === "text" ? (
      <Type size={15} />
    ) : (
      <Box size={15} />
    );
  function rows(nodes: ComponentNode[], depth = 0): React.ReactNode {
    return nodes.map((n) => (
      <React.Fragment key={n.id}>
        <div
          className={`tree-row ${selected === n.id ? "active" : ""}`}
          style={{ paddingLeft: 12 + depth * 15 }}
          draggable={!readonly && n.kind !== "special"}
          onDragStart={(e) => e.dataTransfer.setData("text/x-xep-node", n.id)}
          onDragOver={(e) => {
            if (!readonly) e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            run(
              () =>
                adapter.reorder(
                  e.dataTransfer.getData("text/x-xep-node"),
                  n.id,
                ),
              "组件顺序已更新。",
            );
          }}
        >
          <button
            className="fold"
            aria-label={`${collapsed.has(n.id) ? "展开" : "折叠"}${n.label}`}
            disabled={!n.children.length}
            onClick={() =>
              setCollapsed((prev) => {
                const next = new Set(prev);
                next.has(n.id) ? next.delete(n.id) : next.add(n.id);
                return next;
              })
            }
          >
            {n.children.length ? (
              collapsed.has(n.id) ? (
                <ChevronRight size={13} />
              ) : (
                <ChevronDown size={13} />
              )
            ) : (
              <span />
            )}
          </button>
          <button className="node" onClick={() => choose(n.id)}>
            {icon(n.kind)}
            <span>{n.label}</span>
            {n.kind === "special" && <small>只读</small>}
          </button>
          <GripVertical size={12} className="grip" />
        </div>
        {!collapsed.has(n.id) && rows(n.children, depth + 1)}
      </React.Fragment>
    ));
  }
  const commandButton = (
    command: Command,
    label: string,
    child: React.ReactNode,
  ) => {
    const cap = selected
      ? adapter.capability(selected, command)
      : { allowed: false, reason: "请先选择组件。" };
    return (
      <button
        className="tool"
        title={cap.reason || label}
        disabled={!cap.allowed}
        onClick={() => action(command)}
      >
        {child}
        <span>{label}</span>
      </button>
    );
  };
  return (
    <>
      <div ref={highlight} className="selection-overlay" />
      <aside ref={panelRef} className="xep-panel" aria-label="秀米编辑增强面板">
        <header className="panel-header">
          <span className="brand-icon">
            <Layers size={18} />
          </span>
          <div>
            <strong>
              编辑助手 <em>PLUS</em>
            </strong>
            <small>让复杂的修改，简单一点</small>
          </div>
          <button
            className="icon-btn"
            title="使用帮助"
            onClick={() => {
              setGuide(!guide);
              void browser.storage.local
                .set({ xepGuideSeen: true })
                .catch(() => {});
            }}
          >
            <HelpCircle size={17} />
          </button>
          {onClose && (
            <button
              className="icon-btn"
              aria-label="收起面板"
              onClick={onClose}
            >
              <PanelRightClose size={17} />
            </button>
          )}
        </header>
        <div className={`mode-banner ${readonly ? "warning" : ""}`}>
          <span className="status-dot" />
          {readonly
            ? "结构检查模式 · 修改尚未验证"
            : adapter.mode === "imported"
              ? "已导入图文 · 编辑不会影响秀米原稿"
              : "本地演示 · 操作不会影响秀米稿件"}
        </div>
        {readonly && (
          <div className="scope-info">
            <strong>当前检查范围 · {all.length} 个节点</strong>
            <p>
              {adapter.root.isConnected
                ? scope
                : "原区域已被页面替换，请重新识别。"}
            </p>
            <div>
              <button onClick={onPickRegion}>点选文章范围</button>
              <button disabled={!onExpandRegion} onClick={onExpandRegion}>
                扩大一层
              </button>
              <button onClick={onRescan}>重新识别</button>
              {onOpenWorkspace && (
                <button className="import-entry" onClick={onOpenWorkspace}>
                  导入推文精修 ↗
                </button>
              )}
            </div>
          </div>
        )}
        {guide && (
          <div className="guide">
            <strong>三步上手</strong>
            <p>
              ① 在文章或结构树中选择组件。
              <br />② 使用下方工具调整位置、图层或拆组。
              <br />③ 点撤销即可退回，恢复可回到本次演示初始状态。
            </p>
            <p>真实秀米当前仅查看结构。演示成功不代表秀米保存已验证。</p>
          </div>
        )}
        <div className="panel-tabs">
          <button
            className={tab === "structure" ? "chosen" : ""}
            onClick={() => setTab("structure")}
          >
            <Layers size={14} />
            组件结构 <span>{all.length}</span>
          </button>
          <button
            className={tab === "properties" ? "chosen" : ""}
            onClick={() => setTab("properties")}
          >
            <MousePointer2 size={14} />
            颜色与文字
          </button>
        </div>
        <div className="panel-scroll">
          {tab === "structure" ? (
            <>
              <div className="section-label">
                {readonly ? "当前范围结构" : "文章结构"}
                <button
                  className="icon-btn"
                  aria-label="刷新结构"
                  onClick={refresh}
                >
                  <RefreshCw size={13} />
                </button>
              </div>
              <div className="tree">
                {tree.length ? (
                  rows(tree)
                ) : (
                  <div className="empty">
                    未识别到可检查的组件。
                    <br />
                    请进入图文编辑区后重试。
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="properties">
              <div className="section-label">当前组件</div>
              {el && node ? (
                <>
                  <h3>{node.label}</h3>
                  <dl>
                    <dt>类型</dt>
                    <dd>{kindNames[node.kind]}</dd>
                    <dt>标签</dt>
                    <dd>{el.tagName.toLowerCase()}</dd>
                    <dt>子组件</dt>
                    <dd>{node.children.length} 个</dd>
                    <dt>尺寸</dt>
                    <dd>
                      {Math.round(el.getBoundingClientRect().width)} ×{" "}
                      {Math.round(el.getBoundingClientRect().height)}
                    </dd>
                    <dt>图层</dt>
                    <dd>{el.style.zIndex || "自动"}</dd>
                  </dl>
                  <p className="muted">
                    {readonly
                      ? "仅检查页面可见结构，不代表秀米内部组件模型。"
                      : "尺寸与样式由原容器保留。图片交换仅更换素材及替代文字。"}
                  </p>
                  <PropertyEditor
                    key={selected}
                    adapter={adapter}
                    id={selected!}
                    onChange={run}
                  />
                </>
              ) : (
                <div className="empty">选择组件后，在这里查看属性。</div>
              )}
            </div>
          )}
        </div>
        <div className="actions">
          <div className="selected-label">
            {node ? (
              <>
                {icon(node.kind)}
                <span>{node.label}</span>
                <small>{kindNames[node.kind]}</small>
              </>
            ) : (
              <>
                <MousePointer2 size={14} />
                <span>请先选择一个组件</span>
              </>
            )}
          </div>
          <div className="nav-tools">
            <button
              disabled={!node?.parentId}
              onClick={() => node?.parentId && choose(node.parentId)}
            >
              父层
            </button>
            <button
              disabled={!node?.children.length}
              onClick={() => node && choose(node.children[0].id)}
            >
              子层
            </button>
            <button
              disabled={
                !node ||
                !all.some(
                  (n) => n.parentId === node.parentId && n.id !== node.id,
                )
              }
              onClick={() => {
                if (!node) return;
                const peers = all.filter((n) => n.parentId === node.parentId);
                choose(
                  peers[
                    (peers.findIndex((n) => n.id === node.id) + 1) %
                      peers.length
                  ].id,
                );
              }}
            >
              相邻
            </button>
          </div>
          <div className="section-label">位置与结构</div>
          <div className="tool-grid">
            {commandButton("up", "向前移动", <ArrowUp size={15} />)}
            {commandButton("down", "向后移动", <ArrowDown size={15} />)}
            {commandButton("promote", "提升一层", <ArrowUpRight size={15} />)}
            {commandButton("unwrap", "拆分外壳", <UnfoldVertical size={15} />)}
          </div>
          <button
            className={`swap ${swapFrom ? "swapping" : ""}`}
            disabled={readonly || node?.kind !== "image"}
            onClick={() => {
              setSwapFrom(swapFrom ? null : selected);
              setMessage(
                swapFrom
                  ? "已取消图片交换。"
                  : "请选择另一张普通图片，或再次点击取消。",
              );
            }}
          >
            <Image size={15} />
            {swapFrom ? "取消交换 · 请选另一张图片" : "与另一张图片交换"}
          </button>
          <div className="section-label">重叠图层</div>
          <div className="layer-tools">
            {commandButton("layerUp", "上移", <ArrowUp size={13} />)}
            {commandButton("layerDown", "下移", <ArrowDown size={13} />)}
            {commandButton("front", "置顶", <Layers size={13} />)}
            {commandButton("back", "置底", <Layers size={13} />)}
          </div>
          <div className="history">
            <button
              disabled={readonly || !adapter.canUndo}
              title="撤销最近一次助手修改"
              onClick={() => run(() => adapter.undo(), "已撤销上一步。")}
            >
              <Undo2 size={15} />
              撤销
            </button>
            <button
              disabled={readonly || !adapter.canRedo}
              onClick={() => run(() => adapter.redo(), "已重做。")}
            >
              <Redo2 size={15} />
              重做
            </button>
            <button
              disabled={!adapter.canRestore}
              onClick={() =>
                setConfirm({ id: "", token: adapter.token(), kind: "restore" })
              }
            >
              <RefreshCw size={13} />
              恢复
            </button>
          </div>
        </div>
        <footer className="panel-footer">
          <span className="status-dot" />
          <span role="status">{message}</span>
        </footer>
      </aside>
      {confirm && (
        <div className="modal-backdrop">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={confirm.kind === "unwrap" ? "确认拆组" : "确认恢复"}
          >
            <button
              className="icon-btn modal-close"
              aria-label="关闭确认"
              onClick={() => setConfirm(null)}
            >
              <X size={17} />
            </button>
            <Layers size={26} />
            <h2>
              {confirm.kind === "unwrap" ? "移除这层外壳？" : "恢复本次演示？"}
            </h2>
            <p>
              {confirm.kind === "unwrap"
                ? `内部内容将保留。外壳的${adapter.warnings(confirm.id).join("、") || "布局样式"}将不再保留。此操作可撤销。`
                : "回到本次模板载入时的状态。恢复后仍可撤销。"}
            </p>
            <div>
              <button onClick={() => setConfirm(null)}>取消</button>
              <button
                className="primary"
                onClick={() => {
                  if (confirm.token !== adapter.token()) {
                    setMessage("内容已变化，请重新确认。");
                    setConfirm(null);
                    return;
                  }
                  run(
                    () =>
                      confirm.kind === "unwrap"
                        ? adapter.execute(confirm.id, "unwrap")
                        : adapter.restore(),
                    "操作完成，可撤销。",
                  );
                  setConfirm(null);
                }}
              >
                确认{confirm.kind === "unwrap" ? "拆组" : "恢复"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
