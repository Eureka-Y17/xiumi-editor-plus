# 简明开发接口

普通用户不用调用接口：在秀米里点击浏览器扩展图标，即可打开助手。安装后首次刷新秀米页面即可，不需要配置 API Key、服务器或参数。

开发者直接使用项目中的 `EditorAdapter`，无需调用秀米私有 HTTP 接口。

```ts
import { EditorAdapter } from '../src/adapter';

// 真实页面只检查，不修改。
const editor = new EditorAdapter(rootElement, 'xiumi-readonly');
const nodes = editor.tree();
const target = editor.element(nodes[0].id);
target?.scrollIntoView({ block: 'center' });
```

自有静态演示中，检查能力后执行动作：

```ts
const editor = new EditorAdapter(ownDemoRoot, 'demo');
const id = editor.tree()[0].id;
if (editor.capability(id, 'down').allowed) {
  editor.execute(id, 'down');
}
editor.undo();
```

三类常用调用：`tree()` 看结构；`element(id)` 选择元素；`capability(id, action)` 检查后 `execute(id, action)` 执行。图片交换单独用 `swap(firstId, secondId)`；错误抛出可读说明，可在界面中直接显示。

`demo` 只供自有静态内容，不是解除真实秀米限制的开关。不要在秀米正文上使用；HTML 快照无法保留框架文档模型或原生事件。真实保存适配需要独立验证后增加实现。本版不提供公开网络 API、网页全局对象或远程执行接口。

属性精修仍只需适配器调用：先检查 `propertyCapability(id, 'backgroundColor')`，允许后调用 `setColor(id, 'backgroundColor', '#f9f5e1')`；文字使用 `text(id)` 和 `setText(id, value)`，统一通过 `undo()` 恢复。原生选中桥接实测失败已暂停，不提供未经验证的原稿修改接口。
