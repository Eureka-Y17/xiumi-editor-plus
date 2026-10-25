import { defineConfig } from "wxt";
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "秀米编辑增强助手 · Xiumi Editor Plus",
    description:
      "看清组件结构，轻松调整图文。秀米页面结构检查与本地编辑演示工具。",
    version: "0.1.0",
    permissions: ["storage"],
  },
});
