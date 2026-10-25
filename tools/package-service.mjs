import { readFile, writeFile, mkdir } from "node:fs/promises";
import { zipSync } from "fflate";
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const files = [
  "package.json",
  "package-lock.json",
  "tools/bridge.mjs",
  "start-preview.cmd",
  "docs/LOCAL_SERVICE.md",
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
];
const entries = {};
for (const file of files) entries[file] = new Uint8Array(await readFile(file));
await mkdir(".output", { recursive: true });
const path = `.output/xiumi-editor-plus-${pkg.version}-local-service.zip`;
await writeFile(path, zipSync(entries, { level: 6 }));
process.stdout.write(`Local preview and draft service packaged: ${path}\n`);
