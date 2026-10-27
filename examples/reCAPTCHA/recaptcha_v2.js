/**
 * Solve reCAPTCHA v2 with Puppeteer and Captcha Solver.
 *
 * This example opens a page, reads the reCAPTCHA site key, sends a task through
 * the official SDK, puts the returned token into the form, submits it, and
 * waits for the page to confirm that the token was accepted.
 */
import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const DEFAULT_URL = 'https://www.google.com/recaptcha/api2/demo';

/**
 * Solve and submit reCAPTCHA v2 on an already opened page.
 * @param {import('puppeteer').Page} page Open Puppeteer page.
 * @param {CaptchaClient} solver Configured Captcha Solver client.
 * @returns {Promise<string>} Text displayed after successful submission.
 */
export async function solveCaptcha(page, solver) {
  console.log('1. Opening the page');
  await page.goto(process.env.TARGET_URL || DEFAULT_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-sitekey]');

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
  console.log('3. Sending the task to Captcha Solver', task.toDict());
  const solution = await solver.solve(task);
  console.log('4. Solution received', solution);

  if (!solution.gRecaptchaResponse) {
    throw new Error('Captcha Solver returned an empty reCAPTCHA token.');
  }

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

  console.log('6. Submitting the form');
  await page.click(process.env.SUBMIT_SELECTOR || 'button[type="submit"], input[type="submit"]');

  console.log('7. Waiting for the page to accept the solution');
  const successSelector = process.env.SUCCESS_SELECTOR || '.recaptcha-success, p[class*="successMessage"]';
  await page.waitForSelector(successSelector, { visible: true });
  return page.$eval(successSelector, (element) => element.textContent.trim());
}

/** Run the complete standalone example. */
export async function main() {
  const apiKey = process.env.CAPTCHA_API_KEY;
  if (!apiKey || apiKey === 'your_api_key') {
    throw new Error('Set CAPTCHA_API_KEY in .env or the environment.');
  }

  console.log('Creating Captcha Solver client from CAPTCHA_API_KEY');
  const solver = new CaptchaClient({ clientKey: apiKey });
  const browser = await puppeteer.launch({
    headless: process.env.HEADLESS === 'true',
    executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
    defaultViewport: { width: 1280, height: 900 },
  });

  try {
    const page = await browser.newPage();
    const result = await solveCaptcha(page, solver);
    console.log('Captcha solved successfully:', result);
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
