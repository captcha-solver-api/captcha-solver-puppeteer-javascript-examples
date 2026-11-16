import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

/**
 * This example solves reCAPTCHA v3 without a proxy. It extracts the site key and action from grecaptcha.execute(), creates Tasks.RecaptchaV3Proxyless with the configured minimum score, and calls CaptchaClient.solve(). It passes gRecaptchaResponse to the page callback and separately requires a page-specific success element.
 *
 * To use this example on another page, change the target URL and verify the site key, action, score, callback, and acceptance signal. Callback delivery alone does not prove server-side acceptance.
 *
 * How it works:
 * STEP-01 - Opening the reCAPTCHA v3 page.
 * STEP-02 - Reading the site key and action from page scripts.
 * STEP-03 - Sending the task to Captcha Solver.
 * STEP-04 - Solution received.
 * STEP-05 - Passing the token to ${callbackName}.
 * STEP-06 - Waiting for page acceptance.
 */

puppeteer.use(StealthPlugin());

/** Solve reCAPTCHA v3 on an already opened page. */
export async function solveCaptcha(page, solver) {
  if (!process.env.TARGET_URL) throw new Error('Set TARGET_URL for this example.');
  // STEP-01: Opening the reCAPTCHA v3 page.

  console.log('1. Opening the reCAPTCHA v3 page');
  await page.goto(process.env.TARGET_URL, { waitUntil: 'domcontentloaded' });

  // STEP-02: Reading the site key and action from page scripts.

  console.log('2. Reading the site key and action from page scripts');
  const captcha = await page.waitForFunction(
    (sitekey, action) => {
      if (sitekey && action) return { websiteKey: sitekey, pageAction: action };
      const source = Array.from(document.scripts, (script) => script.textContent).join('\n');
      const match = source.match(
        /grecaptcha\.execute\s*\(\s*['"]([^'"]+)['"]\s*,\s*\{[^}]*action\s*:\s*['"]([^'"]+)['"]/,
      );
      return match ? { websiteKey: match[1], pageAction: match[2] } : false;
    },
    {},
    process.env.RECAPTCHA_SITEKEY || '',
    process.env.RECAPTCHA_ACTION || '',
  );
  const params = await captcha.jsonValue();
  await captcha.dispose();

  const task = new Tasks.RecaptchaV3Proxyless({
    websiteURL: page.url(),
    websiteKey: params.websiteKey,
    pageAction: params.pageAction,
    minScore: Number(process.env.RECAPTCHA_MIN_SCORE || 0.3),
  });
  // STEP-03: Sending the task to Captcha Solver.

  console.log('3. Sending the task to Captcha Solver', task.toDict());
  const solution = await solver.solve(task);
  // STEP-04: Solution received.

  console.log('4. Solution received', solution);
  if (!solution.gRecaptchaResponse) throw new Error('Captcha Solver returned an empty token.');

  // Token injection and submission are site-specific; adapt this step to the target page.
  const callbackName = process.env.CALLBACK_NAME || 'verifyRecaptcha';
  // STEP-05: Passing the token to ${callbackName}.

  console.log(`5. Passing the token to ${callbackName}`);
  await page.evaluate(
    (name, token) => {
      const callback = name.split('.').reduce((value, key) => value?.[key], window);
      if (typeof callback !== 'function') throw new Error(`Callback ${name} was not found.`);
      callback(token);
    },
    callbackName,
    solution.gRecaptchaResponse,
  );

  // STEP-06: Waiting for page acceptance.

  console.log('6. Waiting for page acceptance');
  const selector = process.env.SUCCESS_SELECTOR || 'p[class*="successMessage"]';
  await page.waitForSelector(selector, { visible: true });
  return page.$eval(selector, (element) => element.textContent.trim());
}

/** Run the complete standalone reCAPTCHA v3 example. */
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
  main().catch((error) => {
    console.error('Example failed:', error.message);
    process.exitCode = 1;
  });
}
