# Captcha solving examples with JavaScript and Puppeteer

Ready-to-run browser automation examples for the official
[`@captcha-solver-api/javascript-sdk`](https://www.npmjs.com/package/@captcha-solver-api/javascript-sdk).
They show how to detect captcha parameters on a live page, create the correct API
task, receive a solution, and apply it in a Puppeteer browser session.

The repository includes reCAPTCHA v2 and v3, callback-based reCAPTCHA,
Cloudflare Turnstile and Challenge pages, Tencent CAPTCHA, image recognition,
coordinate captchas, and proxy-based flows.

## Contents

- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Available examples](#available-examples)
- [reCAPTCHA examples](#recaptcha-examples)
- [Cloudflare examples](#cloudflare-examples)
- [Tencent CAPTCHA](#tencent-captcha)
- [Image and coordinate examples](#image-and-coordinate-examples)
- [Proxy configuration](#proxy-configuration)
- [How the examples work](#how-the-examples-work)
- [Troubleshooting](#troubleshooting)
- [Development checks](#development-checks)
- [Useful links](#useful-links)
- [Documentation](#documentation)

## Requirements

- Node.js 22.12 or newer
- A Captcha Solver API key with sufficient balance
- A working proxy for examples whose filename ends in `_proxy.js`

Puppeteer downloads Chrome for Testing during installation.

## Quick start

```bash
git clone https://github.com/captcha-solver-api/captcha-solver-puppeteer-javascript-examples.git
cd captcha-solver-puppeteer-javascript-examples
npm ci
cp .env.example .env
```

On Windows PowerShell, copy the configuration with:

```powershell
Copy-Item .env.example .env
```

Add your API key and the page you are authorized to test to `.env`:

```dotenv
CAPTCHA_API_KEY=your_api_key
TARGET_URL=https://your-site.example/captcha-page
```

Before running an example other than `recaptcha_v2.js`, set `TARGET_URL` to your
page. Each example expects the matching captcha type and may require selectors
or callback names from that page.

The reCAPTCHA v2 example uses Google's official public demo when `TARGET_URL` is
blank:

```bash
npm run example:recaptcha-v2
```

Chrome opens visibly by default. Set `HEADLESS=true` to run without a window.
The browser closes after the result; `KEEP_OPEN_MS` controls the viewing delay.
Set `BROWSER_EXECUTABLE_PATH` to use an existing Chrome installation.

## Available examples

| Captcha type | Example | What it demonstrates |
|---|---|---|
| reCAPTCHA v2 | [`recaptcha_v2.js`](examples/recaptcha_v2.js) | Extract the sitekey, inject the response token, and submit |
| reCAPTCHA v2 + proxy | [`recaptcha_v2_proxy.js`](examples/recaptcha_v2_proxy.js) | Use the same proxy for Chrome and the API task |
| reCAPTCHA v2 callback | [`recaptcha_v2_callback_variant1.js`](examples/recaptcha_v2_callback_variant1.js) | Call a callback whose name is known |
| reCAPTCHA v2 callback | [`recaptcha_v2_callback_variant2.js`](examples/recaptcha_v2_callback_variant2.js) | Discover the callback automatically |
| Callback + proxy | [`recaptcha_v2_callback_proxy.js`](examples/recaptcha_v2_callback_proxy.js) | Combine callback submission with a matching proxy |
| reCAPTCHA v3 | [`recaptcha_v3.js`](examples/recaptcha_v3.js) | Find `sitekey` and `action` in page scripts |
| reCAPTCHA v3 interception | [`recaptcha_v3_extended_js_script.js`](examples/recaptcha_v3_extended_js_script.js) | Capture a live `grecaptcha.execute()` call |
| Cloudflare Turnstile | [`cloudflare_turnstile.js`](examples/cloudflare_turnstile.js) | Solve an embedded widget and submit its form |
| Cloudflare Challenge | [`cloudflare_challenge_page.js`](examples/cloudflare_challenge_page.js) | Intercept dynamic parameters and invoke the captured callback |
| Tencent CAPTCHA | [`tencent.js`](examples/tencent.js) | Capture `appId` and return the complete solution to the original callback |
| Image captcha | [`normal_captcha_screenshot.js`](examples/normal_captcha_screenshot.js) | Capture the element as a screenshot |
| Image captcha | [`normal_captcha_canvas.js`](examples/normal_captcha_canvas.js) | Extract the original image through canvas |
| Image captcha + hints | [`normal_captcha_screenshot_params.js`](examples/normal_captcha_screenshot_params.js) | Supply numeric and length constraints |
| Coordinate captcha | [`coordinates.js`](examples/coordinates.js) | Scale returned coordinates and click the image |

## reCAPTCHA examples

### reCAPTCHA v2

[`recaptcha_v2.js`](examples/recaptcha_v2.js) reads the widget's `data-sitekey`,
creates a `RecaptchaV2TaskProxyless`, places the returned token into
`g-recaptcha-response`, and submits the form.

### reCAPTCHA v2 callbacks

[`recaptcha_v2_callback_variant1.js`](examples/recaptcha_v2_callback_variant1.js)
uses a known callback name. [`recaptcha_v2_callback_variant2.js`](examples/recaptcha_v2_callback_variant2.js)
searches the live reCAPTCHA client configuration and invokes the callback it finds.

### reCAPTCHA v3

[`recaptcha_v3.js`](examples/recaptcha_v3.js) inspects page scripts for the
`sitekey` and action. The extended example captures `grecaptcha.execute()` before
page scripts run and resolves its promise with the API answer.

## Cloudflare examples

[`cloudflare_turnstile.js`](examples/cloudflare_turnstile.js) extracts an embedded
widget's sitekey, fills `cf-turnstile-response`, and submits its form.

[`cloudflare_challenge_page.js`](examples/cloudflare_challenge_page.js) captures
dynamic `action`, `cData`, `chlPageData`, User-Agent, and callback fields before
navigation. It applies the returned solution to the captured callback.

## Tencent CAPTCHA

[`tencent.js`](examples/tencent.js) installs its interceptor before navigation,
captures the page's `TencentCaptcha` constructor call, creates a
`TencentTaskProxyless`, and passes the complete solution to the original callback.

The repository does not include a target site. Configure your own page and the
element that proves successful verification:

```dotenv
TARGET_URL=https://your-site.example/tencent-captcha
TENCENT_TRIGGER_SELECTOR=#open-captcha
TENCENT_SUCCESS_SELECTOR=.verification-success
```

Leave `TENCENT_TRIGGER_SELECTOR` blank when the page opens Tencent CAPTCHA
automatically. `TENCENT_SUCCESS_SELECTOR` is required because receiving an API
answer alone does not prove that the page accepted it.

```bash
npm run example:tencent
```

## Image and coordinate examples

The screenshot example captures the displayed element. The canvas example reads
the original image dimensions and requires a same-origin or CORS-enabled image.
The coordinate example scales API coordinates to the displayed element before
clicking it.

## Proxy configuration

```dotenv
PROXY_TYPE=http
PROXY_ADDRESS=proxy.example.com
PROXY_PORT=8080
PROXY_LOGIN=
PROXY_PASSWORD=
```

The same endpoint is passed to Chrome and the API task. HTTP proxies can use
username/password authentication. Chrome supports SOCKS4/SOCKS5 here without
credentials.

## How the examples work

Every script follows the same reusable sequence:

1. Open the target page in Chrome.
2. Extract fresh captcha parameters or image data from the page.
3. Create the matching task from the JavaScript SDK.
4. Call `CaptchaClient.solve()` and wait for the solution.
5. Apply the returned token, text, coordinates, or callback data.
6. Wait for the page's visible success state.

Shared code in [`lib`](lib) loads configuration, launches Chrome, captures page
parameters, applies answers, and records failure diagnostics.

## Troubleshooting

### API key is missing

Create `.env` in the repository root and set `CAPTCHA_API_KEY`.

### Chrome does not start

Run `npm ci` again or set `BROWSER_EXECUTABLE_PATH` to a compatible Chrome binary.

### A page changed its markup

Update `TARGET_URL` and the relevant selector variables. Captcha demo and
production pages can change without a release of this repository.

### Tencent parameters are not captured

The page must construct `TencentCaptcha` after the interceptor is installed. Set
`TENCENT_TRIGGER_SELECTOR` to the button that opens the captcha, or leave it blank
if the page opens the captcha during load.

### A proxy example times out

Confirm that the proxy can open the target page and that its credentials are
valid. The browser and API task must use the same proxy.

## Development checks

```bash
npm run check
npm test
```

Tests use a local site, stub API, and headless Chrome. They do not contact the
solving service or spend balance. Live tests are explicit:

```bash
npm run test:live
npm run test:live -- tencent
```

## Build Faster with AI

Give [`llms.txt`](https://captcha-solver.com/llms.txt) to your AI assistant while
adapting an example to your page.

```text
Read https://captcha-solver.com/llms.txt and adapt the matching Puppeteer
JavaScript example from this repository to my target page.
```

## Useful links

- [JavaScript SDK](https://github.com/captcha-solver-api/javascript-sdk)
- [Python Selenium examples](https://github.com/captcha-solver-api/captcha-solver-selenium-python-examples)
- [Puppeteer documentation](https://pptr.dev/)

## Documentation

- [Captcha Solver API documentation](https://captcha-solver.com/en/docs/captcha-types)
- [JavaScript package on npm](https://www.npmjs.com/package/@captcha-solver-api/javascript-sdk)

Use these examples only on websites you own or are authorized to automate.

## License

This project is available under the MIT License. See [LICENSE.md](LICENSE.md).
