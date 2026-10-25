import { browser } from "wxt/browser";
export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => { /* All editing happens in the local workbench. */ });
});
