import { browser } from "wxt/browser";
export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: unknown) => {
    if (
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      message.type === "xep:workspace"
    ) {
      return browser.tabs
        .create({ url: browser.runtime.getURL("/demo.html") + "?import=1" })
        .then(() => ({ opened: true }));
    }
  });
});
