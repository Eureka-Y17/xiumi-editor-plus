import React, { useEffect, useState } from "react";
import { EditorAdapter } from "./adapter";
import { hexColor } from "./appearance";
type ColorProperty = "backgroundColor" | "color" | "borderColor";
const swatches = [
  "#f9f5e1",
  "#ffffff",
  "#217c61",
  "#9b5414",
  "#333333",
  "#e5c598",
  "#b7c9d2",
  "#d9a5a5",
];
export function PropertyEditor({
  adapter,
  id,
  onChange,
}: {
  adapter: EditorAdapter;
  id: string;
  onChange: (fn: () => void, message: string) => void;
}) {
  const [property, setProperty] = useState<ColorProperty>("backgroundColor");
  const [color, setColor] = useState("#ffffff");
  const [text, setText] = useState("");
  const info = adapter.appearance(id);
  const cap = adapter.propertyCapability(id, property),
    textCap = adapter.propertyCapability(id, "text");
  useEffect(() => {
    setText(adapter.text(id));
  }, [adapter, id]);
  useEffect(() => {
    const values = adapter.appearance(id);
    if (values)
      setColor(
        hexColor(
          values[property],
          property === "backgroundColor" ? "#ffffff" : "#333333",
        ),
      );
  }, [adapter, id, property]);
  if (!info) return null;
  if (adapter.mode === "xiumi-readonly")
    return (
      <div className="property-editor">
        <p className="property-note">
          原生联动验证未通过，已暂停。请直接在秀米页面选择内容，使用其原有工具修改并保存。若原生工具不支持，请使用「导入推文精修」中的调色板与文字编辑。
        </p>
        <dl>
          <dt>文字颜色</dt>
          <dd>{info.color}</dd>
          <dt>背景颜色</dt>
          <dd>{info.backgroundColor}</dd>
          <dt>背景类型</dt>
          <dd>
            {info.backgroundImage && info.backgroundImage !== "none"
              ? info.backgroundImage.includes("gradient(")
                ? "渐变"
                : "背景图片"
              : info.hasBackground
                ? "纯色底板"
                : "透明"}
          </dd>
        </dl>
      </div>
    );
  return (
    <div className="property-editor">
      <div className="section-label">调整颜色</div>
      <label>
        颜色类型
        <select
          aria-label="颜色类型"
          value={property}
          onChange={(e) => setProperty(e.target.value as ColorProperty)}
        >
          <option value="backgroundColor">背景板颜色</option>
          <option value="color">文字颜色</option>
          <option value="borderColor">边框颜色</option>
        </select>
      </label>
      <div className="color-inputs">
        <input
          aria-label="调色板"
          type="color"
          value={/^#[\da-f]{6}$/i.test(color) ? color : "#ffffff"}
          onChange={(e) => setColor(e.target.value)}
        />
        <input
          aria-label="颜色值"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          maxLength={7}
        />
      </div>
      <div className="swatches">
        {swatches.map((s) => (
          <button
            key={s}
            aria-label={`选择颜色 ${s}`}
            style={{ background: s }}
            onClick={() => setColor(s)}
          />
        ))}
      </div>
      <button
        className="apply-property"
        disabled={!cap.allowed || !/^#[\da-f]{6}$/i.test(color)}
        title={cap.reason}
        onClick={() =>
          onChange(
            () => adapter.setColor(id, property, color),
            "已调整所选组件的颜色，可撤销。",
          )
        }
      >
        应用颜色
      </button>
      <p className="property-note">
        只改变当前元素；子文字若有独立颜色，请在树中选中对应文字。边框颜色不会新增边框。
      </p>
      {info.backgroundImage && info.backgroundImage !== "none" && (
        <div className="background-note">
          当前含有
          {info.backgroundImage.includes("gradient(") ? "渐变" : "背景图片"}
          ，会盖住底色。
          <button
            disabled={!cap.allowed}
            onClick={() =>
              onChange(
                () => adapter.clearBackgroundImage(id),
                "已移除当前背景图片或渐变，可撤销。",
              )
            }
          >
            移除背景图／渐变
          </button>
        </div>
      )}
      <div className="section-label">编辑文字段</div>
      <textarea
        aria-label="段落文字"
        rows={5}
        disabled={!textCap.allowed}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        className="apply-property"
        disabled={!textCap.allowed || text === adapter.text(id)}
        title={textCap.reason}
        onClick={() =>
          onChange(
            () => adapter.setText(id, text),
            "文字已更新，未改动图片及其他段落，可撤销。",
          )
        }
      >
        应用文字
      </button>
      <p className="property-note">
        {textCap.allowed
          ? "保留未改动部分的加粗、颜色、链接等格式。替换跨越多个格式时，请核对预览。"
          : textCap.reason}
      </p>
    </div>
  );
}
