import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Layers,
  Plus,
  Type,
  Image as ImageIcon,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Undo2,
  Redo2,
  Group,
  Ungroup,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  BringToFront,
  SendToBack,
  Lock,
  Unlock,
  Eye,
  Download,
  Upload,
  Settings,
  Check,
  MousePointer2,
  LayoutTemplate,
  X,
  Link as LinkIcon,
  Square,
  Move,
} from "lucide-react";
import {
  StudioEngine,
  starter,
  cleanStudioHtml,
  type InsertKind,
} from "./studio-engine";
import {
  projects,
  saveProject,
  readProject,
  projectFile,
  type StudioProject,
} from "./project-store";
import { type ComponentNode, kindNames } from "./model";
import { ImportDialog } from "./ImportDialog";
import { exportArticle } from "./importer";
import { hexColor } from "./appearance";
import { browser } from "wxt/browser";
import QRCode from "qrcode";
import { deliveryContent, wrapArticle, studioCopy } from "./delivery";
import "./studio.css";
import { RichTextDialog } from "./RichTextDialog";

const blankProject = (html = starter, title = "未命名图文"): StudioProject => ({
  id: crypto.randomUUID(),
  title,
  html,
  width: 390,
  updated: Date.now(),
});
function download(name: string, text: string, type = "text/html") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const fontNames = [
  "系统默认",
  "微软雅黑",
  "苹方",
  "宋体",
  "黑体",
  "楷体",
  "仿宋",
  "思源黑体",
];
const fonts = [
  "system-ui,sans-serif",
  '"Microsoft YaHei",sans-serif',
  '"PingFang SC",sans-serif',
  "SimSun,serif",
  "SimHei,sans-serif",
  "KaiTi,serif",
  "FangSong,serif",
  '"Noto Sans CJK SC",sans-serif',
];
export function Studio() {
  const [project, setProject] = useState<StudioProject | null>(null),
    [library, setLibrary] = useState<StudioProject[]>([]),
    [engine, setEngine] = useState<StudioEngine | null>(null),
    [tree, setTree] = useState<ComponentNode[]>([]),
    [selection, setSelection] = useState<string[]>([]),
    [revision, setRevision] = useState(0),
    [message, setMessage] = useState(
      "点击选择组件；Ctrl / ⌘ 多选。画布组件可直接自由拖动。",
    ),
    [saveState, setSaveState] = useState("正在打开本地草稿…"),
    [collapsed, setCollapsed] = useState<Set<string>>(new Set()),
    [tab, setTab] = useState<"structure" | "insert">("structure"),
    [importOpen, setImportOpen] = useState(() =>
      new URLSearchParams(location.search).has("import"),
    ),
    [preview, setPreview] = useState(false),
    [settings, setSettings] = useState(false),
    [text, setText] = useState(""),
    [link, setLink] = useState(""),
    [ghost, setGhost] = useState<{
      x: number;
      y: number;
      width: number;
      height: number;
    } | null>(null),
    [boxes, setBoxes] = useState<
      { id: string; x: number; y: number; width: number; height: number }[]
    >([]),
    [formVersion, setFormVersion] = useState(0),
    [clipboardBusy, setClipboardBusy] = useState(false);
  const [richId, setRichId] = useState<string | null>(null);
  const article = useRef<HTMLElement>(null),
    file = useRef<HTMLInputElement>(null),
    imageFile = useRef<HTMLInputElement>(null),
    textArea = useRef<HTMLTextAreaElement>(null),
    latest = useRef({ engine, selection }),
    drag = useRef<{
      ids: string[];
      x: number;
      y: number;
      active: boolean;
      mode: "flow" | "canvas" | "resize";
      box: DOMRect;
      target?: string;
      where?: "before" | "after";
      width: number;
      height: number;
    } | null>(null),
    dragIds = useRef<string[]>([]);
  latest.current = { engine, selection };
  const html = useMemo(() => ({ __html: project?.html ?? "" }), [project?.id]);
  useEffect(() => {
    let live = true;
    projects()
      .then((list) => {
        if (!live) return;
        setLibrary(list);
        setProject(list[0] ?? blankProject());
      })
      .catch((e) => {
        setMessage(e.message);
        setProject(blankProject());
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!project || !article.current) return;
    const next = new StudioEngine(article.current);
    setEngine(next);
    setTree(next.tree());
    setSelection([]);
    setCollapsed(new Set());
    setRevision(0);
  }, [project?.id]);
  const refresh = (e = engine) => {
    if (!e) return;
    setTree(e.tree());
    setSelection((ids) => ids.filter((id) => !!e.element(id)));
    setRevision((v) => v + 1);
    setFormVersion((v) => v + 1);
  };
  function run(fn: () => unknown, note = "已更新，可撤销。") {
    try {
      const result = fn();
      refresh();
      if (typeof result === "string") setSelection([result]);
      setMessage(note);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  useEffect(() => {
    if (!engine || !project) return;
    setSaveState("保存中…");
    const timer = setTimeout(() => {
      const snapshot = {
        ...project,
        html: engine.root.innerHTML,
        updated: Date.now(),
      };
      saveProject(snapshot)
        .then(() => {
          setSaveState("已保存在本机");
          setLibrary((list) => [
            snapshot,
            ...list.filter((p) => p.id !== snapshot.id),
          ]);
        })
        .catch((e) => {
          setSaveState("保存失败，请备份");
          setMessage(e.message);
        });
    }, 600);
    return () => clearTimeout(timer);
  }, [engine, revision, project?.title, project?.width]);
  async function switchProject(next: StudioProject) {
    if (engine && project) {
      try {
        await saveProject({
          ...project,
          html: engine.root.innerHTML,
          updated: Date.now(),
        });
      } catch (e) {
        setMessage((e as Error).message);
        return;
      }
    }
    setProject({ ...next, html: cleanStudioHtml(next.html) });
    setPreview(false);
  }
  function choose(id: string, multi = false) {
    setSelection((old) =>
      multi
        ? old.includes(id)
          ? old.filter((v) => v !== id)
          : [...old, id]
        : [id],
    );
    setFormVersion((v) => v + 1);
  }
  const selected = selection[0],
    el = selected ? engine?.element(selected) : null,
    computed = el ? getComputedStyle(el) : null;
  useEffect(() => {
    if (engine && selected) {
      setText(engine.text(selected));
      setLink(
        engine.element(selected)?.closest("a")?.getAttribute("href") ??
          engine.element(selected)?.querySelector("a")?.getAttribute("href") ??
          "",
      );
    } else setText("");
  }, [selected, engine, formVersion]);
  useEffect(() => {
    const measure = () => {
      const { engine: e, selection: ids } = latest.current;
      setBoxes(
        ids.flatMap((id) => {
          const el = e?.element(id);
          if (!el) return [];
          const r = el.getBoundingClientRect();
          return [
            { id, x: r.left, y: r.top, width: r.width, height: r.height },
          ];
        }),
      );
    };
    const timer = setInterval(measure, 150);
    measure();
    return () => clearInterval(timer);
  }, []);
  // Update handles before painting a new selection; the polling fallback only
  // tracks later scrolling/layout changes, never the first selected frame.
  useLayoutEffect(() => {
    setBoxes(
      selection.flatMap((id) => {
        const node = engine?.element(id);
        if (!node) return [];
        const r = node.getBoundingClientRect();
        return [{ id, x: r.left, y: r.top, width: r.width, height: r.height }];
      }),
    );
  }, [engine, selection, revision, project?.width, project?.id]);
  function targetId(target: EventTarget | null, deep = false) {
    if (!(target instanceof Element) || !engine) return null;
    let node = target.closest<HTMLElement>(
      "img,p,h1,h2,h3,h4,li,blockquote,td,th,[data-xep-group],[data-xep-canvas],section,table",
    );
    if (!deep) {
      const group = target.closest<HTMLElement>("[data-xep-group]");
      if (group && article.current?.contains(group)) node = group;
    }
    if (node?.parentElement?.hasAttribute("data-xep-image-link"))
      node = node.parentElement;
    return node && article.current?.contains(node) ? engine.idFor(node) : null;
  }
  function startDrag(e: React.PointerEvent, id?: string, resize = false) {
    if (e.button !== 0 || !engine) return;
    const next = id ?? targetId(e.target, e.altKey);
    if (!next) {
      setSelection([]);
      return;
    }
    const target = engine.element(next);
    if (!target) return;
    const multi = e.ctrlKey || e.metaKey || e.shiftKey;
    if (multi && !resize) {
      choose(next, true);
      e.preventDefault();
      return;
    }
    const ids = selection.includes(next) ? selection : [next];
    if (!selection.includes(next)) choose(next);
    if (target.closest('[data-xep-locked="1"]')) {
      setMessage("组件已锁定，请先在图层面板解锁。");
      return;
    }
    e.preventDefault();
    drag.current = {
      ids,
      x: e.clientX,
      y: e.clientY,
      active: false,
      mode: resize
        ? "resize"
        : target.parentElement?.hasAttribute("data-xep-canvas")
          ? "canvas"
          : "flow",
      box: target.getBoundingClientRect(),
      width: target.offsetWidth,
      height: target.offsetHeight,
    };
  }
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x,
        dy = e.clientY - d.y;
      if (!d.active && Math.hypot(dx, dy) < 5) return;
      d.active = true;
      e.preventDefault();
      if (d.mode === "canvas" || d.mode === "resize")
        setGhost({
          x: d.box.x + (d.mode === "canvas" ? dx : 0),
          y: d.box.y + (d.mode === "canvas" ? dy : 0),
          width: d.mode === "resize" ? Math.max(16, d.width + dx) : d.box.width,
          height:
            d.mode === "resize" ? Math.max(16, d.height + dy) : d.box.height,
        });
      else {
        const e2 = latest.current.engine;
        const target = document.elementFromPoint(e.clientX, e.clientY);
        const id = targetId(target, e.altKey);
        const node = id ? e2?.element(id) : null;
        if (node && !d.ids.includes(id!)) {
          const rect = node.getBoundingClientRect();
          d.target = id!;
          d.where = e.clientY < rect.y + rect.height / 2 ? "before" : "after";
          setGhost({
            x: rect.x,
            y: d.where === "before" ? rect.y : rect.bottom,
            width: rect.width,
            height: 3,
          });
        } else {
          d.target = undefined;
          setGhost(null);
        }
      }
    };
    const up = (e: PointerEvent) => {
      const d = drag.current;
      drag.current = null;
      setGhost(null);
      const current = latest.current.engine;
      if (!d?.active || !current) return;
      run(
        () => {
          if (d.mode === "canvas")
            current.translate(d.ids, e.clientX - d.x, e.clientY - d.y);
          else if (d.mode === "resize")
            current.resize(
              d.ids[0],
              Math.max(16, d.width + e.clientX - d.x),
              Math.max(16, d.height + e.clientY - d.y),
            );
          else if (d.target) current.move(d.ids, d.target, d.where);
        },
        d.mode === "flow" ? "组件已按阅读顺序移动。" : "组件位置或尺寸已调整。",
      );
    };
    const cancel = () => {
      drag.current = null;
      setGhost(null);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [engine, selection]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        (event.target as HTMLElement)?.closest(
          "input,textarea,select,[contenteditable]",
        )
      )
        return;
      const e = latest.current.engine,
        ids = latest.current.selection;
      if (!e) return;
      const mod = event.ctrlKey || event.metaKey;
      const invoke = (fn: () => unknown) => {
        event.preventDefault();
        run(fn);
      };
      if (mod && event.key.toLowerCase() === "s") invoke(() => undefined);
      else if (mod && event.key.toLowerCase() === "z")
        invoke(() => {
          event.shiftKey ? e.redo() : e.undo();
          setSelection([]);
        });
      else if (mod && event.key.toLowerCase() === "y")
        invoke(() => {
          e.redo();
          setSelection([]);
        });
      else if (mod && event.key.toLowerCase() === "g")
        invoke(() => (event.shiftKey ? e.ungroup(ids[0]) : e.group(ids)));
      else if (mod && event.key.toLowerCase() === "d")
        invoke(() => e.duplicate(ids));
      else if (
        (event.key === "Delete" || event.key === "Backspace") &&
        ids.length
      )
        invoke(() => e.remove(ids));
      else if (event.key === "Escape") {
        setSelection([]);
        drag.current = null;
        setGhost(null);
      } else if (
        ids.length &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
          event.key,
        ) &&
        e.element(ids[0])?.parentElement?.hasAttribute("data-xep-canvas")
      ) {
        const amount = event.shiftKey ? 10 : 1;
        invoke(() =>
          e.translate(
            ids,
            event.key === "ArrowLeft"
              ? -amount
              : event.key === "ArrowRight"
                ? amount
                : 0,
            event.key === "ArrowUp"
              ? -amount
              : event.key === "ArrowDown"
                ? amount
                : 0,
          ),
        );
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [engine]);
  function articleHtml() {
    if (!engine || !project) return "";
    return wrapArticle(
      exportArticle(studioCopy(engine.root)).html,
      project.width,
    );
  }
  const pageHtml = () =>
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>图文预览</title><body style="margin:0;background:white">${articleHtml()}</body></html>`;
  async function copyArticle() {
    setClipboardBusy(true);
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob(
            [await deliveryContent(engine!.root, project!.width)],
            { type: "text/html" },
          ),
          "text/plain": new Blob([engine?.root.textContent ?? ""], {
            type: "text/plain",
          }),
        }),
      ]);
      setMessage("已复制图文，到公众号正文编辑器粘贴后检查预览。");
    } catch {
      setMessage("复制失败，请下载 HTML 或检查剪贴板权限。");
    } finally {
      setClipboardBusy(false);
    }
  }
  async function readFile(f: File) {
    try {
      const content = await f.text();
      const next = f.name.endsWith(".json")
        ? readProject(JSON.parse(content))
        : blankProject(
            cleanStudioHtml(content),
            f.name.replace(/\.[^.]+$/, ""),
          );
      await switchProject(next);
      setMessage("工程已打开，后续修改自动保存在本机。");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function addImage(f: File) {
    if (!/^image\/(png|jpeg|gif|webp)$/.test(f.type) || f.size > 10_000_000) {
      setMessage("请选择不超过 10 MB 的 PNG/JPEG/GIF/WebP 图片。");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      run(
        () => engine!.image(reader.result as string, selected),
        "图片已插入并保存在本地工程中。",
      );
    reader.readAsDataURL(f);
  }
  const style = (key: string, value: string) =>
    engine && run(() => engine.style(selection, { [key]: value }));
  function rows(nodes: ComponentNode[], depth = 0): React.ReactNode {
    return nodes.map((n) => {
      const node = engine?.element(n.id),
        isGroup = node?.hasAttribute("data-xep-group"),
        canvas = node?.hasAttribute("data-xep-canvas");
      return (
        <React.Fragment key={n.id}>
          <div
            className={`st-layer ${selection.includes(n.id) ? "selected" : ""}`}
            style={{ paddingLeft: 10 + depth * 14 }}
            draggable
            onDragStart={(e) => {
              dragIds.current = selection.includes(n.id) ? selection : [n.id];
              e.dataTransfer.setData(
                "text/x-xep-nodes",
                JSON.stringify(dragIds.current),
              );
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("text/x-xep-nodes"))
                e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              run(() =>
                engine!.move(
                  dragIds.current,
                  n.id,
                  e.altKey ? "inside" : "before",
                ),
              );
            }}
          >
            <button
              className="st-expand"
              aria-label={`${collapsed.has(n.id) ? "展开" : "折叠"}${n.label}`}
              onClick={() =>
                setCollapsed((old) => {
                  const next = new Set(old);
                  next.has(n.id) ? next.delete(n.id) : next.add(n.id);
                  return next;
                })
              }
            >
              {n.children.length ? (
                collapsed.has(n.id) ? (
                  <ChevronRight size={12} />
                ) : (
                  <ChevronDown size={12} />
                )
              ) : null}
            </button>
            <button
              className="st-layer-name"
              onClick={(e) => {
                choose(n.id, e.ctrlKey || e.metaKey || e.shiftKey);
                node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
              }}
            >
              <span>
                {isGroup ? (
                  <Group size={14} />
                ) : canvas ? (
                  <Layers size={14} />
                ) : n.kind === "text" ? (
                  <Type size={14} />
                ) : n.kind === "image" ? (
                  <ImageIcon size={14} />
                ) : (
                  <Square size={14} />
                )}
              </span>
              <span>
                {node?.dataset.label ||
                  (isGroup ? "组合" : canvas ? "叠放画布" : n.label)}
              </span>
            </button>
            <button
              title={node?.dataset.xepLocked ? "解锁" : "锁定"}
              className="st-lock"
              onClick={() => run(() => engine!.lock(n.id))}
            >
              {node?.dataset.xepLocked ? (
                <Lock size={12} />
              ) : (
                <Unlock size={12} />
              )}
            </button>
          </div>
          {!collapsed.has(n.id) && rows(n.children, depth + 1)}
        </React.Fragment>
      );
    });
  }
  const insertions: [InsertKind, string][] = [
    ["text", "正文"],
    ["heading", "标题"],
    ["card", "组合卡片"],
    ["canvas", "叠放画布"],
    ["columns", "双列布局"],
    ["quote", "引用"],
    ["list", "列表"],
    ["divider", "分隔线"],
    ["table", "表格"],
  ];
  if (!project)
    return <div className="studio-loading">正在打开你的本地编辑台…</div>;
  return (
    <div className="studio">
      <header className="st-header">
        <div className="st-brand">
          <span>
            <Layers size={23} />
          </span>
          <div>
            秀米 PLUS<small>本地图文编辑台</small>
          </div>
        </div>
        <input
          className="st-title"
          aria-label="文章标题"
          value={project.title}
          onChange={(e) =>
            setProject({ ...project, title: e.target.value.slice(0, 80) })
          }
        />
        <span className="st-save">
          <Check size={13} />
          {saveState}
        </span>
        <div className="st-header-actions">
          <button
            onClick={() => setSettings(true)}
            title="手机预览与公众号连接"
          >
            <Settings size={16} />
            连接
          </button>
          <button onClick={() => setPreview(true)}>
            <Eye size={16} />
            预览 / 二维码
          </button>
          <button
            className="st-primary"
            disabled={clipboardBusy}
            onClick={copyArticle}
          >
            <Copy size={16} />
            复制到公众号
          </button>
        </div>
      </header>
      <div className="st-ribbon">
        <div className="st-ribbon-set">
          <button
            title="撤销 Ctrl+Z"
            disabled={!engine?.canUndo}
            onClick={() =>
              run(() => {
                engine!.undo();
                setSelection([]);
              })
            }
          >
            <Undo2 size={17} />
            <span>撤销</span>
          </button>
          <button
            title="重做 Ctrl+Y"
            disabled={!engine?.canRedo}
            onClick={() =>
              run(() => {
                engine!.redo();
                setSelection([]);
              })
            }
          >
            <Redo2 size={17} />
            <span>重做</span>
          </button>
        </div>
        <div className="st-ribbon-set">
          <button onClick={() => setImportOpen(true)}>
            <Upload size={17} />
            <span>粘贴导入</span>
          </button>
          <button onClick={() => file.current?.click()}>
            <Download size={17} />
            <span>打开工程</span>
          </button>
          <button
            onClick={() =>
              download(
                `${project.title}.xep.json`,
                projectFile({
                  ...project,
                  html: engine?.root.innerHTML ?? project.html,
                }),
                "application/json",
              )
            }
          >
            <Download size={17} />
            <span>备份工程</span>
          </button>
        </div>
        <div className="st-ribbon-set">
          <button onClick={() => run(() => engine!.insert("text", selected))}>
            <Type size={17} />
            <span>文字</span>
          </button>
          <button onClick={() => imageFile.current?.click()}>
            <ImageIcon size={17} />
            <span>图片</span>
          </button>
          <button onClick={() => run(() => engine!.insert("canvas", selected))}>
            <Layers size={17} />
            <span>叠放画布</span>
          </button>
        </div>
        <div className="st-ribbon-set">
          <button
            disabled={selection.length < 2}
            onClick={() =>
              run(
                () => engine!.group(selection),
                "已组合，可作为一个整体拖动。",
              )
            }
          >
            <Group size={17} />
            <span>组合</span>
          </button>
          <button
            disabled={!el?.hasAttribute("data-xep-group")}
            onClick={() => run(() => engine!.ungroup(selected))}
          >
            <Ungroup size={17} />
            <span>取消组合</span>
          </button>
          <button
            disabled={!selection.length}
            onClick={() => run(() => engine!.duplicate(selection))}
          >
            <Copy size={17} />
            <span>复制组件</span>
          </button>
          <button
            disabled={!selection.length}
            onClick={() => run(() => engine!.remove(selection))}
          >
            <Trash2 size={17} />
            <span>删除</span>
          </button>
        </div>
        <div className="st-ribbon-set">
          <button
            disabled={!selection.length}
            onClick={() => run(() => engine!.layer(selection, "front"))}
          >
            <BringToFront size={17} />
            <span>置顶</span>
          </button>
          <button
            disabled={!selection.length}
            onClick={() => run(() => engine!.layer(selection, "back"))}
          >
            <SendToBack size={17} />
            <span>置底</span>
          </button>
        </div>
      </div>
      <div className="st-body">
        <aside className="st-left">
          <div className="st-drafts">
            <select
              aria-label="本地草稿"
              value={project.id}
              onChange={(e) => {
                const next = library.find((p) => p.id === e.target.value);
                if (next) void switchProject(next);
              }}
            >
              <option value={project.id}>{project.title}</option>
              {library
                .filter((p) => p.id !== project.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
            </select>
            <button
              title="新建图文"
              onClick={() =>
                void switchProject(
                  blankProject(
                    "<h1>新的故事，从这里开始。</h1><p>双击这段文字开始编辑。</p>",
                    "新的图文",
                  ),
                )
              }
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="st-tabs">
            <button
              className={tab === "structure" ? "active" : ""}
              onClick={() => setTab("structure")}
            >
              <Layers size={14} />
              结构与图层
            </button>
            <button
              className={tab === "insert" ? "active" : ""}
              onClick={() => setTab("insert")}
            >
              <Plus size={14} />
              插入
            </button>
          </div>
          {tab === "structure" ? (
            <>
              <div className="st-tree-tip">
                Ctrl / ⌘ 多选 · 拖动树节点排序
                <br />
                Alt 拖放可移入容器；父子关系与遮挡顺序分别调整。
              </div>
              <div className="st-tree">{rows(tree)}</div>
            </>
          ) : (
            <div className="st-insert-grid">
              {insertions.map(([kind, label]) => (
                <button
                  key={kind}
                  onClick={() => run(() => engine!.insert(kind, selected))}
                >
                  <LayoutTemplate size={24} />
                  {label}
                </button>
              ))}
              <button onClick={() => imageFile.current?.click()}>
                <ImageIcon size={24} />
                本地图片
              </button>
            </div>
          )}
          <div className="st-local-note">
            <span className="st-dot" /> 自动保存在当前浏览器
            <br />
            下载工程可跨设备继续编辑。
          </div>
        </aside>
        <main className="st-center">
          <div className="st-canvas-bar">
            <span>
              <MousePointer2 size={14} /> 直接选择与拖动
            </span>
            <label>
              文章宽度{" "}
              <select
                aria-label="文章宽度"
                value={project.width}
                onChange={(e) =>
                  setProject({ ...project, width: Number(e.target.value) })
                }
              >
                <option value={375}>375 px</option>
                <option value={390}>390 px</option>
                <option value={450}>450 px</option>
                <option value={600}>600 px</option>
                <option value={750}>750 px</option>
              </select>
            </label>
          </div>
          <div
            className="st-stage"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelection([]);
            }}
          >
            <article
              ref={article}
              className="studio-paper"
              data-testid="studio-paper"
              style={{ width: project.width }}
              dangerouslySetInnerHTML={html}
              onPointerDown={(e) => startDrag(e)}
              onClick={(e) => {
                if ((e.target as Element).closest("a")) e.preventDefault();
              }}
              onDoubleClick={(e) => {
                const id = targetId(e.target, true);
                if (id) {
                  choose(id);
                  if (engine?.propertyCapability(id, "text").allowed)
                    setRichId(id);
                }
              }}
            />
            <div className="st-paper-foot">XIUMI PLUS / LOCAL STUDIO</div>
          </div>
        </main>
        <aside className="st-properties">
          <div className="st-prop-heading">
            <span>组件属性</span>
            <small>
              {selection.length
                ? `已选择 ${selection.length} 项`
                : "选择一个组件"}
            </small>
          </div>
          {el && engine ? (
            <div className="st-prop-scroll" key={`${selected}-${formVersion}`}>
              <label className="st-field">
                名称
                <input
                  aria-label="组件名称"
                  defaultValue={el.dataset.label ?? ""}
                  placeholder={
                    kindNames[
                      tree.find((n) => n.id === selected)?.kind ?? "layout"
                    ]
                  }
                  onBlur={(e) => {
                    if (
                      e.target.value !== el.dataset.label &&
                      e.target.value.trim()
                    )
                      run(() => engine.rename(selected, e.target.value));
                  }}
                />
              </label>
              <div className="st-position-mode">
                {el.parentElement?.hasAttribute("data-xep-canvas") ? (
                  <>
                    <Move size={14} />
                    叠放画布内 · 自由移动
                  </>
                ) : (
                  <>
                    <GripVertical size={14} />
                    普通图文 · 拖动改变阅读顺序
                  </>
                )}
              </div>
              <h3>层次与位置</h3>
              <div className="st-button-grid">
                <button
                  onClick={() => run(() => engine.layer(selection, "up"))}
                >
                  <ArrowUp size={14} />
                  上移一层
                </button>
                <button
                  onClick={() => run(() => engine.layer(selection, "down"))}
                >
                  <ArrowDown size={14} />
                  下移一层
                </button>
                <button
                  onClick={() => run(() => engine.layer(selection, "front"))}
                >
                  置于顶层
                </button>
                <button
                  onClick={() => run(() => engine.layer(selection, "back"))}
                >
                  置于底层
                </button>
              </div>
              <p className="st-help">
                前后层级作用于同一父容器。需要重叠时，将容器转换为叠放画布。
              </p>
              {el.parentElement?.hasAttribute("data-xep-canvas") && (
                <div className="st-two">
                  {(["left", "top"] as const).map((axis, i) => (
                    <label key={axis}>
                      {i ? "Y" : "X"}
                      <input
                        aria-label={i ? "Y 坐标" : "X 坐标"}
                        type="number"
                        defaultValue={parseFloat(el.style[axis]) || 0}
                        onBlur={(e) => {
                          const x = i
                              ? parseFloat(el.style.left) || 0
                              : Number(e.target.value),
                            y = i
                              ? Number(e.target.value)
                              : parseFloat(el.style.top) || 0;
                          run(() => engine.position(selected, x, y));
                        }}
                      />
                    </label>
                  ))}
                </div>
              )}
              <div className="st-two">
                <label>
                  宽度
                  <input
                    aria-label="组件宽度"
                    defaultValue={el.style.width || "auto"}
                    onBlur={(e) => style("width", e.target.value)}
                  />
                </label>
                <label>
                  高度
                  <input
                    aria-label="组件高度"
                    defaultValue={el.style.height || "auto"}
                    onBlur={(e) => style("height", e.target.value)}
                  />
                </label>
              </div>
              <div className="st-button-grid">
                {[
                  "左对齐",
                  "水平居中",
                  "右对齐",
                  "顶对齐",
                  "垂直居中",
                  "底对齐",
                ].map((name, i) => (
                  <button
                    key={name}
                    onClick={() =>
                      run(() =>
                        engine.align(
                          selection,
                          (
                            [
                              "left",
                              "center",
                              "right",
                              "top",
                              "middle",
                              "bottom",
                            ] as const
                          )[i],
                        ),
                      )
                    }
                  >
                    {name}
                  </button>
                ))}
              </div>
              {el.matches("section,div") && (
                <div className="st-button-grid">
                  <button
                    onClick={() =>
                      run(
                        () => engine.canvas(selected),
                        "已转换为叠放画布，可自由拖动内部所有组件。",
                      )
                    }
                  >
                    转换叠放画布
                  </button>
                  <button
                    onClick={() =>
                      run(() => engine.flow(selected), "已恢复普通阅读流。")
                    }
                  >
                    恢复普通布局
                  </button>
                </div>
              )}
              {el.matches("section,div") && (
                <>
                  <h3>容器布局</h3>
                  <div className="st-button-grid">
                    <button onClick={() => style("display", "block")}>
                      纵向排列
                    </button>
                    <button
                      onClick={() =>
                        run(() =>
                          engine.style(selection, {
                            display: "flex",
                            gap: "12px",
                          }),
                        )
                      }
                    >
                      横向排列
                    </button>
                    <button
                      onClick={() =>
                        run(() =>
                          engine.style(selection, {
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "12px",
                          }),
                        )
                      }
                    >
                      双列网格
                    </button>
                    <button
                      onClick={() =>
                        run(() =>
                          engine.style(selection, {
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr",
                            gap: "12px",
                          }),
                        )
                      }
                    >
                      三列网格
                    </button>
                  </div>
                  <label className="st-field">
                    组件间距
                    <input
                      aria-label="组件间距"
                      defaultValue={el.style.gap || "12px"}
                      onBlur={(e) => style("gap", e.target.value)}
                    />
                  </label>
                </>
              )}
              <h3>颜色与外观</h3>
              <div className="st-color-row">
                {(["backgroundColor", "color", "borderColor"] as const).map(
                  (key, i) => (
                    <label key={key}>
                      {["背景", "文字", "边框"][i]}
                      <input
                        aria-label={["背景颜色", "文字颜色", "边框颜色"][i]}
                        type="color"
                        defaultValue={hexColor(
                          computed?.[key] ?? "",
                          i ? "#263d36" : "#ffffff",
                        )}
                        onChange={(e) => style(key, e.target.value)}
                      />
                    </label>
                  ),
                )}
              </div>
              <div className="st-two">
                <label>
                  内边距
                  <input
                    aria-label="内边距"
                    defaultValue={el.style.padding || "0px"}
                    onBlur={(e) => style("padding", e.target.value)}
                  />
                </label>
                <label>
                  外边距
                  <input
                    aria-label="外边距"
                    defaultValue={el.style.margin || "0px"}
                    onBlur={(e) => style("margin", e.target.value)}
                  />
                </label>
                <label>
                  圆角
                  <input
                    aria-label="圆角"
                    defaultValue={el.style.borderRadius || "0px"}
                    onBlur={(e) => style("borderRadius", e.target.value)}
                  />
                </label>
                <label>
                  边框宽度
                  <input
                    aria-label="边框宽度"
                    defaultValue={el.style.borderWidth || "0px"}
                    onBlur={(e) => {
                      if (engine)
                        run(() =>
                          engine.style(selection, {
                            borderWidth: e.target.value,
                            borderStyle: "solid",
                          }),
                        );
                    }}
                  />
                </label>
                <label>
                  透明度
                  <input
                    aria-label="透明度"
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    defaultValue={computed?.opacity || 1}
                    onBlur={(e) => style("opacity", e.target.value)}
                  />
                </label>
                <label>
                  旋转角度
                  <input
                    aria-label="旋转角度"
                    type="number"
                    defaultValue={
                      parseFloat(el.style.transform.replace("rotate(", "")) || 0
                    }
                    onBlur={(e) =>
                      style(
                        "transform",
                        `rotate(${Number(e.target.value) || 0}deg)`,
                      )
                    }
                  />
                </label>
              </div>
              {computed?.backgroundImage !== "none" &&
                computed?.backgroundImage && (
                  <button
                    className="st-wide"
                    onClick={() => style("backgroundImage", "none")}
                  >
                    移除背景图 / 渐变
                  </button>
                )}
              {engine.propertyCapability(selected, "text").allowed && (
                <>
                  <h3>文字排版</h3>
                  <button
                    className="st-wide"
                    onClick={() => setRichId(selected)}
                  >
                    直接编辑文字与选区格式
                  </button>
                  <select
                    aria-label="字体"
                    defaultValue={el.style.fontFamily || fonts[0]}
                    onChange={(e) => style("fontFamily", e.target.value)}
                  >
                    {fonts.map((f, i) => (
                      <option key={f} value={f}>
                        {fontNames[i]}
                      </option>
                    ))}
                  </select>
                  <div className="st-two">
                    <label>
                      字号
                      <input
                        aria-label="字号"
                        type="number"
                        defaultValue={parseFloat(computed?.fontSize || "16")}
                        onBlur={(e) =>
                          style("fontSize", `${Number(e.target.value) || 16}px`)
                        }
                      />
                    </label>
                    <label>
                      行高
                      <input
                        aria-label="行高"
                        defaultValue={el.style.lineHeight || "1.8"}
                        onBlur={(e) => style("lineHeight", e.target.value)}
                      />
                    </label>
                    <label>
                      字间距
                      <input
                        aria-label="字间距"
                        defaultValue={el.style.letterSpacing || "0px"}
                        onBlur={(e) => style("letterSpacing", e.target.value)}
                      />
                    </label>
                    <label>
                      首行缩进
                      <input
                        aria-label="首行缩进"
                        defaultValue={el.style.textIndent || "0em"}
                        onBlur={(e) => style("textIndent", e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="st-button-grid">
                    <button
                      onClick={() =>
                        style(
                          "fontWeight",
                          computed?.fontWeight === "700" ? "400" : "700",
                        )
                      }
                    >
                      <b>B 加粗</b>
                    </button>
                    <button
                      onClick={() =>
                        style(
                          "fontStyle",
                          computed?.fontStyle === "italic"
                            ? "normal"
                            : "italic",
                        )
                      }
                    >
                      <i>I 斜体</i>
                    </button>
                    <button
                      onClick={() =>
                        style(
                          "textDecoration",
                          computed?.textDecorationLine.includes("underline")
                            ? "none"
                            : "underline",
                        )
                      }
                    >
                      <u>U 下划线</u>
                    </button>
                    <button
                      onClick={() => style("textDecoration", "line-through")}
                    >
                      删除线
                    </button>
                  </div>
                  <div className="st-button-grid">
                    {["left", "center", "right", "justify"].map((v, i) => (
                      <button key={v} onClick={() => style("textAlign", v)}>
                        {["左对齐", "居中", "右对齐", "两端对齐"][i]}
                      </button>
                    ))}
                  </div>
                  <label className="st-field">
                    段落内容
                    <textarea
                      ref={textArea}
                      aria-label="段落文字"
                      value={text}
                      rows={5}
                      onChange={(e) => setText(e.target.value)}
                    />
                  </label>
                  <button
                    className="st-primary st-wide"
                    onClick={() =>
                      run(
                        () => engine.setText(selected, text),
                        "段落文字已更新。",
                      )
                    }
                  >
                    应用文字
                  </button>
                  <p className="st-help">
                    保留未修改部分的链接和格式。跨格式修改后请检查。
                  </p>
                </>
              )}
              {el.tagName === "IMG" && (
                <>
                  <h3>图片</h3>
                  <button
                    className="st-wide"
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept =
                        "image/png,image/jpeg,image/gif,image/webp";
                      input.onchange = () => {
                        const f = input.files?.[0];
                        if (!f || f.size > 10_000_000) return;
                        const reader = new FileReader();
                        reader.onload = () =>
                          run(() =>
                            engine.replaceImage(
                              selected,
                              reader.result as string,
                            ),
                          );
                        reader.readAsDataURL(f);
                      };
                      input.click();
                    }}
                  >
                    替换所选图片
                  </button>
                  <select
                    aria-label="图片裁切"
                    defaultValue={el.style.objectFit || "contain"}
                    onChange={(e) => style("objectFit", e.target.value)}
                  >
                    <option value="contain">完整显示</option>
                    <option value="cover">填满裁切</option>
                    <option value="fill">拉伸填充</option>
                  </select>
                </>
              )}
              <h3>链接</h3>
              <label className="st-field">
                <input
                  aria-label="链接地址"
                  placeholder="https://…"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                />
              </label>
              <button
                className="st-wide"
                onClick={() => run(() => engine.link(selected, link))}
              >
                <LinkIcon size={13} />
                应用链接（留空移除）
              </button>
              <h3>结构操作</h3>
              <div className="st-button-grid">
                <button
                  disabled={!engine.capability(selected, "promote").allowed}
                  onClick={() => run(() => engine.execute(selected, "promote"))}
                >
                  提升到父层
                </button>
                <button
                  disabled={!engine.capability(selected, "unwrap").allowed}
                  onClick={() => {
                    if (
                      confirm(
                        "拆分外壳会移除它的背景、边框与间距。是否保留内部内容并继续？",
                      )
                    )
                      run(() => engine.execute(selected, "unwrap"));
                  }}
                >
                  拆分外壳
                </button>
              </div>
              <p className="st-help">
                字体取决于设备；SVG 互动组件仅保留预览，暂不拆解。
              </p>
            </div>
          ) : (
            <div className="st-empty">
              <MousePointer2 size={32} />
              <h3>先选择，再精修</h3>
              <p>
                点击正文、图片或背景板。
                <br />
                按住 Ctrl / ⌘ 可以多选组合。
              </p>
              <button onClick={() => run(() => engine!.insert("canvas"))}>
                插入叠放画布体验图层
              </button>
            </div>
          )}
        </aside>
      </div>
      <footer className="st-status" role="status">
        <span className="st-dot" />
        {message}
        <span className="st-status-right">
          {selection.length} 项已选 · Ctrl+G 组合 · Alt 点击深入组合
        </span>
      </footer>
      {boxes.map((b) => (
        <div
          key={b.id}
          className="st-selection"
          style={{ left: b.x, top: b.y, width: b.width, height: b.height }}
        >
          <button
            aria-label="拖动所选组件"
            className="st-drag-handle"
            onPointerDown={(e) => startDrag(e, b.id)}
          >
            <GripVertical size={12} />
          </button>
          <button
            aria-label="调整组件尺寸"
            className="st-resize-handle"
            onPointerDown={(e) => startDrag(e, b.id, true)}
          />
        </div>
      ))}
      {ghost && (
        <div
          className="st-drag-ghost"
          style={{
            left: ghost.x,
            top: ghost.y,
            width: ghost.width,
            height: ghost.height,
          }}
        />
      )}
      <input
        ref={file}
        hidden
        type="file"
        accept=".json,.html,.htm"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void readFile(f);
          e.target.value = "";
        }}
      />
      <input
        ref={imageFile}
        hidden
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void addImage(f);
          e.target.value = "";
        }}
      />
      {richId && engine?.element(richId) && (
        <RichTextDialog
          html={engine.element(richId)!.innerHTML}
          onClose={() => setRichId(null)}
          onApply={(html) => {
            run(() => engine.setRichText(richId, html));
            setRichId(null);
          }}
        />
      )}
      {importOpen && (
        <ImportDialog
          onClose={() => setImportOpen(false)}
          onImport={(imported) => {
            void switchProject(blankProject(imported.html, "导入的图文"));
            setImportOpen(false);
            setMessage("已导入副本，编辑会自动保存在本机。");
          }}
        />
      )}
      {(preview || settings) && (
        <DeliveryDialog
          settingsFirst={settings}
          onClose={() => {
            setPreview(false);
            setSettings(false);
          }}
          html={pageHtml()}
          getContent={() => deliveryContent(engine!.root, project.width)}
          title={project.title}
          onDownload={() => {
            void deliveryContent(engine!.root, project.width)
              .then((content) =>
                download(
                  `${project.title}.html`,
                  `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0">${content}</body></html>`,
                ),
              )
              .catch((error) => setMessage(error.message));
          }}
        />
      )}
    </div>
  );
}

function DeliveryDialog({
  onClose,
  html,
  getContent,
  title,
  onDownload,
  settingsFirst,
}: {
  onClose: () => void;
  html: string;
  getContent: () => Promise<string>;
  title: string;
  onDownload: () => void;
  settingsFirst: boolean;
}) {
  const [mode, setMode] = useState<"preview" | "connect">(
      settingsFirst ? "connect" : "preview",
    ),
    [token, setToken] = useState(
      () => sessionStorage.getItem("xep-bridge-token") ?? "",
    ),
    [status, setStatus] = useState<{
      wechat: boolean;
      previewBases: string[];
    } | null>(null),
    [qr, setQr] = useState(""),
    [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [appid, setAppid] = useState(""),
    [secret, setSecret] = useState(""),
    [cover, setCover] = useState(""),
    [base, setBase] = useState(""),
    [author, setAuthor] = useState("");
  const iframe = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (!token) return;
    let live = true;
    void browser.permissions
      .contains({ origins: ["http://127.0.0.1/*"] })
      .then(async (allowed) => {
        if (!allowed) return;
        const data = await api("/status");
        if (live) {
          setStatus(data);
          setBase(data.previewBases[0] ?? "");
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  async function api(path: string, body?: unknown) {
    const res = await fetch(`http://127.0.0.1:4318${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "本地服务未响应");
    return data;
  }
  async function connect() {
    setBusy(true);
    setError("");
    try {
      const allowed = await browser.permissions.request({
        origins: ["http://127.0.0.1/*"],
      });
      if (!allowed)
        throw new Error("需要允许连接本机服务才能生成手机二维码或同步。");
      const data = await api("/status");
      setStatus(data);
      setBase(data.previewBases[0] ?? "");
      sessionStorage.setItem("xep-bridge-token", token);
      setError("已连接本机服务。");
    } catch (e) {
      setError(
        `连接失败：${(e as Error).message}。请先按操作手册启动本地服务。`,
      );
    } finally {
      setBusy(false);
    }
  }
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="st-modal-backdrop">
      <section className="st-delivery" role="dialog" aria-label="预览与同步">
        <header>
          <h2>预览与交付</h2>
          <button aria-label="关闭预览" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <div className="st-delivery-tabs">
          <button
            className={mode === "preview" ? "active" : ""}
            onClick={() => setMode("preview")}
          >
            手机预览
          </button>
          <button
            className={mode === "connect" ? "active" : ""}
            onClick={() => setMode("connect")}
          >
            连接与同步
          </button>
          <button onClick={onDownload}>下载 HTML</button>
          <button onClick={() => iframe.current?.contentWindow?.print()}>
            打印 / PDF
          </button>
        </div>
        <div className="st-delivery-body">
          {mode === "preview" ? (
            <>
              <iframe
                ref={iframe}
                title="图文手机预览"
                sandbox="allow-same-origin allow-modals"
                srcDoc={html}
              />
              <div className="st-preview-info">
                <h3>让手机也看一眼</h3>
                <p>当前为网页预览，公众号最终样式仍以微信预览为准。</p>
                {status ? (
                  <>
                    <label>
                      手机访问地址
                      <select
                        value={base}
                        onChange={(e) => setBase(e.target.value)}
                      >
                        {status.previewBases.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="st-primary"
                      disabled={busy || !base}
                      onClick={() =>
                        void action(async () => {
                          const data = await api("/previews", {
                            html: await getContent(),
                            title,
                            base,
                          });
                          setUrl(data.url);
                          setQr(
                            await QRCode.toDataURL(data.url, {
                              width: 240,
                              margin: 2,
                              errorCorrectionLevel: "M",
                            }),
                          );
                        })
                      }
                    >
                      生成预览二维码
                    </button>
                    {qr && (
                      <>
                        <img className="st-qr" alt="手机预览二维码" src={qr} />
                        <a href={url} target="_blank" rel="noreferrer">
                          打开预览页面
                        </a>
                        <small>
                          一小时后过期。同一 Wi-Fi 下访问；服务需以 --lan 启动。
                        </small>
                        <button
                          onClick={() =>
                            void action(async () => {
                              await api("/previews/revoke", { url });
                              setQr("");
                              setUrl("");
                              setError("预览已撤销。");
                            })
                          }
                        >
                          撤销此预览
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <button onClick={() => setMode("connect")}>
                    先连接本机预览服务
                  </button>
                )}
                <p>
                  二维码需要手机可访问的地址，无法直接指向扩展页面或本机临时文件。
                </p>
              </div>
            </>
          ) : (
            <div className="st-connection">
              <h3>一次连接，预览与草稿同步</h3>
              <p>
                在项目目录运行 <code>npm run bridge -- --lan</code>
                ，将终端显示的配对码粘贴到这里。服务仅在你本机运行。
              </p>
              <label>
                本机配对码
                <input
                  aria-label="本机配对码"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <button
                className="st-primary"
                disabled={busy || !token}
                onClick={connect}
              >
                连接本地服务
              </button>
              {status && (
                <>
                  <hr />
                  <h3>公众号草稿箱</h3>
                  <p>
                    需要公众号后台的接口权限及 IP
                    白名单。仅新建草稿，不群发，不发布，也不覆盖秀米原稿。
                  </p>
                  <label>
                    AppID
                    <input
                      aria-label="公众号 AppID"
                      value={appid}
                      onChange={(e) => setAppid(e.target.value)}
                      autoComplete="off"
                    />
                  </label>
                  <label>
                    AppSecret
                    <input
                      aria-label="公众号 AppSecret"
                      type="password"
                      value={secret}
                      onChange={(e) => setSecret(e.target.value)}
                      autoComplete="off"
                    />
                  </label>
                  <button
                    disabled={busy || !appid || !secret}
                    onClick={() =>
                      void action(async () => {
                        await api("/config", { appid, secret });
                        setSecret("");
                        setStatus({ ...status, wechat: true });
                        setError("已在本机服务内存中配置；服务关闭后失效。");
                      })
                    }
                  >
                    设置公众号连接
                  </button>
                  <label>
                    封面图片 / 已有素材 ID
                    <input
                      aria-label="封面素材 ID"
                      value={
                        cover.startsWith("data:") ? "已选择本地封面图片" : cover
                      }
                      onChange={(e) => setCover(e.target.value)}
                      placeholder="已有素材 ID，或填写封面图片 HTTPS 地址"
                    />
                  </label>
                  <button
                    onClick={() => {
                      const file = document.createElement("input");
                      file.type = "file";
                      file.accept = "image/png,image/jpeg";
                      file.onchange = () => {
                        const f = file.files?.[0];
                        if (!f || f.size > 10_000_000) {
                          setError("请选择不超过 10 MB 的 PNG/JPEG 封面。");
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => setCover(reader.result as string);
                        reader.readAsDataURL(f);
                      };
                      file.click();
                    }}
                  >
                    选择本地封面图片
                  </button>
                  <label>
                    作者（可选）
                    <input
                      value={author}
                      maxLength={16}
                      onChange={(e) => setAuthor(e.target.value)}
                    />
                  </label>
                  <button
                    className="st-primary"
                    disabled={busy || !status.wechat || !cover}
                    onClick={() =>
                      void action(async () => {
                        const result = await api("/wechat/drafts", {
                          title,
                          html: await getContent(),
                          cover,
                          author,
                        });
                        setError(
                          `已新建公众号草稿，素材 ID：${result.media_id}。请到公众号后台核对并手机预览。`,
                        );
                      })
                    }
                  >
                    一键同步到公众号草稿箱
                  </button>
                  <small>
                    接口已实现；在真实公众号成功同步前，不标记为账号兼容通过。素材上传中断或超时后请先检查草稿箱，再决定是否重试。
                  </small>
                </>
              )}
            </div>
          )}
        </div>
        {error && (
          <p className="st-delivery-message" role="status">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
