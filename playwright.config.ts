import { defineConfig } from "playwright";

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  use: {
    headless: process.env.TTD_HEADLESS === "true"
  }
});
