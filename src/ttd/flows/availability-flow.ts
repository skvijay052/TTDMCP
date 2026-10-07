import { BrowserManager } from "../../browser/browser-manager.js";
import { BookingStateStore } from "../../state/booking-state.js";
import { TtdClient } from "../client.js";
import { DarshanPage } from "../pages/darshan.page.js";

export class AvailabilityFlow {
  constructor(
    private readonly browser: BrowserManager,
    private readonly state: BookingStateStore
  ) {}

  async check(date?: string) {
    const page = await this.browser.openHome();
    const client = new TtdClient(page);
    await client.openDarshanPage();

    const darshan = new DarshanPage(page);
    const inspected = await darshan.inspect();

    const authHints = /login|sign in|otp|mobile number/i.test(inspected.bodyText);
    const captchaHint = /captcha|verify you are human/i.test(inspected.bodyText);
    const targetDate = date ?? null;

    if (captchaHint || authHints) {
      this.state.set("USER_ACTION_REQUIRED", {
        date: targetDate ?? undefined,
        message: captchaHint
          ? "Manual CAPTCHA/security step is required before continuing."
          : "Manual login/OTP may be required before continuing."
      });
    } else {
      this.state.set("BROWSER_READY", { date: targetDate ?? undefined });
    }

    return {
      requestedDate: targetDate,
      url: inspected.url,
      title: inspected.title,
      state: this.state.get(),
      hints: {
        loginOrOtpVisible: authHints,
        captchaVisible: captchaHint
      },
      discovery: {
        links: inspected.links,
        buttons: inspected.buttons,
        inputs: inspected.inputs,
        dateCandidates: inspected.dateCandidates,
        slotCandidates: inspected.slotCandidates
      },
      note: "Discovery data is read-only. A date/slot is only selected when a visible matching control is found."
    };
  }
}
