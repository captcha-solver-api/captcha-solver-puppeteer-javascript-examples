import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

/**
 * This example solves an image-to-text CAPTCHA without a proxy. It reads the original image pixels through a browser canvas, creates Tasks.ImageToText, and calls CaptchaClient.solve(). It logs the recognized text, types it into the form, submits the answer, and requires a page-specific success element.
 *
 * To use this example on another page, change the target URL and selectors, confirm that canvas access is not blocked by CORS, and adapt the submission and acceptance checks to that page.
 *
 * How it works:
 * STEP-01 - Opening the page.
 * STEP-02 - Reading the original image pixels through canvas.
 * STEP-03 - Sending ImageToText task.
 * STEP-04 - Recognized text.
 * STEP-05 - Typing the answer and submitting the form.
 * STEP-06 - Waiting for page acceptance.
 */

puppeteer.use(StealthPlugin());
const IMAGE_SELECTOR = 'img[alt="normal captcha example"]';
const ANSWER_SELECTOR = '#simple-captcha-field';

/** Solve the image CAPTCHA on an already opened page. */
export async function solveCaptcha(page, solver) {
  if (!process.env.TARGET_URL) throw new Error('Set TARGET_URL for this example.');

  // STEP-01: Opening the page.

  console.log('1. Opening the page');
  await page.goto(process.env.TARGET_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(IMAGE_SELECTOR, { visible: true });

  // STEP-02: Reading the original image pixels through canvas.

  console.log('2. Reading the original image pixels through canvas');
  const body = await page.$eval(IMAGE_SELECTOR, (image) => {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext('2d').drawImage(image, 0, 0);
    return canvas.toDataURL('image/png').split(',')[1];
  });

  const task = new Tasks.ImageToText({ body });
  // STEP-03: Sending ImageToText task.

  console.log('3. Sending ImageToText task', {
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

  // STEP-06: Waiting for page acceptance.

  console.log('6. Waiting for page acceptance');
  const selector = process.env.SUCCESS_SELECTOR || 'p[class*="successMessage"]';
  await page.waitForSelector(selector, { visible: true });
  return page.$eval(selector, (element) => element.textContent.trim());
}

/** Run the complete standalone canvas example. */
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
