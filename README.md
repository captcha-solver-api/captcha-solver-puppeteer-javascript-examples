# Captcha Solver examples with JavaScript and Puppeteer

Browser automation examples for the official
[`@captcha-solver-api/javascript-sdk`](https://www.npmjs.com/package/@captcha-solver-api/javascript-sdk).
Each example extracts CAPTCHA parameters, sends a task to Captcha Solver, applies
the answer in Chrome, and waits for the demo page to confirm success.

This private development repository mirrors the scenarios in our
[Selenium Python examples](https://github.com/captcha-solver-api/captcha-solver-selenium-python-examples).
It currently uses temporary demo targets. URLs are collected in
[`config/demos.js`](config/demos.js) so they can be replaced before public release.

## Quick start

Requires Node.js **22.12 or newer** and a Captcha Solver API key with balance.
Puppeteer downloads Chrome for Testing during installation.

```bash
git clone https://github.com/captcha-solver-api/captcha-solver-puppeteer-javascript-examples.git
cd captcha-solver-puppeteer-javascript-examples
npm ci
cp .env.example .env
```

In Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.
Set your key in the local `.env` file:

```dotenv
CAPTCHA_API_KEY=your_api_key
```

Run the official Google reCAPTCHA v2 demo:

```bash
npm run example:recaptcha-v2
# Equivalent:
node examples/recaptcha_v2.js
```

Chrome opens visibly by default. Set `HEADLESS=true` to run without a window.
The browser closes after the result; `KEEP_OPEN_MS` controls the viewing delay.
To use an existing Chrome installation, set `BROWSER_EXECUTABLE_PATH` to its full
path. The `.env` file is resolved relative to the repository, not the shell's
current directory.

## Examples

| Scenario | File | npm command |
| --- | --- | --- |
| reCAPTCHA v2, official Google demo | [recaptcha_v2.js](examples/recaptcha_v2.js) | `npm run example:recaptcha-v2` |
| reCAPTCHA v2 with proxy | [recaptcha_v2_proxy.js](examples/recaptcha_v2_proxy.js) | `npm run example:recaptcha-v2-proxy` |
| reCAPTCHA v2, known callback | [recaptcha_v2_callback_variant1.js](examples/recaptcha_v2_callback_variant1.js) | `npm run example:callback` |
| reCAPTCHA v2, discover callback | [recaptcha_v2_callback_variant2.js](examples/recaptcha_v2_callback_variant2.js) | `npm run example:callback-auto` |
| Callback with proxy | [recaptcha_v2_callback_proxy.js](examples/recaptcha_v2_callback_proxy.js) | `npm run example:callback-proxy` |
| reCAPTCHA v3, read page scripts | [recaptcha_v3.js](examples/recaptcha_v3.js) | `npm run example:recaptcha-v3` |
| reCAPTCHA v3, intercept `execute()` | [recaptcha_v3_extended_js_script.js](examples/recaptcha_v3_extended_js_script.js) | `npm run example:recaptcha-v3-extended` |
| Embedded Turnstile | [cloudflare_turnstile.js](examples/cloudflare_turnstile.js) | `npm run example:turnstile` |
| Cloudflare Challenge page | [cloudflare_challenge_page.js](examples/cloudflare_challenge_page.js) | `npm run example:challenge` |
| Image CAPTCHA screenshot | [normal_captcha_screenshot.js](examples/normal_captcha_screenshot.js) | `npm run example:image` |
| Original image through canvas | [normal_captcha_canvas.js](examples/normal_captcha_canvas.js) | `npm run example:image-canvas` |
| Image with recognition hints | [normal_captcha_screenshot_params.js](examples/normal_captcha_screenshot_params.js) | `npm run example:image-params` |
| Coordinates and mouse clicks | [coordinates.js](examples/coordinates.js) | `npm run example:coordinates` |

Variants reuse the base example's flow to keep the browser and task logic in one
place. Each file can be run directly. The `flow({ page, solver })` functions are
also importable when integrating into an existing browser session.

## Configuration

Copy the documented options from [`.env.example`](.env.example).

| Variable | Default | Purpose |
| --- | --- | --- |
| `CAPTCHA_API_KEY` | Required | Your Captcha Solver key; sent only to our API |
| `TARGET_URL` | Per-example demo | Override when testing another page |
| `HEADLESS` | `false` | Hide the Chrome window when `true` |
| `BROWSER_EXECUTABLE_PATH` | Puppeteer's Chrome | Use a specific Chrome executable |
| `BROWSER_USER_AGENT` | Browser default | Optional starting browser identity |
| `PAGE_TIMEOUT_MS` | `60000` | Navigation, element, and success-message timeout |
| `SOLVE_TIMEOUT_MS` | `180000` | SDK solve/request timeout |
| `KEEP_OPEN_MS` | `3000` | Pause after success before closing Chrome |
| `PRINT_SOLUTION` | `false` | Print the complete returned answer when `true` |
| `SUCCESS_SELECTOR` | `.recaptcha-success, p[class*="successMessage"]` | Page element confirming verification; Challenge defaults to `p[class*="successMessage"]` |
| `SUBMIT_SELECTOR` | Submit button/input | Override the form submission control |
| `CALLBACK_NAME` | Per-example demo callback | Known v2 or v3 callback, including dotted names |
| `RECAPTCHA_SITEKEY`, `RECAPTCHA_ACTION` | Automatic discovery | Override v3 script parsing together |
| `RECAPTCHA_MIN_SCORE` | `0.3` | Requested v3 score |

Changing the target URL may also require changing selectors in the example.
For v3, the ordinary example recognizes literal `grecaptcha.execute(sitekey,
{action})` calls in inline scripts. The extended example captures the call before
page scripts execute and resolves its promise with the API answer, including
when the call originates in an external script. It currently targets standard
v3, not Enterprise. It clicks Check to trigger `execute()` when the page has not
already called it on load. Both variants let the demo callback verify the token;
they do not click Check again afterwards. Parameter overrides do not replace the
extended variant's need to capture a live `execute()` call.

For Cloudflare Challenge, dynamic `action`, `cData`, `chlPageData`, and callback
are captured before navigation. If the API returns `userAgent`, the example
applies it before invoking the callback. An already passed Challenge exits
without creating a paid task. Some Challenge pages can reject an automated
browser before the widget appears; that is reported as a failed live check.

Canvas capture requires a same-origin or CORS-enabled image. The screenshot
variant does not have this canvas restriction. Coordinate answers are scaled
from the original image dimensions to the displayed element before clicking.

## Proxy examples

Configure a proxy in `.env` before using either `*_proxy.js` example:

```dotenv
PROXY_TYPE=http
PROXY_ADDRESS=proxy.example.com
PROXY_PORT=8080
PROXY_LOGIN=
PROXY_PASSWORD=
```

The same endpoint is passed to Chrome and the API task. HTTP proxies can use
username/password authentication. SOCKS4/SOCKS5 are supported without credentials
because Chrome does not support authenticated SOCKS proxies. No proxy is bundled.

## Tests and diagnostics

```bash
npm run check
npm test
```

These checks use a local HTTP server, local CAPTCHA page fixtures, a stub API,
and headless Chrome. They do not contact a solving service or spend balance.
They cover token injection, callbacks, v3 interception, Challenge parameters,
User-Agent propagation, image capture, coordinate scaling, and false success
prevention. CI runs these checks without an API key.

Live tests create paid API tasks with your configured key:

```bash
# All non-proxy examples, sequentially; one attempt per example:
npm run test:live

# Selected examples only (file names without .js):
npm run test:live -- recaptcha_v2 normal_captcha_canvas
```

A token returned by the API does not count as a passing test. Each example waits
for visible page confirmation. Live JSON reports and failure screenshots are
saved in ignored `artifacts/`. Keys are excluded from diagnostics and `.env` is
ignored by Git. There are no automatic paid retries.

See [`docs/TESTING.md`](docs/TESTING.md) for the recorded validation status and
[`docs/RELEASE-CHECKLIST.md`](docs/RELEASE-CHECKLIST.md) for the remaining release work.

## Links

- [API documentation](https://captcha-solver.com/en/docs/captcha-types)
- [JavaScript SDK](https://github.com/captcha-solver-api/javascript-sdk)
- [Python Selenium examples](https://github.com/captcha-solver-api/captcha-solver-selenium-python-examples)
- [Puppeteer documentation](https://pptr.dev/)

## License

[MIT](LICENSE.md), Captcha Solver Team.
