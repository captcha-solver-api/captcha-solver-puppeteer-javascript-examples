import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

/**
 * This example shows how to solve a standalone Cloudflare Turnstile widget without using a proxy.
 * It opens the page, extracts the site key and browser User-Agent, sends the task to the service,
 * inserts the returned token into the form, and checks the page confirmation. It uses
 * Tasks.TurnstileProxyless and CaptchaClient.solve().
 *
 * To use this example on another page, change the target URL and update the widget and form
 * selectors. Token injection and submission are site-specific. You must inspect the target page
 * and determine the correct way to pass the token yourself.
 *
 * How it works:
 * STEP-01 - Configure the target and create the SDK client.
 * STEP-02 - Launch Chromium and open the target page.
 * STEP-03 - Extract the Turnstile parameters from the page.
 * STEP-04 - Create the task and wait for the solver result.
 * STEP-05 - Log the solution and inject its token into the form.
 * STEP-06 - Submit the form and verify that the page accepts the token.
 * STEP-07 - Handle errors and close Chromium.
 */

puppeteer.use(StealthPlugin());

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

// STEP-01: Read the target URL and create the SDK client.
const websiteURL = process.env.TURNSTILE_TARGET_URL || 'https://example.com/page_with_turnstile';
const client = new CaptchaClient({
  clientKey: process.env.CAPTCHA_API_KEY || 'YOUR_API_KEY',
});

let browser;

/**
 * Solve and submit Turnstile on an opened Puppeteer page.
 * @param {import('puppeteer').Page} page Open Puppeteer page.
 * @param {CaptchaClient} solver Configured Captcha Solver client.
 * @returns {Promise<string>} Page text that confirms acceptance.
 */
export function solveCaptcha(page, solver = client) {
  const widgetSelector = '.cf-turnstile[data-sitekey], [data-sitekey]';
  const responseSelector = '[name="cf-turnstile-response"]';
  const submitSelector = 'button[type="submit"], input[type="submit"]';
  const successSelector = 'p[class*="successMessage"]';

  // STEP-02: Open the configured page containing Turnstile.
  return (
    page
      .goto(process.env.TURNSTILE_TARGET_URL || websiteURL, { waitUntil: 'domcontentloaded' })
      .then(() => page.waitForSelector(widgetSelector))
      // STEP-03: Read the public site key and browser User-Agent from the page.
      .then(() =>
        Promise.all([
          page.$eval(widgetSelector, (element) => element.getAttribute('data-sitekey')),
          page.evaluate(() => navigator.userAgent),
        ]),
      )
      // STEP-04: Build the task and wait for the solver result.
      .then(([websiteKey, userAgent]) => {
        if (!websiteKey) throw new Error('Turnstile site key not found.');
        const task = new Tasks.TurnstileProxyless({
          websiteURL: page.url(),
          websiteKey,
          userAgent,
        });
        return solveAndLogTaskId(solver, task);
      })
      // STEP-05: Log the solution and inject its token into the form.
      .then((solution) => {
        console.log('Solution:', solution);
        if (!solution.token) throw new Error('Captcha Solver returned an empty Turnstile token.');

        // Token injection and submission are site-specific; adapt this step to the target page.
        // Turnstile forms submit the token through cf-turnstile-response.
        return page.$eval(
          responseSelector,
          (input, token) => {
            input.value = token;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          },
          solution.token,
        );
      })
      // STEP-06: Submit the form and require an explicit page confirmation.
      .then(() => page.click(submitSelector))
      .then(() => page.waitForSelector(successSelector, { visible: true }))
      .then(() => page.$eval(successSelector, (element) => element.textContent.trim()))
  );
}

/** Run the complete standalone Turnstile example. */
export function main() {
  // Launch Chromium and create a browser page.
  return (
    puppeteer
      .launch({
        headless: process.env.HEADLESS === 'true',
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
    console.error(error);
    process.exitCode = 1;
  });
}
