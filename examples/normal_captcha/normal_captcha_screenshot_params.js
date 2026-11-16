import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

/**
 * This example solves an image-to-text CAPTCHA without a proxy and supplies recognition hints. It screenshots the rendered image, creates Tasks.ImageToText with named character and length constraints, and calls CaptchaClient.solve(). It logs the recognized text, submits it, and requires a page-specific success element.
 *
 * To use this example on another page, change the target URL, selectors, and recognition hints to match the real answer format, then adapt submission and acceptance checks.
 *
 * How it works:
 * STEP-01 - Opening the page.
 * STEP-02 - Taking a screenshot of the CAPTCHA image.
 * STEP-03 - Sending ImageToText task with recognition hints.
 * STEP-04 - Recognized text.
 * STEP-05 - Typing the answer and submitting the form.
 */

puppeteer.use(StealthPlugin());
const IMAGE_SELECTOR = 'img[alt="normal captcha example"]';
const ANSWER_SELECTOR = '#simple-captcha-field';
const lettersAndNumbers = 4;
const minimumAnswerLength = 4;
const maximumAnswerLength = 10;

/** Solve the image CAPTCHA on an already opened page. */
export async function solveCaptcha(page, solver) {
  if (!process.env.TARGET_URL) throw new Error('Set TARGET_URL for this example.');
  // STEP-01: Opening the page.

  console.log('1. Opening the page');
  await page.goto(process.env.TARGET_URL, { waitUntil: 'domcontentloaded' });
  const image = await page.waitForSelector(IMAGE_SELECTOR, { visible: true });

  // STEP-02: Taking a screenshot of the CAPTCHA image.

  console.log('2. Taking a screenshot of the CAPTCHA image');
  const body = await image.screenshot({ encoding: 'base64', type: 'png' });
  const task = new Tasks.ImageToText({
    body,
    numeric: lettersAndNumbers,
    minLength: minimumAnswerLength,
    maxLength: maximumAnswerLength,
  });

  // STEP-03: Sending ImageToText task with recognition hints.

  console.log('3. Sending ImageToText task with recognition hints', {
    ...task.toDict(),
    body: `[${body.length} base64 characters]`,
  });
  const solution = await solver.solve(task);
  // STEP-04: Recognized text.

  console.log('4. Recognized text:', solution.text);
  if (!solution.text) throw new Error('Captcha Solver returned empty text.');

  // STEP-05: Typing the answer and submitting the form.

  console.log('5. Typing the answer and submitting the form');
  await page.locator(ANSWER_SELECTOR).fill(solution.text);
  await page.click(process.env.SUBMIT_SELECTOR || 'button[type="submit"], input[type="submit"]');
  const selector = process.env.SUCCESS_SELECTOR || 'p[class*="successMessage"]';
  await page.waitForSelector(selector, { visible: true });
  return page.$eval(selector, (element) => element.textContent.trim());
}

/** Run the complete standalone screenshot-with-parameters example. */
export async function main() {
  const solver = new CaptchaClient({ clientKey: process.env.CAPTCHA_API_KEY || 'YOUR_API_KEY' });
  const browser = await puppeteer.launch({
    headless: process.env.HEADLESS === 'true',
    executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
  });
  try {
    const page = await browser.newPage();
    console.log('Page confirmation:', await solveCaptcha(page, solver));
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
