# Test status

Automated checks validated on October 27, 2026 with Node.js 22.12, Node.js 24,
and Chrome 155.

## Automated checks

- `npm run lint`: passed.
- `npm run check`: passed (includes lint).
- `npm test`: 16 browser integration tests passed.
- `npm audit --package-lock-only`: passed with no known vulnerabilities.
- Tests use a local page fixture and a local API stub. They do not spend API balance.
- Browser fixtures use the same Puppeteer Extra stealth setup as the examples.
- Covered flows: reCAPTCHA v2, proxy task construction, known and discovered
  callbacks, reCAPTCHA v3 script parsing and interception, embedded Turnstile,
  Cloudflare Challenge and Tencent interception, Yandex SmartCaptcha token
  injection, image capture, coordinate
  scaling, solution injection, and visible success verification.

## Live demo checks

The following examples received a solution from Captcha Solver and the demo page
confirmed that the answer was accepted:

- `recaptcha_v2.js` — official Google reCAPTCHA v2 demo.
- `recaptcha_v2_callback_variant1.js`.
- `recaptcha_v2_callback_variant2.js`.
- `recaptcha_v3.js`.
- `recaptcha_v3_extended_js_script.js`.
- `cloudflare_turnstile.js` — the API returned a solution and the configured
  test page confirmed acceptance on October 12, 2026.
- `normal_captcha_screenshot.js`.
- `normal_captcha_canvas.js`.
- `normal_captcha_screenshot_params.js`.
- `coordinates.js`.

## Pending checks

- `yandex_smartcaptcha.js`: task construction, token injection, form submission,
  and page success verification pass against the local browser fixture. The
  official Yandex demo has not been live-tested from this repository yet.
- `tencent.js`: its parameter interception, SDK task fields, complete callback
  response, and page success verification pass against the local browser fixture.
  One live attempt on October 27, 2026 used
  `https://common-web.intlgame.com/jssdk/li_captcha_new.html`. The example
  captured `appId` and the Tencent script URL, and the API returned `ret: 0`, a
  ticket, and `randstr`. The original page callback received the complete result,
  but this mobile-WebView page closed the CAPTCHA without exposing a visible DOM
  success state, so the configured acceptance selector timed out. The attempt is
  not recorded as a page pass and was not retried.
- `cloudflare_challenge_page.js`: tested against a configured target on October
  12, 2026. The example captured the live `sitekey`, `action`, `cData`, `chlPageData`,
  and browser User-Agent and created an API task. One task returned a solution,
  but the page did not confirm acceptance; after fixing the browser User-Agent
  mismatch, the next single task returned `ERROR_CAPTCHA_UNSOLVABLE`. The runner
  did not retry it or report a page pass. The interception, SDK task, callback,
  and visible-success verification pass against the local browser fixture.
- `recaptcha_v2_proxy.js` and `recaptcha_v2_callback_proxy.js`: tested on
  October 12, 2026 with an authenticated EU HTTP proxy. Proxy authentication and
  outbound connectivity succeeded, and both examples created `RecaptchaV2Task`
  requests using the same proxy as Chrome. Each single API task returned
  `ERROR_CAPTCHA_UNSOLVABLE`; the runner did not retry either task or report a
  page pass. Proxy credentials were not written to the repository or report.

Raw live reports and failure screenshots stay in the ignored `artifacts/`
directory and are not committed.
