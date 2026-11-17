import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { demos } from '../config/demos.js';

/**
 * This example shows how to solve Yandex SmartCaptcha without a proxy. It opens the official
 * demo, extracts the public site key and browser User-Agent, creates a
 * Tasks.YandexSmartCaptchaTaskProxyless task, and uses CaptchaClient.solve(). It logs the returned
 * token, writes it to the demo form, submits the form, and requires the demo's success text as
 * proof that the page accepted the solution.
 *
 * To use this example on another page, change the target URL and verify the site key. Token fields,
 * callbacks, submission, and success indicators are site-specific, so inspect and debug the page
 * before applying the token.
 *
 * How it works:
 * STEP-01 - Configure the target and create the SDK client.
 * STEP-02 - Launch Chromium and open the target page.
 * STEP-03 - Extract the SmartCaptcha parameters from the page.
 * STEP-04 - Create the task and wait for the solver result.
 * STEP-05 - Log and apply the returned token.
 * STEP-06 - Submit the form and verify that the page accepts the token.
 * STEP-07 - Handle errors and close Chromium.
 */

puppeteer.use(StealthPlugin());

const websiteURL = process.env.YANDEX_TARGET_URL || demos.yandexSmartCaptcha;
const siteKeySelector = '.smart-captcha[data-sitekey]';
const tokenSelector = 'input[name="smart-token"]';
const submitSelector = '#smartcaptcha-demo-submit';
const expectedSuccessText = 'Hello, user!';
const client = new CaptchaClient({
  clientKey: process.env.CAPTCHA_API_KEY || 'YOUR_API_KEY',
});
let browser;

/**
 * Solve and submit Yandex SmartCaptcha on an opened Puppeteer page.
 * @param {import('puppeteer').Page} page Open Puppeteer page.
 * @param {CaptchaClient} solver Configured Captcha Solver client.
 * @returns {Promise<string>} Page text that confirms acceptance.
 */
export function solveCaptcha(page, solver = client) {
  let solution;

  // Open the configured target page after main() launches Chromium.
  return (
    page
      .goto(process.env.YANDEX_TARGET_URL || websiteURL, {
        waitUntil: 'domcontentloaded',
      })
      .then(() => page.waitForSelector(siteKeySelector))
      // STEP-03: Extract the SmartCaptcha parameters from the page.
      .then(() =>
        Promise.all([
          page.$eval(siteKeySelector, (element) => element.getAttribute('data-sitekey')),
          page.evaluate(() => navigator.userAgent),
        ]),
      )
      // STEP-04: Create the task and wait for the solver result.
      .then(([websiteKey, userAgent]) => {
        const task = new Tasks.YandexSmartCaptchaTaskProxyless({
          websiteURL: page.url(),
          websiteKey,
          userAgent,
        });
        return solver.solve(task);
      })
      // STEP-05: Log and apply the returned token.
      .then((result) => {
        solution = result;
        console.log('Solution:', solution);
        // Token injection and submission are site-specific; adapt this step to the target page.
        // Inspect the target page's fields, submission flow, and acceptance signals before adapting it.
        return page.$eval(
          tokenSelector,
          (input, token) => {
            input.value = token;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          },
          solution.token,
        );
      })
      // STEP-06: Submit the form and verify that the page accepts the token.
      .then(() => page.click(submitSelector))
      .then(() =>
        page
          .waitForFunction(
            (text) => document.body.innerText.includes(text),
            {},
            expectedSuccessText,
          )
          .then(() => expectedSuccessText),
      )
      .then((message) => {
        console.log(`Page confirmation: ${message}`);
        return message;
      })
  );
}

/** Run the complete standalone Yandex SmartCaptcha example. */
export function main() {
  // STEP-01: Configure the target and create the SDK client.
  console.log('Target:', process.env.YANDEX_TARGET_URL || websiteURL);

  // STEP-02: Launch Chromium and open the target page.
  return (
    puppeteer
      .launch({
        headless: process.env.HEADLESS === 'true',
        defaultViewport: { width: 1280, height: 900 },
      })
      .then((launchedBrowser) => {
        browser = launchedBrowser;
        return browser.newPage();
      })
      .then((page) => solveCaptcha(page))
      // STEP-07: Always close Chromium and let callers handle failures.
      .finally(() => browser?.close())
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Report errors and set a nonzero exit code when this file runs directly.
  main().catch((error) => {
    console.error('Example failed:', error.message);
    process.exitCode = 1;
  });
}
