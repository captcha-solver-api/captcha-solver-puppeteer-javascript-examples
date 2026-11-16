import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

/**
 * This example solves reCAPTCHA v2 without a proxy. It extracts the site key, visibility mode, optional data-s value, and browser User-Agent, creates Tasks.RecaptchaV2Proxyless, and calls CaptchaClient.solve(). It logs and injects the returned gRecaptchaResponse, submits the form, and requires the page's success element.
 *
 * To use this example on another page, change the target URL and verify the site key and optional payload. Token fields, callbacks, submission, and success indicators are site-specific.
 *
 * How it works:
 * STEP-01 - Opening the page.
 * STEP-02 - Reading reCAPTCHA parameters from the page.
 * STEP-03 - Sending the task to Captcha Solver.
 * STEP-04 - Solution received.
 * STEP-05 - Writing the token into g-recaptcha-response.
 * STEP-06 - Submitting the form.
 * STEP-07 - Waiting for the page to accept the solution.
 */

puppeteer.use(StealthPlugin());

const DEFAULT_URL = 'https://www.google.com/recaptcha/api2/demo';

/**
 * Solve and submit reCAPTCHA v2 on an already opened page.
 * @param {import('puppeteer').Page} page Open Puppeteer page.
 * @param {CaptchaClient} solver Configured Captcha Solver client.
 * @returns {Promise<string>} Text displayed after successful submission.
 */
export async function solveCaptcha(page, solver) {
  // STEP-01: Opening the page.

  console.log('1. Opening the page');
  await page.goto(process.env.TARGET_URL || DEFAULT_URL, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('[data-sitekey]');

  // STEP-02: Reading reCAPTCHA parameters from the page.

  console.log('2. Reading reCAPTCHA parameters from the page');
  const captcha = await page.$eval('[data-sitekey]', (element) => ({
    websiteKey: element.getAttribute('data-sitekey'),
    isInvisible: element.getAttribute('data-size') === 'invisible',
    recaptchaDataSValue: element.getAttribute('data-s') || undefined,
  }));

  const task = new Tasks.RecaptchaV2Proxyless({
    websiteURL: page.url(),
    ...captcha,
    userAgent: await page.evaluate(() => navigator.userAgent),
  });
  // STEP-03: Sending the task to Captcha Solver.

  console.log('3. Sending the task to Captcha Solver', task.toDict());
  const solution = await solver.solve(task);
  // STEP-04: Solution received.

  console.log('4. Solution received', solution);

  if (!solution.gRecaptchaResponse) {
    throw new Error('Captcha Solver returned an empty reCAPTCHA token.');
  }

  // Token injection and submission are site-specific; adapt this step to the target page.
  // Inspect the target page's fields, submission flow, and acceptance signals before adapting it.
  // STEP-05: Writing the token into g-recaptcha-response.

  console.log('5. Writing the token into g-recaptcha-response');
  await page.evaluate((token) => {
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

  // STEP-06: Submitting the form.

  console.log('6. Submitting the form');
  await page.click(process.env.SUBMIT_SELECTOR || 'button[type="submit"], input[type="submit"]');

  // STEP-07: Waiting for the page to accept the solution.

  console.log('7. Waiting for the page to accept the solution');
  const successSelector =
    process.env.SUCCESS_SELECTOR || '.recaptcha-success, p[class*="successMessage"]';
  await page.waitForSelector(successSelector, { visible: true });
  return page.$eval(successSelector, (element) => element.textContent.trim());
}

/** Run the complete standalone example. */
export async function main() {
  console.log('Creating Captcha Solver client from CAPTCHA_API_KEY');
  const solver = new CaptchaClient({ clientKey: process.env.CAPTCHA_API_KEY || 'YOUR_API_KEY' });
  const browser = await puppeteer.launch({
    headless: process.env.HEADLESS === 'true',
    executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
    defaultViewport: { width: 1280, height: 900 },
  });

  try {
    const page = await browser.newPage();
    const result = await solveCaptcha(page, solver);
    console.log('Page confirmation:', result);
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('Example failed:', error.message);
    process.exitCode = 1;
  });
}
