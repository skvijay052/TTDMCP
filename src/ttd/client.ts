import type { Page } from "playwright";
import { TTD } from "./constants.js";

export class TtdClient {
  constructor(private readonly page: Page) {}

  async openDarshanPage(): Promise<void> {
    const url = this.page.url();
    if (url === "about:blank" || !TTD.darshanPathHints.some((hint) => url.toLowerCase().includes(hint))) {
      await this.page.goto(TTD.baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    }
  }
}
