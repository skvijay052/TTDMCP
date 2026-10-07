import type { Page } from "playwright";
import { BasePage } from "./base.page.js";

export class DarshanPage extends BasePage {
  async inspect(): Promise<{ url: string; title: string; bodyText: string }> {
    return {
      url: this.page.url(),
      title: await this.page.title().catch(() => ""),
      bodyText: await this.text()
    };
  }
}
