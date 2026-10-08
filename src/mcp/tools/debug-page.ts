import type { Page } from "playwright";

export interface DebugPageResult {
  url: string;
  title: string;
  readyState: string;
  htmlLength: number;
  bodyText: string;
  bodyTextLength: number;
  frames: Array<{ url: string; name: string }>;
  counts: {
    links: number;
    buttons: number;
    inputs: number;
    selects: number;
    iframes: number;
  };
  visible: {
    links: number;
    buttons: number;
    inputs: number;
    selects: number;
  };
  resourceSummary: {
    total: number;
    failedOrEmptyResponses: number;
    urls: string[];
  };
  consoleErrors: string[];
  pageErrors: string[];
  screenshotPath: string | null;
}

async function visibleCount(page: Page, selector: string): Promise<number> {
  const locator = page.locator(selector);
  const count = await locator.count();
  let visible = 0;
  for (let i = 0; i < count && i < 200; i++) {
    if (await locator.nth(i).isVisible().catch(() => false)) visible++;
  }
  return visible;
}

export async function debugPage(
  page: Page,
  screenshot: (name: string) => Promise<string>
): Promise<DebugPageResult> {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];

  const onConsole = (message: { type(): string; text(): string }) => {
    if (message.type() === "error") consoleErrors.push(message.text().slice(0, 500));
  };
  const onPageError = (error: Error) => pageErrors.push(error.message.slice(0, 500));
  const onRequestFailed = (request: { url(): string; failure(): { errorText?: string } | null }) => {
    const failure = request.failure();
    failedRequests.push(`${request.url()} :: ${failure?.errorText ?? "unknown"}`.slice(0, 700));
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("requestfailed", onRequestFailed);

  try {
    if (!page.url() || page.url() === "about:blank") {
      await page.goto(process.env.TTD_BASE_URL ?? "https://ttdevasthanams.ap.gov.in", {
        waitUntil: "domcontentloaded",
        timeout: 30000
      });
    } else {
      await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    }

    await page.waitForTimeout(3000);

    const bodyText = await page.locator("body").innerText().catch(() => "");
    const html = await page.content().catch(() => "");
    const resources = await page.evaluate(() =>
      performance.getEntriesByType("resource").map((entry) => ({
        name: entry.name,
        duration: Math.round(entry.duration)
      })).slice(-200)
    ).catch(() => []);

    const resourceUrls = resources.map((x) => x.name);
    const frames = page.frames().map((frame) => ({
      url: frame.url(),
      name: frame.name()
    }));

    return {
      url: page.url(),
      title: await page.title().catch(() => ""),
      readyState: await page.evaluate(() => document.readyState).catch(() => "unknown"),
      htmlLength: html.length,
      bodyText: bodyText.slice(0, 12000),
      bodyTextLength: bodyText.length,
      frames,
      counts: {
        links: await page.locator("a").count(),
        buttons: await page.locator("button, [role=button]").count(),
        inputs: await page.locator("input").count(),
        selects: await page.locator("select").count(),
        iframes: await page.locator("iframe").count()
      },
      visible: {
        links: await visibleCount(page, "a"),
        buttons: await visibleCount(page, "button, [role=button]"),
        inputs: await visibleCount(page, "input"),
        selects: await visibleCount(page, "select")
      },
      resourceSummary: {
        total: resourceUrls.length,
        failedOrEmptyResponses: failedRequests.length,
        urls: [...failedRequests.slice(0, 50), ...resourceUrls.slice(-50)].slice(0, 100)
      },
      consoleErrors: [...new Set(consoleErrors)].slice(0, 50),
      pageErrors: [...new Set(pageErrors)].slice(0, 50),
      screenshotPath: await screenshot("ttd-debug").catch(() => null)
    };
  } finally {
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
    page.off("requestfailed", onRequestFailed);
  }
}
