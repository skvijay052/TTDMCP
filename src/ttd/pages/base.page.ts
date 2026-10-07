import type { Page } from "playwright";

export class BasePage {
  constructor(protected readonly page: Page) {}

  async text(): Promise<string> {
    return this.page.locator("body").innerText().catch(() => "");
  }
}
