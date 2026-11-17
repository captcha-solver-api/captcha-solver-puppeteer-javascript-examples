# Test status

Automated checks validated on November 17, 2026 with Node.js 22.12, Node.js 24, and Chrome 155.

## Automated checks

- `npm run lint`: passed.
- `npm run check`: passed (includes lint).
- `npm test`: 12 browser integration tests passed.
- `npm audit --package-lock-only`: passed with no known vulnerabilities.
- Tests use a local page fixture and a local API stub. They do not spend API balance.
- Browser fixtures use the same Puppeteer Extra stealth setup as the examples.
- Covered flows: reCAPTCHA v2, reCAPTCHA v3 script parsing, embedded Turnstile,
  reCAPTCHA Enterprise, Cloudflare Challenge navigation/HTTP verification and Tencent interception, Yandex
  SmartCaptcha token injection, GeeTest v3/v4 submission, solution injection, and visible success
  verification.

## Live demo checks

The following examples received a solution from Captcha Solver and the demo page
confirmed that the answer was accepted:

- `recaptcha-v2.js` — official Google reCAPTCHA v2 demo.
- `recaptcha-v3.js`.
- `turnstile.js` — the API returned a solution and the configured
  test page confirmed acceptance on October 12, 2026.

## Pending checks

- `recaptcha-v2-enterprise.js`, `geetest-v3.js`, and `geetest-v4.js`: task
  construction, solution submission, and acceptance verification pass against
  local browser fixtures. They have not been live-tested from this repository.
- `coordinates.js`, `image-to-text.js`, `yandex-smartcaptcha-image.js`, and `balance.js`: syntax,
  lint, formatting, and workflow-guide checks pass. Their paid API calls were not run locally.
- `yandex-smartcaptcha.js`: task construction, token injection, form submission,
  and page success verification pass against the local browser fixture. The
  official Yandex demo has not been live-tested from this repository yet.
- `tencent.js`: its parameter interception, SDK task fields, complete callback
  response, and page success verification pass against the local browser fixture.
  One authorized live attempt on October 27, 2026 used a configured Tencent
  target. The example captured `appId` and the Tencent script URL, and the API returned `ret: 0`, a
  ticket, and `randstr`. The original page callback received the complete result,
  but this mobile-WebView page closed the CAPTCHA without exposing a visible DOM
  success state, so the configured acceptance selector timed out. The attempt is
  not recorded as a page pass and was not retried.
- `turnstile-challenge.js`: tested against a configured target on October
  12, 2026. The example captured the live `sitekey`, `action`, `cData`, `chlPageData`,
  and browser User-Agent and created an API task. One task returned a solution,
  but the page did not confirm acceptance; after fixing the browser User-Agent
  mismatch, the next single task returned `ERROR_CAPTCHA_UNSOLVABLE`. The runner
  did not retry it or report a page pass. The interception, SDK task, callback,
  and visible-success verification pass against the local browser fixture.

Raw live reports and failure screenshots stay in the ignored `artifacts/`
directory and are not committed.
