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

    this.state.set("BROWSER_READY", { date });

    const authHints = /login|sign in|otp|mobile number/i.test(inspected.bodyText);
    const captchaHint = /captcha|verify you are human/i.test(inspected.bodyText);

    if (captchaHint || authHints) {
      this.state.set("USER_ACTION_REQUIRED", {
        message: captchaHint
          ? "Manual CAPTCHA/security step may be required."
          : "Manual login/OTP may be required."
      });
    }

    return {
      requestedDate: date ?? null,
      url: inspected.url,
      title: inspected.title,
      state: this.state.get(),
      hints: {
        loginOrOtpVisible: authHints,
        captchaVisible: captchaHint
      },
      note: "Availability extraction is intentionally conservative until current TTD selectors are verified against the live site."
    };
  }
}
