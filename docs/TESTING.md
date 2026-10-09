# Test status

Validated on October 9, 2026 with Node.js 22 and Chrome 154.

## Automated checks

- `npm run check`: passed.
- `npm test`: 19 tests passed.
- Tests use a local page fixture and a local API stub. They do not spend API balance.
- Covered flows: reCAPTCHA v2, proxy task construction, known and discovered
  callbacks, reCAPTCHA v3 script parsing and interception, embedded Turnstile,
  Cloudflare Challenge interception, image capture, coordinate scaling, success
  verification, credential redaction, and configuration validation.

## Live demo checks

The following examples received a solution from Captcha Solver and the demo page
confirmed that the answer was accepted:

- `recaptcha_v2.js` — official Google reCAPTCHA v2 demo.
- `recaptcha_v2_callback_variant1.js`.
- `recaptcha_v2_callback_variant2.js`.
- `recaptcha_v3.js`.
- `recaptcha_v3_extended_js_script.js`.
- `cloudflare_turnstile.js`.
- `normal_captcha_screenshot.js`.
- `normal_captcha_canvas.js`.
- `normal_captcha_screenshot_params.js`.
- `coordinates.js`.

## Pending checks

- `cloudflare_challenge_page.js`: the temporary demo returned a Cloudflare block
  page before its Turnstile widget loaded. The example detected the block and did
  not create an API task. Its interception and callback flow passed the local
  browser test. Retest from another permitted network or against our replacement
  demo page.
- `recaptcha_v2_proxy.js` and `recaptcha_v2_callback_proxy.js`: task fields and
  browser configuration passed local tests. A live proxy was not provided, so no
  end-to-end proxy request was made.

Raw live reports and failure screenshots stay in the ignored `artifacts/`
directory and are not committed.
