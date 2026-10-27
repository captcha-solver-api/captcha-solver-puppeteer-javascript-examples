/**
 * Solve a normal image CAPTCHA with a Puppeteer screenshot.
 * The example captures the displayed image, sends it through the official SDK,
 * types the recognized text, submits the form, and confirms acceptance.
 */
import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());
const IMAGE_SELECTOR = 'img[alt="normal captcha example"]';
const ANSWER_SELECTOR = '#simple-captcha-field';

/** Solve the image CAPTCHA on an already opened page. */
export async function solveCaptcha(page, solver) {
  if (!process.env.TARGET_URL) throw new Error('Set TARGET_URL for this example.');
  console.log('1. Opening the page');
  await page.goto(process.env.TARGET_URL, { waitUntil: 'domcontentloaded' });
  const image = await page.waitForSelector(IMAGE_SELECTOR, { visible: true });

  console.log('2. Taking a screenshot of the CAPTCHA image');
  const body = await image.screenshot({ encoding: 'base64', type: 'png' });
  const task = new Tasks.ImageToText({ body });

  console.log('3. Sending ImageToText task', {
    ...task.toDict(),
    body: `[${body.length} base64 characters]`,
  });
  const solution = await solver.solve(task);
  console.log('4. Recognized text:', solution.text);
  if (!solution.text) throw new Error('Captcha Solver returned empty text.');

  console.log('5. Typing the answer and submitting the form');
  await page.locator(ANSWER_SELECTOR).fill(solution.text);
  await page.click(process.env.SUBMIT_SELECTOR || 'button[type="submit"], input[type="submit"]');

  console.log('6. Waiting for page acceptance');
  const selector = process.env.SUCCESS_SELECTOR || 'p[class*="successMessage"]';
  await page.waitForSelector(selector, { visible: true });
  return page.$eval(selector, (element) => element.textContent.trim());
}

/** Run the complete standalone screenshot example. */
export async function main() {
  const apiKey = process.env.CAPTCHA_API_KEY;
  if (!apiKey || apiKey === 'your_api_key') throw new Error('Set CAPTCHA_API_KEY.');
  const solver = new CaptchaClient({ clientKey: apiKey });
  const browser = await puppeteer.launch({
    headless: process.env.HEADLESS === 'true',
    executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
  });
  try {
    const page = await browser.newPage();
    console.log('Captcha solved successfully:', await solveCaptcha(page, solver));
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error('Example failed:', error.message); process.exitCode = 1; });
}
