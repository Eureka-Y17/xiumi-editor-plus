# 简明开发接口 · 本地编辑台

普通用户不需要填写 CSS 选择器、接口参数或 API Key 即可编辑。只有可选公众号同步需要一次账号连接。

```ts
const editor = new StudioEngine(articleElement);
const items = editor.tree();
const group = editor.group([firstId, secondId]);
editor.translate([group], 20, 10); // 叠放画布中的组件
editor.layer([group], 'front');
editor.ungroup(group);
editor.undo();
```

常用方法：`insert`、`image`、`move`、`group`、`ungroup`、`canvas`、`flow`、`translate`、`resize`、`layer`、`style`、`setText`、`setRichText`、`lock`。错误返回可读说明。每个写操作是一笔历史事务。`translate` 仅用于叠放画布；普通文流使用 `move`。

本机服务配对后提供 `/status`、`/config`、`/previews`、`/previews/revoke`、`/wechat/drafts`，除随机预览页面外均需 Bearer 配对码。默认监听 127.0.0.1:4318，详细用法见 LOCAL_SERVICE.md。接口不提供原生秀米写入、公众号群发或发布能力。
