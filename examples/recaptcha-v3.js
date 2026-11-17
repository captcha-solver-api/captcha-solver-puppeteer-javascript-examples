import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

/**
 * This example shows how to solve score-based Google reCAPTCHA v3 without using a proxy. It opens
 * the page, extracts the site key and action, sends the task to the service, passes the returned
 * token to the page callback, and checks the confirmation. It uses Tasks.RecaptchaV3Proxyless and
 * CaptchaClient.solve().
 *
 * To use this example on another page, change the target URL and verify how the site key, action,
 * minimum score, callback, and acceptance signal are configured. Callback delivery alone does not
 * prove server-side acceptance.
 *
 * How it works:
 * STEP-01 - Configure the target, task options, and SDK client.
 * STEP-02 - Launch Chromium and open the target page.
 * STEP-03 - Extract the reCAPTCHA site key and action from the page.
 * STEP-04 - Create the task and wait for the solver result.
 * STEP-05 - Log the solution and pass its token to the page callback.
 * STEP-06 - Verify that the page accepts the token.
 * STEP-07 - Handle errors and close Chromium.
 */

puppeteer.use(StealthPlugin());

// STEP-01: Read the target and task options, then create the SDK client.
const websiteURL =
  process.env.RECAPTCHA_V3_TARGET_URL || 'https://example.com/page_with_recaptcha_v3';
const minimumScore = Number(process.env.RECAPTCHA_MIN_SCORE || 0.3);
const client = new CaptchaClient({
  clientKey: process.env.CAPTCHA_API_KEY || 'YOUR_API_KEY',
});

let browser;

/**
 * Solve reCAPTCHA v3 on an opened Puppeteer page.
 * @param {import('puppeteer').Page} page Open Puppeteer page.
 * @param {CaptchaClient} solver Configured Captcha Solver client.
 * @returns {Promise<string>} Page text that confirms acceptance.
 */
export function solveCaptcha(page, solver = client) {
  const callbackName = process.env.CALLBACK_NAME || 'verifyRecaptcha';
  const successSelector = process.env.SUCCESS_SELECTOR || 'p[class*="successMessage"]';

  // STEP-02: Open the configured page containing reCAPTCHA v3.
  return (
    page
      .goto(process.env.RECAPTCHA_V3_TARGET_URL || websiteURL, { waitUntil: 'domcontentloaded' })
      // STEP-03: Extract the site key and action from grecaptcha.execute(); v3 has no widget.
      .then(() =>
        page.waitForFunction(
          (configuredSiteKey, configuredAction) => {
            if (configuredSiteKey && configuredAction) {
              return { websiteKey: configuredSiteKey, pageAction: configuredAction };
            }
            const source = Array.from(document.scripts, (script) => script.textContent).join('\n');
            const match = source.match(
              /grecaptcha\.execute\s*\(\s*['"](?<websiteKey>[^'"]+)['"]\s*,\s*\{[^}]*action\s*:\s*['"](?<pageAction>[^'"]+)['"]/,
            );
            return match?.groups || false;
          },
          {},
          process.env.RECAPTCHA_SITEKEY || '',
          process.env.RECAPTCHA_ACTION || '',
        ),
      )
      .then((handle) =>
        handle.jsonValue().finally(() => {
          return handle.dispose();
        }),
      )
      // STEP-04: Build the task and wait for the solver result.
      .then(({ websiteKey, pageAction }) => {
        const task = new Tasks.RecaptchaV3Proxyless({
          websiteURL: page.url(),
          websiteKey,
          pageAction,
          minScore: minimumScore,
        });
        return solver.solve(task);
      })
      // STEP-05: Log the solution and pass its token to the configured callback.
      .then((solution) => {
        console.log('Solution:', solution);
        if (!solution.gRecaptchaResponse) {
          throw new Error('Captcha Solver returned an empty reCAPTCHA token.');
        }

        // Token injection and submission are site-specific; adapt this step to the target page.
        // The configured callback submits the token through this page's verification flow.
        return page.evaluate(
          (name, token) => {
            const callback = name.split('.').reduce((value, key) => value?.[key], window);
            if (typeof callback !== 'function') throw new Error(`Callback ${name} was not found.`);
            callback(token);
          },
          callbackName,
          solution.gRecaptchaResponse,
        );
      })
      // STEP-06: Require a visible, page-specific success message.
      .then(() => page.waitForSelector(successSelector, { visible: true }))
      .then(() => page.$eval(successSelector, (element) => element.textContent.trim()))
  );
}

/** Run the complete standalone reCAPTCHA v3 example. */
export function main() {
  // Launch Chromium and create a browser page.
  return (
    puppeteer
      .launch({
        headless: process.env.HEADLESS === 'true',
        executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
      })
      .then((instance) => {
        browser = instance;
        return browser.newPage();
      })
      .then((page) => solveCaptcha(page))
      .then((message) => console.log(`Page confirmation: ${message}`))
      // STEP-07: Report errors and always close Chromium.
      .catch((error) => {
        console.error('Example failed:', error.message);
        process.exitCode = 1;
      })
      .finally(() => browser?.close())
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
