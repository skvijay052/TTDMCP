# TTD MCP

Local Node.js + TypeScript MCP server for a TTD booking workflow using Playwright persistent browser automation.

## Current scope

Phase 1 is intentionally conservative:
- persistent headed Chromium session
- TTD status inspection
- availability inspection
- local booking state machine
- local pilgrim profile template
- screenshots on demand
- human handoff for OTP, CAPTCHA, and payment

It does **not** bypass CAPTCHA, OTP, anti-bot controls, or payment authorization.

## Requirements

- Node.js 20+
- npm
- A TTD account/session you can authenticate normally

## Install

```bash
npm install
npm run install:browsers
```

## Run

```npm
npm run dev
```

The MCP server communicates over stdio.

## Tools

- `ttd_get_status` — browser/session state
- `ttd_check_availability` — inspect the configured TTD darshan page for date/slot information

## Persistent login

Chromium uses `storage/browser-profile`. Complete OTP/login manually in the visible browser when required. The profile is gitignored.

## Project layout

```
src/
  index.ts
  mcp/server.ts
  browser/browser-manager.ts
  state/booking-state.ts
  profile/profile-store.ts
  ttd/client.ts
  ttd/constants.ts
  ttd/flows/availability-flow.ts
  ttd/pages/base.page.ts
  ttd/pages/darshan.page.ts
  utils/errors.ts
  utils/logger.ts
profiles/default.json
storage/
screenshots/
tests/
```

## Safety

Use only the official TTD booking flow. Never automate or bypass CAPTCHA, OTP, payment PIN/authorization, or other security controls.
