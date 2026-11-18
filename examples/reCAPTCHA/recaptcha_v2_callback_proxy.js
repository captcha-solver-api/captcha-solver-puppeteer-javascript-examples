import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

/**
 * Solve callback-based reCAPTCHA v2 through the same proxy in Chromium and the API. It uses
 * Tasks.RecaptchaV2 and CaptchaClient.solve(). Callback delivery is verified, but does not by
 * itself prove server-side acceptance.
 *
 * How it works:
 * STEP-01 - Read proxy settings and configure the SDK client.
 * STEP-02 - Launch Chromium through the proxy and open the target.
 * STEP-03 - Extract the widget parameters.
 * STEP-04 - Create and solve a proxy-based task.
 * STEP-05 - Log the solution and invoke the configured callback.
 * STEP-06 - Confirm callback delivery.
 * STEP-07 - Handle errors and close Chromium.
 */

puppeteer.use(StealthPlugin());
const websiteURL =
  process.env.RECAPTCHA_V2_TARGET_URL || 'https://www.google.com/recaptcha/api2/demo';
const client = new CaptchaClient({ clientKey: process.env.CAPTCHA_API_KEY || 'YOUR_API_KEY' });
let browser;

/** Read and validate proxy settings from the environment. */
function getProxy() {
  const proxyPort = Number(process.env.PROXY_PORT);
  if (!process.env.PROXY_ADDRESS || !Number.isInteger(proxyPort)) {
    throw new Error('Set PROXY_ADDRESS and PROXY_PORT for the proxy example.');
  }
  return {
    proxyType: process.env.PROXY_TYPE || 'http',
    proxyAddress: process.env.PROXY_ADDRESS,
    proxyPort,
    proxyLogin: process.env.PROXY_LOGIN || undefined,
    proxyPassword: process.env.PROXY_PASSWORD || undefined,
  };
}

/** Solve proxy-based reCAPTCHA v2 and invoke a named page callback. */
export function solveCaptcha(page, solver = client, proxy = getProxy()) {
  // STEP-02: Open the target through Chromium's configured proxy.
  return (
    page
      .goto(process.env.RECAPTCHA_V2_TARGET_URL || websiteURL, { waitUntil: 'domcontentloaded' })
      // STEP-03: Read widget parameters and browser identity.
      .then(() =>
        Promise.all([
          page.$eval('[data-sitekey]', (element) => ({
            websiteKey: element.getAttribute('data-sitekey'),
            isInvisible: element.getAttribute('data-size') === 'invisible',
          })),
          page.evaluate(() => navigator.userAgent),
        ]),
      )
      // STEP-04: Create the proxy task with the same network identity.
      .then(([captcha, userAgent]) =>
        solver.solve(
          new Tasks.RecaptchaV2({
            websiteURL: page.url(),
            ...captcha,
            ...proxy,
            userAgent,
          }),
        ),
      )
      .then((solution) => {
        // STEP-05: Token injection and submission are site-specific; this page uses a callback.
        console.log('Solution:', solution);
        if (!solution.gRecaptchaResponse)
          throw new Error('Captcha Solver returned an empty token.');
        const callbackName = process.env.RECAPTCHA_V2_CALLBACK || 'verifyDemoRecaptcha';
        return page
          .evaluate(
            (name, token) => {
              const parts = name.split('.');
              let owner = window;
              for (const part of parts.slice(0, -1)) owner = owner?.[part];
              const callback = owner?.[parts.at(-1)];
              if (typeof callback !== 'function')
                throw new Error(`Callback ${name} was not found.`);
              callback.call(owner, token);
              window.__captchaCallbackToken = token;
            },
            callbackName,
            solution.gRecaptchaResponse,
          )
          .then(() => solution.gRecaptchaResponse);
      })
      // STEP-06: Confirm callback delivery separately from the SDK result.
      .then((token) =>
        page.waitForFunction((expected) => window.__captchaCallbackToken === expected, {}, token),
      )
      .then(() => 'reCAPTCHA callback received the solver token through the proxy flow.')
  );
}

/** Run the complete standalone proxy callback example. */
export function main() {
  // STEP-01: Validate proxy configuration before launching Chromium.
  const proxy = getProxy();
  const endpoint = `${proxy.proxyType}://${proxy.proxyAddress}:${proxy.proxyPort}`;
  return (
    puppeteer
      .launch({ headless: process.env.HEADLESS === 'true', args: [`--proxy-server=${endpoint}`] })
      .then((instance) => {
        browser = instance;
        return browser.newPage();
      })
      .then((page) => {
        const authentication = proxy.proxyLogin
          ? page.authenticate({ username: proxy.proxyLogin, password: proxy.proxyPassword })
          : page.evaluate(() => true);
        return authentication.then(() => solveCaptcha(page, client, proxy));
      })
      .then((message) => console.log(`Page confirmation: ${message}`))
      // STEP-07: Always close Chromium.
      .finally(() => browser?.close())
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
