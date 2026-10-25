export type Kind = "layout" | "text" | "image" | "background" | "special";
export interface ComponentNode {
  id: string;
  kind: Kind;
  label: string;
  parentId: string | null;
  children: ComponentNode[];
}
export type Command =
  | "up"
  | "down"
  | "promote"
  | "unwrap"
  | "layerUp"
  | "layerDown"
  | "front"
  | "back";
export interface Capability {
  allowed: boolean;
  reason: string;
}
export const kindNames: Record<Kind, string> = {
  layout: "布局",
  text: "文字",
  image: "图片",
  background: "背景布局",
  special: "特殊组件",
};
