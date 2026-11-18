import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

/** Solve a task with the SDK and log the task ID returned by createTask(). */
function solveAndLogTaskId(solver, task) {
  const loggingSolver = Object.create(solver);
  loggingSolver.createTask = (...args) =>
    solver.createTask(...args).then((taskId) => {
      console.log('Task ID:', taskId);
      return taskId;
    });
  return loggingSolver.solve(task);
}

/**
 * Solve reCAPTCHA v2 when the callback name is unknown. The example discovers the callback in
 * the widget or reCAPTCHA client configuration, then uses Tasks.RecaptchaV2Proxyless and
 * CaptchaClient.solve(). Callback delivery is verified separately from the solver result.
 * Token injection and submission are site-specific. You must inspect the target page and
 * determine the correct way to pass the token yourself.
 *
 * How it works:
 * STEP-01 - Configure the SDK client and target.
 * STEP-02 - Launch Chromium and open the target page.
 * STEP-03 - Extract the reCAPTCHA parameters and discover the widget callback.
 * STEP-04 - Create the task and wait for the solver result.
 * STEP-05 - Log the solution and invoke the discovered callback.
 * STEP-06 - Confirm that the callback received the token.
 * STEP-07 - Handle errors and close Chromium.
 */

puppeteer.use(StealthPlugin());
const websiteURL =
  process.env.RECAPTCHA_V2_TARGET_URL || 'https://www.google.com/recaptcha/api2/demo';
const client = new CaptchaClient({ clientKey: process.env.CAPTCHA_API_KEY || 'YOUR_API_KEY' });
let browser;

/** Discover the active widget callback and retain it inside the page. */
function discoverCaptcha(page) {
  return page
    .waitForFunction(() => {
      const widget = document.querySelector('[data-sitekey][data-callback]');
      if (!widget) return false;
      const parts = widget.dataset.callback.split('.');
      let callback = window;
      for (const part of parts) callback = callback?.[part];
      if (typeof callback !== 'function') return false;
      window.__captchaCallback = callback;
      return {
        websiteKey: widget.dataset.sitekey,
        isInvisible: widget.dataset.size === 'invisible',
      };
    })
    .then((handle) => handle.jsonValue().finally(() => handle.dispose()));
}

/** Solve reCAPTCHA v2 and invoke its automatically discovered callback. */
export function solveCaptcha(page, solver = client) {
  // STEP-02: Open the target page in the launched Chromium instance.
  return (
    page
      .goto(process.env.RECAPTCHA_V2_TARGET_URL || websiteURL, { waitUntil: 'domcontentloaded' })
      // STEP-03: Extract the widget parameters and discover its callback.
      .then(() => Promise.all([discoverCaptcha(page), page.evaluate(() => navigator.userAgent)]))
      // STEP-04: Create the task and wait for the solver result.
      .then(([captcha, userAgent]) =>
        solveAndLogTaskId(
          solver,
          new Tasks.RecaptchaV2Proxyless({ websiteURL: page.url(), ...captcha, userAgent }),
        ),
      )
      .then((solution) => {
        // STEP-05: Token injection and submission are site-specific; this page uses a callback.
        console.log('Solution:', solution);
        if (!solution.gRecaptchaResponse)
          throw new Error('Captcha Solver returned an empty token.');
        return page
          .evaluate((token) => {
            window.__captchaCallback(token);
            window.__captchaCallbackToken = token;
          }, solution.gRecaptchaResponse)
          .then(() => solution.gRecaptchaResponse);
      })
      .then((token) =>
        // STEP-06: Confirm callback delivery without claiming server-side acceptance.
        page
          .waitForFunction((expected) => window.__captchaCallbackToken === expected, {}, token)
          .then(() => 'Discovered reCAPTCHA callback received the solver token.'),
      )
  );
}

/** Run the complete standalone callback-discovery example. */
export function main() {
  // STEP-01: Configure the browser and SDK client above, then launch Chromium.
  return (
    puppeteer
      .launch({ headless: process.env.HEADLESS === 'true' })
      .then((instance) => {
        browser = instance;
        return browser.newPage();
      })
      .then((page) => solveCaptcha(page))
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
