import { browser } from "wxt/browser";
export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: unknown, sender) => {
    if (
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      message.type === "xep:workspace"
    ) {
      return (async () => {
        const tab = await browser.tabs.create({
          url: browser.runtime.getURL("/demo.html") + "?import=1",
        });
        if (
          tab.id &&
          sender.tab?.id &&
          sender.url &&
          /^https:\/\/([\w-]+\.)?xiumi\.us\//.test(sender.url)
        ) {
          const state = await browser.storage.session.get("sourceTabs");
          const sources = (state.sourceTabs ?? {}) as Record<string, number>;
          sources[String(tab.id)] = sender.tab.id;
          await browser.storage.session.set({ sourceTabs: sources });
        }
        return { opened: true };
      })();
    }
    if (typeof message !== "object" || message === null || !("type" in message))
      return;
    if (
      message.type === "xep:source-status" ||
      message.type === "xep:return-source"
    ) {
      return (async () => {
        const state = await browser.storage.session.get("sourceTabs");
        const id = (state.sourceTabs as Record<string, number> | undefined)?.[
          String(sender.tab?.id)
        ];
        if (!id)
          return {
            ok: false,
            message:
              "请从秀米页面的「导入推文精修」入口打开工作台，以关联来源标签。",
          };
        try {
          const source = await browser.tabs.get(id);
          const ping = await browser.tabs.sendMessage(id, {
            type: "xep:source-status",
          });
          if (!ping?.ready)
            return {
              ok: false,
              message: "来源秀米页面不可用，请重新从原稿打开工作台。",
            };
          if (message.type === "xep:return-source") {
            await browser.tabs.update(id, { active: true });
            await browser.windows.update(source.windowId, { focused: true });
            await browser.tabs.sendMessage(id, { type: "xep:return-hint" });
          }
          return {
            ok: true,
            message:
              "已回到来源秀米标签。内容已复制，请使用原生粘贴流程；不会自动覆盖或保存原稿。",
          };
        } catch {
          return {
            ok: false,
            message: "来源标签已关闭或切换，请手动打开原稿。",
          };
        }
      })();
    }
    if (message.type === "xep:native-select")
      return Promise.resolve({
        ok: false,
        message:
          "原生联动验证未通过，已暂停。请直接使用秀米原有工具选中和修改。",
      });
  });
});
