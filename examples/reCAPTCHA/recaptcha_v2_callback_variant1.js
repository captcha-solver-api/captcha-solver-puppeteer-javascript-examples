/**
 * Solve reCAPTCHA v2 when the page expects a known JavaScript callback.
 * Set TARGET_URL and, if necessary, CALLBACK_NAME (default: verifyDemoRecaptcha).
 */
import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

/** Solve reCAPTCHA and invoke the page callback with the returned token. */
export async function solveCaptcha(page, solver) {
  if (!process.env.TARGET_URL) throw new Error('Set TARGET_URL for this example.');
  console.log('1. Opening the callback-based reCAPTCHA page');
  await page.goto(process.env.TARGET_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-sitekey]');

  console.log('2. Reading reCAPTCHA parameters');
  const captcha = await page.$eval('[data-sitekey]', (element) => ({
    websiteKey: element.getAttribute('data-sitekey'),
    isInvisible: element.getAttribute('data-size') === 'invisible',
  }));
  const task = new Tasks.RecaptchaV2Proxyless({
    websiteURL: page.url(),
    ...captcha,
    userAgent: await page.evaluate(() => navigator.userAgent),
  });

  console.log('3. Sending the task to Captcha Solver', task.toDict());
  const solution = await solver.solve(task);
  console.log('4. Solution received', solution);
  if (!solution.gRecaptchaResponse) throw new Error('Captcha Solver returned an empty token.');

  const callbackName = process.env.CALLBACK_NAME || 'verifyDemoRecaptcha';
  console.log(`5. Calling ${callbackName} with the returned token`);
  await page.evaluate((name, token) => {
    const parts = name.split('.');
    let owner = window;
    for (const part of parts.slice(0, -1)) owner = owner?.[part];
    const callback = owner?.[parts.at(-1)];
    if (typeof callback !== 'function') throw new Error(`Callback ${name} was not found.`);
    callback.call(owner, token);
  }, callbackName, solution.gRecaptchaResponse);

  console.log('6. Waiting for page acceptance');
  const selector = process.env.SUCCESS_SELECTOR || 'p[class*="successMessage"]';
  await page.waitForSelector(selector, { visible: true });
  return page.$eval(selector, (element) => element.textContent.trim());
}

/** Run the complete standalone callback example. */
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
