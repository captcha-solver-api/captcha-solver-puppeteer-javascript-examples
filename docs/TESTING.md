# Test status

Automated checks validated on November 18, 2026 with local Node.js 24 and Chrome 155. The CI
matrix also covers Node.js 22.12.

## Automated checks

- `npm run lint`: passed.
- `npm run check`: passed (includes lint).
- `npm test`: 16 browser integration tests and 1 SDK request test passed.
- `npm audit --package-lock-only`: passed with no known vulnerabilities.
- Tests use a local page fixture and a local API stub. They do not spend API balance.
- Browser fixtures use the same Puppeteer Extra stealth setup as the examples.
- Covered flows: reCAPTCHA v2 form, named callback, discovered callback, proxy form and proxy
  callback variants, reCAPTCHA v3 script parsing, embedded Turnstile,
  reCAPTCHA Enterprise, Cloudflare Challenge navigation/HTTP verification and Tencent interception, Yandex
  SmartCaptcha token injection, GeeTest v3/v4 submission, solution injection, and visible success
  verification.
- The Yandex image test verifies that the example sends `SmartCaptchaTask` with `image` and
  `imgInstructions`, without calling the paid API.

## Live demo checks

The following examples received a solution from Captcha Solver and the demo page
confirmed that the answer was accepted:

- `examples/reCAPTCHA/recaptcha_v2.js` — official Google reCAPTCHA v2 demo.
- `examples/reCAPTCHA/recaptcha_v3.js`.
- `examples/cloudflare/turnstile.js` — the API returned a solution and the configured
  test page confirmed acceptance on October 12, 2026.

## Pending checks

- `examples/reCAPTCHA/recaptcha_v2_enterprise.js`, `examples/geetest/geetest_v3.js`, and
  `examples/geetest/geetest_v4.js`: task
  construction, solution submission, and acceptance verification pass against
  local browser fixtures. They have not been live-tested from this repository.
- `examples/coordinates/coordinates.js`, `examples/normal_captcha/image_to_text.js`, and
  `examples/balance.js`: syntax, lint, formatting, and
  workflow-guide checks pass. Their paid API calls were not run locally.
- `examples/yandex/yandex_smartcaptcha_image.js`: the specialized `SmartCaptchaTask` request and returned
  coordinates pass against a local API stub. Its paid API call was not run locally.
- `examples/yandex/yandex_smartcaptcha.js`: task construction, token injection, form submission,
  and page success verification pass against the local browser fixture. The
  official Yandex demo has not been live-tested from this repository yet.
- `examples/tencent/tencent.js`: its parameter interception, SDK task fields, complete callback
  response, and page success verification pass against the local browser fixture.
  One authorized live attempt on October 27, 2026 used a configured Tencent
  target. The example captured `appId` and the Tencent script URL, and the API returned `ret: 0`, a
  ticket, and `randstr`. The original page callback received the complete result,
  but this mobile-WebView page closed the CAPTCHA without exposing a visible DOM
  success state, so the configured acceptance selector timed out. The attempt is
  not recorded as a page pass and was not retried.
- `examples/cloudflare/turnstile_challenge.js`: tested against a configured target on October
  12, 2026. The example captured the live `sitekey`, `action`, `cData`, `chlPageData`,
  and browser User-Agent and created an API task. One task returned a solution,
  but the page did not confirm acceptance; after fixing the browser User-Agent
  mismatch, the next single task returned `ERROR_CAPTCHA_UNSOLVABLE`. The runner
  did not retry it or report a page pass. The interception, SDK task, callback,
  and visible-success verification pass against the local browser fixture.

Raw live reports and failure screenshots stay in the ignored `artifacts/`
directory and are not committed.
