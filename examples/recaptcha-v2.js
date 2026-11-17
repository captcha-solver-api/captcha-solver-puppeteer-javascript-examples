import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { demos } from '../config/demos.js';

/**
 * This example shows how to solve Google reCAPTCHA v2 without using a proxy. It opens the demo
 * page, extracts the site key and widget options, sends the task to the service, inserts the
 * returned token into the form, and verifies that the page accepts it. It uses
 * Tasks.RecaptchaV2Proxyless and CaptchaClient.solve().
 *
 * To use this example on another page, change the target URL and update the site-key selector.
 * Token fields, callbacks, form submission, and success indicators are site-specific, so inspect
 * and debug the target page before adapting the token application step.
 *
 * How it works:
 * STEP-01 - Configure the target and create the SDK client.
 * STEP-02 - Launch Chromium and open the target page.
 * STEP-03 - Extract the reCAPTCHA parameters from the page.
 * STEP-04 - Create the task and wait for the solver result.
 * STEP-05 - Log the solution and inject its token into the form.
 * STEP-06 - Submit the form and verify that the page accepts the token.
 * STEP-07 - Handle errors and close Chromium.
 */

puppeteer.use(StealthPlugin());

// STEP-01: Read the target URL and create the SDK client.
const websiteURL = process.env.RECAPTCHA_V2_TARGET_URL || demos.recaptchaV2;
const client = new CaptchaClient({
  clientKey: process.env.CAPTCHA_API_KEY || 'YOUR_API_KEY',
});

let browser;

/**
 * Solve and submit reCAPTCHA v2 on an opened Puppeteer page.
 * @param {import('puppeteer').Page} page Open Puppeteer page.
 * @param {CaptchaClient} solver Configured Captcha Solver client.
 * @returns {Promise<string>} Page text that confirms acceptance.
 */
export function solveCaptcha(page, solver = client) {
  const siteKeySelector = '[data-sitekey]';
  const submitSelector =
    process.env.SUBMIT_SELECTOR || 'button[type="submit"], input[type="submit"]';
  const successSelector =
    process.env.SUCCESS_SELECTOR || '.recaptcha-success, p[class*="successMessage"]';

  // STEP-02: Open the configured page containing reCAPTCHA v2.
  return (
    page
      .goto(process.env.RECAPTCHA_V2_TARGET_URL || websiteURL, { waitUntil: 'domcontentloaded' })
      .then(() => page.waitForSelector(siteKeySelector))
      // STEP-03: Extract widget options and the browser User-Agent from the page.
      .then(() =>
        Promise.all([
          page.$eval(siteKeySelector, (element) => ({
            websiteKey: element.getAttribute('data-sitekey'),
            isInvisible: element.getAttribute('data-size') === 'invisible',
            recaptchaDataSValue: element.getAttribute('data-s') || undefined,
          })),
          page.evaluate(() => navigator.userAgent),
        ]),
      )
      // STEP-04: Build the task and wait for the solver result.
      .then(([captcha, userAgent]) => {
        if (!captcha.websiteKey) throw new Error('reCAPTCHA site key not found.');
        const task = new Tasks.RecaptchaV2Proxyless({
          websiteURL: page.url(),
          ...captcha,
          userAgent,
        });
        return solver.solve(task);
      })
      // STEP-05: Log the solution and inject its token into the form.
      .then((solution) => {
        console.log('Solution:', solution);
        if (!solution.gRecaptchaResponse) {
          throw new Error('Captcha Solver returned an empty reCAPTCHA token.');
        }

        // Token injection and submission are site-specific; adapt this step to the target page.
        // Put the token into the field that this form sends to its verification endpoint.
        return page.evaluate((token) => {
          let response = document.querySelector('[name="g-recaptcha-response"]');
          if (!response) {
            response = document.createElement('textarea');
            response.name = 'g-recaptcha-response';
            document.querySelector('form')?.append(response);
          }
          response.value = token;
          response.dispatchEvent(new Event('input', { bubbles: true }));
          response.dispatchEvent(new Event('change', { bubbles: true }));
        }, solution.gRecaptchaResponse);
      })
      // STEP-06: Submit the form and require an explicit page confirmation.
      .then(() => page.click(submitSelector))
      .then(() => page.waitForSelector(successSelector, { visible: true }))
      .then(() => page.$eval(successSelector, (element) => element.textContent.trim()))
  );
}

/** Run the complete standalone reCAPTCHA v2 example. */
export function main() {
  // Launch Chromium and create a browser page.
  return (
    puppeteer
      .launch({
        headless: process.env.HEADLESS === 'true',
        executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
        defaultViewport: { width: 1280, height: 900 },
      })
      .then((instance) => {
        browser = instance;
        return browser.newPage();
      })
      .then((page) => solveCaptcha(page))
      .then((message) => console.log(`Page confirmation: ${message}`))
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
