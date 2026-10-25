# 秀米编辑增强助手 · Xiumi Editor Plus

**看清组件结构，让复杂的修改简单一点。** 一个使用 WXT、React 与 TypeScript 构建的 Chrome / Edge 扩展。

> **0.1.0 实验版：本地演示支持编辑；真实秀米仅支持结构检查。尚未验证真实秀米的保存、刷新或公众号同步，所有真实稿件修改均被禁用。** 本项目为独立社区项目，与秀米官方无隶属关系。

![本地演示工作台](docs/screenshots/workspace.png)

## 开始使用

1. 在 [Releases](https://github.com/Eureka-Y17/xiumi-editor-plus/releases) 下载实验版 ZIP 并解压。
2. Chrome 打开 `chrome://extensions`；Edge 打开 `edge://extensions`。
3. 打开「开发者模式」，选择「加载已解压的扩展程序」，选择解压后包含 `manifest.json` 的目录。
4. 点击浏览器扩展图标，选择「打开交互演示」。安装后也可固定扩展方便打开。
5. 打开秀米图文编辑页，点浏览器扩展图标即可直接呼出助手；也可点页面右上侧「秀米 Plus · 查看结构」。无需配置。识别不到编辑区时会显示说明，不修改稿件。

详细步骤见 [中文操作手册](docs/USER_GUIDE.md)。

## 本版可以体验什么

- 浅色中文工作台、可折叠与调宽面板、Shadow DOM 样式隔离。
- 组件树与文章双向选择，父层、子层及相邻组件导航。
- 图片交换素材但保留位置尺寸、裁切和布局；同级排序与拖动。
- 普通单列拆组、内容提升一层、同级重叠顺序调整。
- 拆组前提示样式损失；最多 40 步撤销 / 重做及初始状态恢复。
- 11 个自制模板；SVG、滑动和特殊结构修改拦截。

以上编辑能力只开放于本地演示。真实页面的结构树属于 DOM 检查结果，并非秀米内部组件模型；图片是否为合成图也不能自动判断。

## 开发

推荐 Node.js 24 LTS 最新补丁版及 npm。

```sh
npm ci
npm run dev
```

生产构建与测试：

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run zip
```

构建目录为 `.output/chrome-mv3`，可在 Chrome 或 Edge 中加载。ZIP 位于 `.output/`。演示页面为扩展内置 `demo.html`，从扩展弹窗打开。

## 文档与状态

- [第一版开发报告](docs/DEVELOPMENT_REPORT.md)：痛点、架构、范围和技术关卡。
- [操作说明与故障排查](docs/USER_GUIDE.md)
- [测试记录与兼容范围](docs/TEST_REPORT.md)
- [公开前端分析记录](docs/FRONTEND_RESEARCH.md)
- [简明开发接口](docs/INTEGRATION.md)
- [贡献指南](CONTRIBUTING.md) / [更新记录](CHANGELOG.md) / [隐私说明](PRIVACY.md)

当前没有后端、遥测或文章上传；演示内容刷新即重置。扩展仅在 HTTPS 秀米域名注入，不申请所有网站权限。演示图片为项目内生成的 SVG 数据图片，不依赖外部图床。

## 后续方向

先验证原生编辑命令与文档模型，再逐个开放真实编辑能力。每项都需要「修改 → 撤销 → 保存 → 刷新 → 公众号预览」证据；不能以 DOM 外观变化代替保存验证。

开源协议：[MIT](LICENSE)。第三方依赖保留各自许可，参见 [第三方说明](THIRD_PARTY_NOTICES.md)。
