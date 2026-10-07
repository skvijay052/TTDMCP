import { chromium, type BrowserContext, type Page } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const PROFILE = process.env.TTD_BROWSER_PROFILE ?? "./storage/browser-profile";
const SCREENSHOTS = process.env.TTD_SCREENSHOTS ?? "./screenshots";
const BASE_URL = process.env.TTD_BASE_URL ?? "https://ttdevasthanams.ap.gov.in";

export class BrowserManager {
  private context?: BrowserContext;

  async getContext(): Promise<BrowserContext> {
    if (this.context) return this.context;
    await mkdir(PROFILE, { recursive: true });
    await mkdir(SCREENSHOTS, { recursive: true });
    this.context = await chromium.launchPersistentContext(path.resolve(PROFILE), {
      headless: process.env.TTD_HEADLESS === "true",
      viewport: { width: 1440, height: 900 }
    });
    return this.context;
  }

  async getPage(): Promise<Page> {
    const context = await this.getContext();
    const pages = context.pages();
    if (pages.length > 0) return pages[0];
    return context.newPage();
  }

  async openHome(): Promise<Page> {
    const page = await this.getPage();
    if (!page.url() || page.url() === "about:blank") {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    }
    return page;
  }

  async screenshot(name = "status"): Promise<string> {
    const page = await this.getPage();
    const safe = name.replace(/[^a-z0-9_-]/gi, "_");
    const file = path.resolve(SCREENSHOTS, `${Date.now()}-${safe}.png`);
    await page.screenshot({ path: file, fullPage: true });
    return file;
  }

  async getStatus() {
    const page = await this.getPage();
    return {
      ready: true,
      url: page.url(),
      title: await page.title().catch(() => ""),
      pages: (this.context ? this.context.pages().length : 1),
      persistentProfile: path.resolve(PROFILE)
    };
  }
}
