import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

/**
 * This example solves reCAPTCHA v2 Enterprise without a proxy. It extracts the site key, creates
 * Tasks.RecaptchaV2EnterpriseProxyless, logs and injects the returned token, submits the form,
 * and requires an explicit page confirmation.
 *
 * To use it on another page, change RECAPTCHA_ENTERPRISE_TARGET_URL and inspect its site key,
 * enterprise payload, token field, submission flow, and success indicator before adapting them.
 * Token integration is unique to every target site and must be investigated independently.
 *
 * How it works:
 * STEP-01 - Open the configured target page.
 * STEP-02 - Extract the Enterprise site key.
 * STEP-03 - Create and solve the Enterprise task.
 * STEP-04 - Log and inject the returned token.
 * STEP-05 - Submit the form and verify page acceptance.
 * STEP-06 - Handle errors and close Chromium.
 */

puppeteer.use(StealthPlugin());
const DEFAULT_URL = 'https://example.com/page_with_recaptcha_v2_enterprise';

/** Solve and submit reCAPTCHA Enterprise on an already opened page. */
export function solveCaptcha(page, solver) {
  const websiteURL = process.env.RECAPTCHA_ENTERPRISE_TARGET_URL || DEFAULT_URL;

  // STEP-01: Open the configured target page.
  return page
    .goto(websiteURL, { waitUntil: 'domcontentloaded' })
    .then(() => page.$eval('[data-sitekey]', (element) => element.getAttribute('data-sitekey')))
    .then((websiteKey) => {
      // STEP-02: Validate the extracted Enterprise site key.
      if (!websiteKey) throw new Error('Enterprise site key not found.');
      // STEP-03: Create and solve the Enterprise task.
      const task = new Tasks.RecaptchaV2EnterpriseProxyless({
        websiteURL: page.url(),
        websiteKey,
        isInvisible: false,
      });
      console.log('3. Sending Enterprise task', task.toDict());
      return solver.solve(task);
    })
    .then((solution) => {
      // STEP-04: Log and inject the token into this page's response field.
      console.log('4. Solution received', solution);
      if (!solution.gRecaptchaResponse) throw new Error('Solver returned an empty token.');
      // Token injection and submission are site-specific; adapt this step to the target page.
      return page.evaluate((token) => {
        const response = document.querySelector('[name="g-recaptcha-response"]');
        if (!response) throw new Error('Enterprise response field not found.');
        response.value = token;
        response.dispatchEvent(new Event('change', { bubbles: true }));
      }, solution.gRecaptchaResponse);
    })
    .then(() => page.click(process.env.SUBMIT_SELECTOR || 'button[type="submit"]'))
    .then(() => {
      // STEP-05: Require a visible, page-specific success message.
      const selector = process.env.SUCCESS_SELECTOR || 'p[class*="successMessage"]';
      return page
        .waitForSelector(selector, { visible: true })
        .then(() => page.$eval(selector, (element) => element.textContent.trim()));
    });
}

/** Launch Chromium and run the complete Enterprise example. */
export function main() {
  const solver = new CaptchaClient({ clientKey: process.env.CAPTCHA_API_KEY || 'YOUR_API_KEY' });
  let browser;
  return puppeteer
    .launch({
      headless: process.env.HEADLESS === 'true',
      executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
    })
    .then((instance) => {
      browser = instance;
      return browser.newPage();
    })
    .then((page) => solveCaptcha(page, solver))
    .then((message) => console.log('Page confirmation:', message))
    .finally(() => browser?.close());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // STEP-06: Report failures and always close Chromium in main().
  main().catch((error) => {
    console.error('Example failed:', error.message);
    process.exitCode = 1;
  });
}
