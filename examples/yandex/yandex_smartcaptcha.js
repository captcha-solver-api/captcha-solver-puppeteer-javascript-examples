/**
 * Solve Yandex SmartCaptcha with Puppeteer and Captcha Solver.
 *
 * This example opens the official demo, reads the public widget key, sends a
 * task through the official SDK, writes the returned token into the hidden
 * form field, submits the form, and confirms that the page accepted it.
 */
import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { demos } from '../../config/demos.js';

puppeteer.use(StealthPlugin());

const SITEKEY_SELECTOR = '.smart-captcha[data-sitekey]';
const TOKEN_SELECTOR = 'input[name="smart-token"]';
const SUBMIT_SELECTOR = '#smartcaptcha-demo-submit';
const SUCCESS_TEXT = 'Hello, user!';

/**
 * Solve and submit Yandex SmartCaptcha on an already opened page.
 * @param {import('puppeteer').Page} page Open Puppeteer page.
 * @param {CaptchaClient} solver Configured Captcha Solver client.
 * @returns {Promise<string>} Text displayed after successful submission.
 */
export async function solveCaptcha(page, solver) {
  console.log('1. Opening the Yandex SmartCaptcha page');
  await page.goto(process.env.TARGET_URL || demos.yandexSmartCaptcha, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(SITEKEY_SELECTOR);

  console.log('2. Reading the SmartCaptcha site key');
  const websiteKey = await page.$eval(SITEKEY_SELECTOR, (element) => element.getAttribute('data-sitekey'));
  if (!websiteKey) throw new Error('No Yandex SmartCaptcha sitekey found.');

  const task = new Tasks.YandexSmartCaptchaTaskProxyless({
    websiteURL: page.url(),
    websiteKey,
    userAgent: await page.evaluate(() => navigator.userAgent),
  });
  console.log('3. Sending the task to Captcha Solver', task.toDict());
  const solution = await solver.solve(task);
  console.log('4. Solution received', solution);
  if (typeof solution.token !== 'string' || !solution.token.trim()) {
    throw new Error('Captcha Solver returned an empty SmartCaptcha token.');
  }

  // Token injection and submission are site-specific; adapt this step to the target page.
  console.log('5. Writing the token into smart-token');
  await page.waitForSelector(TOKEN_SELECTOR);
  await page.$eval(TOKEN_SELECTOR, (input, token) => {
    input.value = token;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, solution.token);

  console.log('6. Submitting the form');
  await page.click(process.env.SUBMIT_SELECTOR || SUBMIT_SELECTOR);

  console.log('7. Waiting for the page to accept the solution');
  if (process.env.SUCCESS_SELECTOR) {
    await page.waitForSelector(process.env.SUCCESS_SELECTOR, { visible: true });
    return page.$eval(process.env.SUCCESS_SELECTOR, (element) => element.textContent.trim());
  }
  const successText = process.env.YANDEX_SUCCESS_TEXT || SUCCESS_TEXT;
  await page.waitForFunction((text) => document.body.innerText.includes(text), {}, successText);
  return successText;
}

/** Run the complete standalone Yandex SmartCaptcha example. */
export async function main() {
  const apiKey = process.env.CAPTCHA_API_KEY;
  if (!apiKey || apiKey === 'your_api_key') throw new Error('Set CAPTCHA_API_KEY.');
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
    return result;
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error('Example failed:', error.message); process.exitCode = 1; });
}
