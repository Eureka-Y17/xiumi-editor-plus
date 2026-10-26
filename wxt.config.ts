import { defineConfig } from "wxt";
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "秀米 PLUS · 本地图文编辑台",
    description:
      "独立本地图文编辑台：拖拽、组合、文字图片、PPT 式图层、自动保存与可选二维码预览。",
    version: "0.5.0",
    optional_host_permissions: ["http://127.0.0.1/*"],
    permissions: ["storage", "clipboardWrite"],
  },
});
