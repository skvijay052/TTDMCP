import type { Page } from "playwright";
import { BasePage } from "./base.page.js";

export interface DarshanInspection {
  url: string;
  title: string;
  bodyText: string;
  links: Array<{ text: string; href: string }>;
  buttons: string[];
  inputs: Array<{ type: string; name: string; placeholder: string; ariaLabel: string }>;
  dateCandidates: string[];
  slotCandidates: string[];
}

export class DarshanPage extends BasePage {
  async inspect(): Promise<DarshanInspection> {
    const links = await this.page.locator("a").evaluateAll((els) =>
      els.slice(0, 100).map((el) => ({
        text: (el.textContent ?? "").trim().replace(/\\s+/g, " ").slice(0, 160),
        href: (el as HTMLAnchorElement).href
      })).filter((x) => x.text || x.href)
    );
    const buttons = await this.page.locator("button, [role=button]").evaluateAll((els) =>
      els.slice(0, 100).map((el) => (el.textContent ?? "").trim().replace(/\\s+/g, " ").slice(0, 160)).filter(Boolean)
    );
    const inputs = await this.page.locator("input, select").evaluateAll((els) =>
      els.slice(0, 100).map((el) => {
        const input = el as HTMLInputElement;
        return {
          type: input.type || el.tagName.toLowerCase(),
          name: input.name || "",
          placeholder: input.placeholder || "",
          ariaLabel: el.getAttribute("aria-label") || ""
        };
      })
    );
    const bodyText = await this.text();
    const dateCandidates = Array.from(new Set(
      (bodyText.match(/\\b(?:20\\d{2}[-/]\\d{1,2}[-/]\\d{1,2}|\\d{1,2}[-/]\\d{1,2}[-/]20\\d{2}|\\d{1,2}[- ](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[- ]20\\d{2})\\b/gi) ?? [])
    )).slice(0, 50);
    const slotCandidates = Array.from(new Set(
      (bodyText.match(/\\b(?:[01]?\\d|2[0-3])[:.]\\d{2}\\s*(?:AM|PM)?\\b/gi) ?? [])
    )).slice(0, 50);

    return {
      url: this.page.url(),
      title: await this.page.title().catch(() => ""),
      bodyText,
      links,
      buttons,
      inputs,
      dateCandidates,
      slotCandidates
    };
  }

  private async clickTextCandidates(candidates: string[]): Promise<string | null> {
    for (const text of candidates) {
      const exact = this.page.getByText(text, { exact: true }).first();
      if (await exact.isVisible().catch(() => false)) {
        await exact.click();
        return text;
      }
      const partial = this.page.getByText(text, { exact: false }).first();
      if (await partial.isVisible().catch(() => false)) {
        await partial.click();
        return text;
      }
    }
    return null;
  }

  async selectDate(date: string): Promise<{ selected: boolean; matchedText?: string }> {
    const candidates = [
      date,
      date.replace(/-/g, "/"),
      (() => { const [y,m,d]=date.split("-"); return `${d}-${m}-${y}`; })(),
      (() => { const [y,m,d]=date.split("-"); return `${d}/${m}/${y}`; })()
    ];
    const matchedText = await this.clickTextCandidates(candidates);
    if (matchedText) return { selected: true, matchedText };

    const inputs = this.page.locator("input[type=date], input[name*=date i], input[placeholder*=date i]");
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      if (await input.isVisible().catch(() => false)) {
        await input.fill(date);
        await input.press("Enter").catch(() => undefined);
        return { selected: true, matchedText: date };
      }
    }
    return { selected: false };
  }

  async selectSlot(slot: string): Promise<{ selected: boolean; matchedText?: string }> {
    const matchedText = await this.clickTextCandidates([slot]);
    return matchedText ? { selected: true, matchedText } : { selected: false };
  }

  async selectTicketCount(count: number): Promise<{ selected: boolean }> {
    const selects = this.page.locator("select");
    const selectCount = await selects.count();
    for (let i = 0; i < selectCount; i++) {
      const select = selects.nth(i);
      if (await select.isVisible().catch(() => false)) {
        const options = await select.locator("option").allTextContents();
        if (options.some((x) => x.trim() === String(count))) {
          await select.selectOption(String(count));
          return { selected: true };
        }
      }
    }

    const candidates = [
      this.page.getByLabel(/number of tickets|ticket count|no\. of tickets|tickets/i).first(),
      this.page.locator("input[name*=ticket i], input[name*=quantity i], input[aria-label*=ticket i]").first()
    ];
    for (const input of candidates) {
      if (await input.isVisible().catch(() => false)) {
        await input.fill(String(count));
        await input.press("Enter").catch(() => undefined);
        return { selected: true };
      }
    }
    return { selected: false };
  }
}
