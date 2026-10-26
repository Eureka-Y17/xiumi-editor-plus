import React, { useEffect, useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  Move,
  GripVertical,
  Type,
  Image as ImageIcon,
  Link as LinkIcon,
} from "lucide-react";
import { StudioEngine } from "./studio-engine";
import { hexColor } from "./appearance";
const classics = [
  ["奶油白", "#f9f5e1"],
  ["纯白", "#ffffff"],
  ["松绿", "#217c61"],
  ["棕金", "#9b5414"],
  ["墨灰", "#333333"],
  ["浅杏", "#e5c598"],
  ["雾蓝", "#b7c9d2"],
  ["豆沙", "#d9a5a5"],
];
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
type Tab =
  | "order"
  | "position"
  | "layout"
  | "color"
  | "text"
  | "image"
  | "link"
  | "structure";
type Props = {
  engine: StudioEngine;
  selection: string[];
  version: number;
  run: (fn: () => unknown, message?: string) => void;
  onChoose: (id: string) => void;
  text: string;
  onText: (text: string) => void;
  link: string;
  onLink: (link: string) => void;
  onRichEdit: (id: string) => void;
};
export function StudioProperties({
  engine,
  selection,
  version,
  run,
  onChoose,
  text,
  onText,
  link,
  onLink,
  onRichEdit,
}: Props) {
  const [tab, setTab] = useState<Tab>("order"),
    [textTab, setTextTab] = useState<"content" | "format">("content");
  const id = selection[0],
    el = id ? engine.element(id) : undefined,
    s = el ? getComputedStyle(el) : null;
  const textCap = el
    ? engine.propertyCapability(id, "text")
    : { allowed: false, reason: "请选择文字段。" };
  const canvas = !!el?.parentElement?.hasAttribute("data-xep-canvas");
  useEffect(() => {
    if (
      (tab === "text" && !textCap.allowed) ||
      (tab === "image" && el?.tagName !== "IMG")
    )
      setTab("order");
  }, [id, version]);
  const style = (key: string, value: string) =>
    run(() => engine.style(selection, { [key]: value }));
  const order = (direction: "up" | "down") =>
    run(
      () => {
        const moved = engine.order(selection, direction);
        if (moved[0]) onChoose(moved[0]);
      },
      direction === "up"
        ? "已向文章前方移动整块内容。"
        : "已向文章后方移动整块内容。",
    );
  const field = (label: string, key: string, initial: string) => (
    <label>
      {label}
      <input
        aria-label={label}
        defaultValue={initial}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        onBlur={(e) => {
          if (e.target.value !== initial) style(key, e.target.value);
        }}
      />
    </label>
  );
  const layer = (action: "up" | "down" | "front" | "back", label: string) => {
    const cap = engine.layerCapability(selection, action);
    return (
      <button
        disabled={!cap.allowed}
        title={cap.reason}
        onClick={() =>
          run(
            () => engine.layer(selection, action),
            "已调整前后遮挡；文章上下位置不变。",
          )
        }
      >
        {label}
      </button>
    );
  };
  const tabs: [Tab, string][] = [
    ["order", "顺序"],
    ["position", "位置"],
    ["layout", "布局"],
    ["color", "色彩"],
    ["text", "文字"],
    ["image", "图片"],
    ["link", "链接"],
    ["structure", "结构"],
  ];
  return (
    <aside className="st-properties">
      <div className="st-prop-heading">
        <span>组件属性</span>
        <small>
          {selection.length ? `已选择 ${selection.length} 项` : "选择一个组件"}
        </small>
      </div>
      <div className="st-prop-tabs" role="tablist" aria-label="组件属性分类">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            disabled={
              (key === "text" && !textCap.allowed) ||
              (key === "image" && el?.tagName !== "IMG")
            }
            title={
              key === "text"
                ? "文字内容与段落排版"
                : key === "image"
                  ? "请选择普通图片"
                  : label
            }
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {!el ? (
        <div className="st-empty">
          <Move size={30} />
          <h3>先选择，再精修</h3>
          <p>
            点击文章中的内容，
            <br />
            左侧会自动定位对应结构。
          </p>
        </div>
      ) : (
        <div
          className="st-prop-page"
          role="tabpanel"
          aria-label={`${tabs.find((t) => t[0] === tab)?.[1]}属性`}
        >
          {tab === "color" ? (
            <Colors
              engine={engine}
              id={id}
              ids={selection}
              version={version}
              run={run}
            />
          ) : (
            <div key={`${id}-${version}-${tab}`}>
              {tab === "order" && (
                <>
                  <label className="st-field">
                    组件名称
                    <input
                      aria-label="组件名称"
                      defaultValue={el.dataset.label ?? ""}
                      placeholder="为组件命名"
                      onBlur={(e) => {
                        if (
                          e.target.value.trim() &&
                          e.target.value !== el.dataset.label
                        )
                          run(() => engine.rename(id, e.target.value));
                      }}
                    />
                  </label>
                  <div className="st-position-mode">
                    {canvas ? (
                      <>
                        <Move size={14} />
                        画布内组件
                      </>
                    ) : (
                      <>
                        <GripVertical size={14} />
                        普通图文组件
                      </>
                    )}
                  </div>
                  <h3>文章阅读顺序</h3>
                  <div className="st-button-grid">
                    <button
                      disabled={
                        !engine.orderCapability(selection, "up").allowed
                      }
                      title={engine.orderCapability(selection, "up").reason}
                      onClick={() => order("up")}
                    >
                      <ArrowUp size={14} />
                      向前移动
                    </button>
                    <button
                      disabled={
                        !engine.orderCapability(selection, "down").allowed
                      }
                      title={engine.orderCapability(selection, "down").reason}
                      onClick={() => order("down")}
                    >
                      <ArrowDown size={14} />
                      向后移动
                    </button>
                  </div>
                  <p className="st-help">
                    优先与当前同级组件交换顺序；没有同级时才移动外层块。横排中的同级互换会改变左右位置。
                  </p>
                  <h3>前后遮挡（不移动上下位置）</h3>
                  <div className="st-button-grid">
                    {layer("up", "上移一层")}
                    {layer("down", "下移一层")}
                    {layer("front", "置于顶层")}
                    {layer("back", "置于底层")}
                  </div>
                  <p className="st-help" data-testid="layer-explanation">
                    {canvas
                      ? "同一画布内调整谁盖住谁，不会改变文章阅读顺序。"
                      : engine.layerCapability(selection, "up").reason}
                  </p>
                </>
              )}
              {tab === "structure" && (
                <>
                  <h3>结构与插入</h3>
                  <div className="st-button-grid">
                    <button
                      onClick={() =>
                        run(
                          () => engine.insert("blank", id, "before"),
                          "已在所选图文块前插入空行。",
                        )
                      }
                    >
                      前插空行
                    </button>
                    <button
                      onClick={() =>
                        run(
                          () => engine.insert("blank", id, "after"),
                          "已在所选图文块后插入空行。",
                        )
                      }
                    >
                      后插空行
                    </button>
                    <button
                      disabled={!engine.capability(id, "promote").allowed}
                      title={engine.capability(id, "promote").reason}
                      onClick={() => run(() => engine.execute(id, "promote"))}
                    >
                      提升到父层
                    </button>
                    <button
                      disabled={!engine.capability(id, "unwrap").allowed}
                      title={engine.capability(id, "unwrap").reason}
                      onClick={() => {
                        if (
                          confirm("拆分外壳会移除背景、边框和间距，是否继续？")
                        )
                          run(() => engine.execute(id, "unwrap"));
                      }}
                    >
                      拆分外壳
                    </button>
                    <button
                      disabled={el.parentElement === engine.root}
                      onClick={() => {
                        const parent = engine.idFor(el.parentElement!);
                        if (parent) onChoose(parent);
                      }}
                    >
                      选择父层
                    </button>
                    <button
                      disabled={!el.firstElementChild}
                      onClick={() => {
                        const child = el.firstElementChild
                          ? engine.idFor(el.firstElementChild)
                          : null;
                        if (child) onChoose(child);
                      }}
                    >
                      选择子层
                    </button>
                  </div>
                </>
              )}
              {tab === "position" && (
                <>
                  <h3>组件尺寸</h3>
                  <div className="st-two">
                    {field("组件宽度", "width", el.style.width || "auto")}
                    {field("组件高度", "height", el.style.height || "auto")}
                  </div>
                  {canvas && (
                    <div className="st-two">
                      {(["left", "top"] as const).map((axis, i) => (
                        <label key={axis}>
                          {i ? "Y 坐标" : "X 坐标"}
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
                              run(() => engine.position(id, x, y));
                            }}
                          />
                        </label>
                      ))}
                    </div>
                  )}
                  <h3>组件对齐 · 相对于父容器</h3>
                  <div className="st-button-grid">
                    {(
                      [
                        "left",
                        "center",
                        "right",
                        "top",
                        "middle",
                        "bottom",
                      ] as const
                    ).map((axis, i) => {
                      const cap = engine.alignmentCapability(selection, axis);
                      return (
                        <button
                          key={axis}
                          disabled={!cap.allowed}
                          title={cap.reason}
                          onClick={() =>
                            run(
                              () => engine.align(selection, axis),
                              "已将整个组件相对于父容器对齐。",
                            )
                          }
                        >
                          {
                            [
                              "组件靠左",
                              "组件水平居中",
                              "组件靠右",
                              "组件靠上",
                              "组件垂直居中",
                              "组件靠下",
                            ][i]
                          }
                        </button>
                      );
                    })}
                  </div>
                  <p className="st-help" data-testid="alignment-explanation">
                    {engine.alignmentCapability(selection, "center").reason}{" "}
                    {!canvas &&
                      "上下对齐仅用于叠放画布；文字对齐在“文字”分类中。"}
                  </p>
                  <h3>旋转与透明度</h3>
                  <div className="st-two">
                    <label>
                      旋转角度
                      <input
                        aria-label="旋转角度"
                        type="number"
                        defaultValue={
                          parseFloat(
                            el.style.transform.replace("rotate(", ""),
                          ) || 0
                        }
                        onBlur={(e) =>
                          style(
                            "transform",
                            `rotate(${Number(e.target.value) || 0}deg)`,
                          )
                        }
                      />
                    </label>
                    {field("透明度", "opacity", s?.opacity || "1")}
                  </div>
                  <p className="st-help">
                    尺寸和边距只填数字会按像素处理，亦支持 %、auto。透明度 0–1。
                  </p>
                </>
              )}
              {tab === "layout" && (
                <>
                  <h3>容器排列方式</h3>
                  {el.matches("section,div") ? (
                    <>
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
                      <div className="st-two">
                        {field("组件间距", "gap", el.style.gap || "12px")}
                        {field("内边距", "padding", el.style.padding || "0px")}
                        {field("外边距", "margin", el.style.margin || "0px")}
                      </div>
                      <h3>自由叠放</h3>
                      <div className="st-button-grid">
                        <button
                          disabled={el.hasAttribute("data-xep-canvas")}
                          onClick={() =>
                            run(
                              () => engine.canvas(id),
                              "容器已转换为叠放画布。",
                            )
                          }
                        >
                          转换叠放画布
                        </button>
                        <button
                          disabled={!el.hasAttribute("data-xep-canvas")}
                          onClick={() =>
                            run(() => engine.flow(id), "已恢复普通阅读流。")
                          }
                        >
                          恢复普通布局
                        </button>
                      </div>
                      {el.hasAttribute("data-xep-canvas") && (
                        <button
                          className="st-wide"
                          onClick={() =>
                            run(
                              () => engine.insert("text", id, "inside"),
                              "已明确在画布内加入文字，可自由拖动。",
                            )
                          }
                        >
                          在此画布内添加文字
                        </button>
                      )}
                      <p className="st-help">
                        上方“文字”默认在图文块下方插入。只有这里的“画布内添加文字”会创建自由定位的文字。
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="st-help">
                        请选择布局或组合容器修改排列方式。
                      </p>
                      <div className="st-two">
                        {field("内边距", "padding", el.style.padding || "0px")}
                        {field("外边距", "margin", el.style.margin || "0px")}
                      </div>
                    </>
                  )}
                </>
              )}
              {tab === "text" && (
                <>
                  <div
                    className="st-text-tabs"
                    role="tablist"
                    aria-label="文字设置分类"
                  >
                    <button
                      role="tab"
                      aria-selected={textTab === "content"}
                      onClick={() => setTextTab("content")}
                    >
                      编辑内容
                    </button>
                    <button
                      role="tab"
                      aria-selected={textTab === "format"}
                      onClick={() => setTextTab("format")}
                    >
                      字体与排版
                    </button>
                  </div>
                  {textTab === "content" ? (
                    <>
                      <h3>段落内容</h3>
                      <button
                        className="st-wide"
                        onClick={() => onRichEdit(id)}
                      >
                        <Type size={14} />
                        编辑文字与选区格式
                      </button>
                      <label className="st-field">
                        <textarea
                          aria-label="段落文字"
                          data-editor-dirty={text !== engine.text(id)}
                          value={text}
                          rows={6}
                          onChange={(e) => onText(e.target.value)}
                        />
                      </label>
                      <button
                        className="st-primary st-wide"
                        onClick={() =>
                          run(
                            () => engine.setText(id, text),
                            "段落文字已更新。",
                          )
                        }
                      >
                        应用文字
                      </button>
                      <p className="st-help">
                        尚未应用时 Ctrl+Z 撤销输入；应用后 Ctrl+Z
                        撤销文章修改。选区格式请使用上面的编辑入口。
                      </p>
                    </>
                  ) : (
                    <>
                      <h3>字体与行文</h3>
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
                        {field(
                          "字号",
                          "fontSize",
                          el.style.fontSize || s?.fontSize || "16px",
                        )}
                        {field(
                          "行高",
                          "lineHeight",
                          el.style.lineHeight || "1.8",
                        )}
                        {field(
                          "字间距",
                          "letterSpacing",
                          el.style.letterSpacing || "0px",
                        )}
                        {field(
                          "首行缩进",
                          "textIndent",
                          el.style.textIndent || "0em",
                        )}
                      </div>
                      <div className="st-button-grid">
                        <button
                          onClick={() =>
                            style(
                              "fontWeight",
                              s?.fontWeight === "700" ? "400" : "700",
                            )
                          }
                        >
                          <b>加粗</b>
                        </button>
                        <button
                          onClick={() =>
                            style(
                              "fontStyle",
                              s?.fontStyle === "italic" ? "normal" : "italic",
                            )
                          }
                        >
                          <i>斜体</i>
                        </button>
                        <button
                          onClick={() =>
                            style(
                              "textDecoration",
                              s?.textDecorationLine.includes("underline")
                                ? "none"
                                : "underline",
                            )
                          }
                        >
                          <u>下划线</u>
                        </button>
                        <button
                          onClick={() =>
                            style("textDecoration", "line-through")
                          }
                        >
                          删除线
                        </button>
                      </div>
                      <h3>文字对齐 · 不移动组件</h3>
                      <div className="st-button-grid">
                        {["left", "center", "right", "justify"].map((v, i) => (
                          <button key={v} onClick={() => style("textAlign", v)}>
                            {
                              [
                                "文字左对齐",
                                "文字居中",
                                "文字右对齐",
                                "文字两端对齐",
                              ][i]
                            }
                          </button>
                        ))}
                      </div>
                      <p className="st-help">
                        这里改变段落内文字排列。整个组件的位置请到“位置”分类设置。
                      </p>
                    </>
                  )}
                </>
              )}
              {tab === "image" && (
                <>
                  <h3>所选图片</h3>
                  <button
                    className="st-wide"
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept =
                        "image/png,image/jpeg,image/gif,image/webp";
                      input.onchange = () => {
                        const f = input.files?.[0];
                        if (!f || f.size > 10_000_000) {
                          run(() => {
                            throw new Error("请选择不超过 10 MB 的普通图片。");
                          });
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () =>
                          run(() =>
                            engine.replaceImage(id, reader.result as string),
                          );
                        reader.readAsDataURL(f);
                      };
                      input.click();
                    }}
                  >
                    <ImageIcon size={14} />
                    替换所选图片
                  </button>
                  <label className="st-field">
                    裁切方式
                    <select
                      aria-label="图片裁切"
                      defaultValue={el.style.objectFit || "contain"}
                      onChange={(e) => style("objectFit", e.target.value)}
                    >
                      <option value="contain">完整显示</option>
                      <option value="cover">填满裁切</option>
                      <option value="fill">拉伸填充</option>
                    </select>
                  </label>
                  <button
                    className="st-wide"
                    onClick={() => setTab("position")}
                  >
                    调整图片尺寸与位置
                  </button>
                  <p className="st-help">填满裁切需要先设置固定宽高。</p>
                </>
              )}
              {tab === "link" && (
                <>
                  <h3>文字或图片链接</h3>
                  <label className="st-field">
                    <input
                      aria-label="链接地址"
                      placeholder="https://…"
                      value={link}
                      data-editor-dirty={
                        link !==
                        (el.closest("a")?.getAttribute("href") ??
                          el.querySelector("a")?.getAttribute("href") ??
                          "")
                      }
                      onChange={(e) => onLink(e.target.value)}
                    />
                  </label>
                  <button
                    className="st-wide"
                    onClick={() => run(() => engine.link(id, link))}
                  >
                    <LinkIcon size={14} />
                    应用链接
                  </button>
                  <button
                    className="st-wide"
                    onClick={() =>
                      run(() => {
                        engine.link(id, "");
                        onLink("");
                      })
                    }
                  >
                    移除链接
                  </button>
                  <p className="st-help">
                    选中文字或普通图片设置 HTTPS 链接；不要选整个复杂容器。
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
function Colors({
  engine,
  id,
  ids,
  version,
  run,
}: {
  engine: StudioEngine;
  id: string;
  ids: string[];
  version: number;
  run: Props["run"];
}) {
  const [property, setProperty] = useState<
      "backgroundColor" | "color" | "borderColor"
    >("backgroundColor"),
    [color, setColor] = useState("#ffffff");
  const el = engine.element(id)!;
  useEffect(() => {
    setColor(
      hexColor(
        getComputedStyle(el)[property],
        property === "backgroundColor" ? "#ffffff" : "#333333",
      ),
    );
  }, [id, version, property]);
  const apply = (value: string) => {
    if (!/^#[\da-f]{6}$/i.test(value)) {
      run(() => {
        throw new Error("颜色请输入六位十六进制值，如 #f9f5e1。");
      });
      return;
    }
    setColor(value);
    run(
      () => engine.style(ids, { [property]: value }),
      "已应用颜色，可用 Ctrl+Z 撤销。",
    );
  };
  const field = (label: string, key: string, initial: string) => (
    <label>
      {label}
      <input
        aria-label={label}
        key={`${id}-${version}-${key}`}
        defaultValue={initial}
        onBlur={(e) => {
          if (e.target.value !== initial)
            run(() =>
              engine.style(
                ids,
                key === "borderWidth"
                  ? { borderWidth: e.target.value, borderStyle: "solid" }
                  : { [key]: e.target.value },
              ),
            );
        }}
      />
    </label>
  );
  return (
    <div className="st-colors">
      <h3>调整哪一种颜色</h3>
      <div className="st-color-target">
        {(["backgroundColor", "color", "borderColor"] as const).map(
          (key, i) => (
            <button
              key={key}
              aria-pressed={property === key}
              onClick={() => setProperty(key)}
            >
              {["背景", "文字", "边框"][i]}
            </button>
          ),
        )}
      </div>
      <div className="st-palette-input">
        <input
          aria-label="调色板"
          type="color"
          value={/^#[\da-f]{6}$/i.test(color) ? color : "#ffffff"}
          onChange={(e) => apply(e.target.value)}
        />
        <input
          aria-label="颜色值"
          value={color}
          maxLength={7}
          data-editor-dirty={
            color !==
            hexColor(
              getComputedStyle(el)[property],
              property === "backgroundColor" ? "#ffffff" : "#333333",
            )
          }
          onChange={(e) => setColor(e.target.value)}
          onBlur={() => {
            if (/^#[\da-f]{6}$/i.test(color)) apply(color);
          }}
        />
      </div>
      <h3>经典色盘</h3>
      <div className="st-classics">
        {classics.map(([name, value]) => (
          <button
            key={value}
            title={`${name} ${value}`}
            aria-label={`经典色 ${name} ${value}`}
            style={{ background: value }}
            onClick={() => apply(value)}
          />
        ))}
      </div>
      <p className="st-help">
        奶油白、松绿、棕金、浅杏等经典色保留。只修改选中的元素，子文字有独立颜色时请选中子层。
      </p>
      <div className="st-button-grid">
        <button
          onClick={() =>
            run(() => engine.style(ids, { backgroundColor: "transparent" }))
          }
        >
          透明背景
        </button>
        <button
          disabled={getComputedStyle(el).backgroundImage === "none"}
          onClick={() =>
            run(() => engine.style(ids, { backgroundImage: "none" }))
          }
        >
          移除背景图 / 渐变
        </button>
      </div>
      <h3>边框与圆角</h3>
      <div className="st-two">
        {field("边框宽度", "borderWidth", el.style.borderWidth || "0px")}
        {field("圆角", "borderRadius", el.style.borderRadius || "0px")}
      </div>
    </div>
  );
}
