import { randomBytes } from "node:crypto";
import type { Page } from "playwright";
import { BrowserManager } from "./browser-manager.js";
import { BookingStateStore } from "../state/booking-state.js";

interface Handoff {
  token: string;
  createdAt: number;
  expiresAt: number;
  stage: "PHONE" | "OTP" | "DONE" | "ERROR";
  message: string;
}

const HANDOFF_TTL_MS = 10 * 60 * 1000;

export class LoginHandoff {
  private handoff?: Handoff;

  constructor(
    private readonly browser: BrowserManager,
    private readonly state: BookingStateStore
  ) {}

  create(): Handoff {
    const now = Date.now();
    const token = randomBytes(24).toString("hex");
    this.handoff = {
      token,
      createdAt: now,
      expiresAt: now + HANDOFF_TTL_MS,
      stage: "PHONE",
      message: "Enter your TTD mobile number."
    };
    this.state.set("USER_ACTION_REQUIRED", {
      message: "TTD login is required. Use the mobile login page to complete OTP verification."
    });
    return { ...this.handoff };
  }

  get(token: string): Handoff | null {
    if (!this.handoff || this.handoff.token !== token || this.handoff.expiresAt < Date.now()) {
      return null;
    }
    return { ...this.handoff };
  }

  async submitPhone(token: string, phone: string): Promise<Handoff> {
    const handoff = this.require(token);
    if (!/^\\d{10}$/.test(phone)) {
      throw new Error("Enter a valid 10-digit mobile number.");
    }

    const page = await this.browser.openHome();
    const inputs = page.locator(
      'input[type="tel"], input[name*="mobile" i], input[placeholder*="mobile" i], input[name*="phone" i], input[placeholder*="phone" i]'
    );

    const count = await inputs.count();
    let filled = false;
    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      if (await input.isVisible().catch(() => false)) {
        await input.fill(phone);
        filled = true;
        break;
      }
    }

    if (!filled) {
      throw new Error("Could not find the visible TTD mobile-number field. No OTP was requested.");
    }

    const buttons = page.getByRole("button");
    const buttonCount = await buttons.count();
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      if (!(await button.isVisible().catch(() => false))) continue;
      const text = (await button.textContent().catch(() => ""))?.trim() ?? "";
      if (/send\s*otp|request\s*otp|get\s*otp|login|continue/i.test(text)) {
        await button.click();
        break;
      }
    }

    handoff.stage = "OTP";
    handoff.message = "OTP requested. Enter the OTP you received on your phone.";
    this.state.set("USER_ACTION_REQUIRED", {
      message: "TTD OTP is required. Enter the OTP in the mobile login page."
    });
    return { ...handoff };
  }

  async submitOtp(token: string, otp: string): Promise<Handoff> {
    const handoff = this.require(token);
    if (!/^\\d{4,8}$/.test(otp)) {
      throw new Error("Enter the numeric OTP shown on your phone.");
    }

    const page = await this.browser.getPage();
    const inputs = page.locator(
      'input[autocomplete="one-time-code"], input[name*="otp" i], input[placeholder*="otp" i], input[aria-label*="otp" i]'
    );
    const count = await inputs.count();

    if (count === 0) {
      throw new Error("The TTD OTP field is not currently visible.");
    }

    if (count === 1) {
      await inputs.first().fill(otp);
    } else {
      const digits = otp.split("");
      for (let i = 0; i < Math.min(count, digits.length); i++) {
        const input = inputs.nth(i);
        if (await input.isVisible().catch(() => false)) {
          await input.fill(digits[i]);
        }
      }
    }

    const buttons = page.getByRole("button");
    const buttonCount = await buttons.count();
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      if (!(await button.isVisible().catch(() => false))) continue;
      const text = (await button.textContent().catch(() => ""))?.trim() ?? "";
      if (/verify|submit|login|continue/i.test(text)) {
        await button.click();
        break;
      }
    }

    await page.waitForTimeout(1500);
    const loginStillVisible = await page
      .locator('input[autocomplete="one-time-code"], input[name*="otp" i], input[placeholder*="otp" i], input[aria-label*="otp" i]')
      .first()
      .isVisible()
      .catch(() => false);

    if (loginStillVisible) {
      handoff.stage = "OTP";
      handoff.message = "OTP was submitted, but TTD still shows the OTP step. Check the OTP and try again.";
      return { ...handoff };
    }

    handoff.stage = "DONE";
    handoff.message = "TTD login appears complete. ChatGPT can continue the booking flow.";
    this.state.set("AUTHENTICATED", {
      message: "TTD login completed through the user OTP handoff."
    });
    return { ...handoff };
  }

  private require(token: string): Handoff {
    const handoff = this.get(token);
    if (!handoff) throw new Error("Login handoff is missing or expired. Start a new TTD login.");
    if (handoff.stage === "DONE") throw new Error("TTD login is already complete.");
    return this.handoff!;
  }
}

export function renderLoginPage(handoff: Handoff): string {
  const action = handoff.stage === "PHONE" ? "phone" : "otp";
  const title = action === "phone" ? "TTD Login" : "TTD OTP Verification";
  const label = action === "phone" ? "Mobile number" : "OTP";
  const inputType = action === "phone" ? "tel" : "text";
  const placeholder = action === "phone" ? "10-digit mobile number" : "Enter OTP";
  const maxLength = action === "phone" ? 10 : 8;
  const endpoint = action === "phone" ? "/human-login/phone" : "/human-login/otp";

  return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
body{font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f7f7f7}
main{background:white;border-radius:16px;padding:24px;box-shadow:0 2px 12px #0001}
input,button{width:100%;box-sizing:border-box;padding:14px;margin-top:8px;font-size:18px;border-radius:10px}
input{border:1px solid #bbb}button{border:0;background:#111;color:white}
.small{color:#666;font-size:14px}.status{margin-top:16px;padding:12px;background:#f0f0f0;border-radius:10px}
</style></head>
<body><main>
<h2>${title}</h2>
<p>${handoff.message}</p>
<form method="post" action="${endpoint}">
<label>${label}<input name="${action}" type="${inputType}" inputmode="numeric" autocomplete="${action === "otp" ? "one-time-code" : "tel"} placeholder="${placeholder}" maxlength="${maxLength}" required></label>
<button type="submit">${action === "phone" ? "Request OTP" : "Verify OTP"}</button>
</form>
<p class="small">This page is a temporary handoff. The mobile number and OTP are not stored by the MCP.</p>
</main></body></html>`;
}
