import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  use: { viewport: { width: 1440, height: 1050 } },
  timeout: 30000,
});
