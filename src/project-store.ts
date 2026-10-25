import { cleanStudioHtml } from "./studio-engine";
export interface StudioProject {
  id: string;
  title: string;
  html: string;
  width: number;
  updated: number;
}
const open = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("xep-studio", 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("projects", { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error("无法打开本地草稿库。"));
  });
export async function projects() {
  const db = await open();
  try {
    return await new Promise<StudioProject[]>((resolve, reject) => {
      const req = db.transaction("projects").objectStore("projects").getAll();
      req.onsuccess = () =>
        resolve(
          (req.result as StudioProject[]).sort((a, b) => b.updated - a.updated),
        );
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}
export async function saveProject(project: StudioProject) {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("projects", "readwrite");
      tx.objectStore("projects").put(project);
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(new Error("保存失败：本地空间不足，请下载工程备份。"));
      tx.onabort = () => reject(new Error("保存被中断，请下载工程备份。"));
    });
  } finally {
    db.close();
  }
}
export function readProject(value: unknown): StudioProject {
  if (!value || typeof value !== "object")
    throw new Error("不是有效的工程文件");
  const p = value as Record<string, unknown>;
  if (
    p.format !== "xep-studio" ||
    p.version !== 1 ||
    typeof p.title !== "string" ||
    typeof p.html !== "string" ||
    typeof p.width !== "number" ||
    p.width < 280 ||
    p.width > 1000
  )
    throw new Error("工程格式不受支持");
  return {
    id: crypto.randomUUID(),
    title: p.title.slice(0, 80),
    html: cleanStudioHtml(p.html),
    width: p.width,
    updated: Date.now(),
  };
}
export function projectFile(p: StudioProject) {
  return JSON.stringify(
    {
      format: "xep-studio",
      version: 1,
      title: p.title,
      html: p.html,
      width: p.width,
    },
    null,
    2,
  );
}
