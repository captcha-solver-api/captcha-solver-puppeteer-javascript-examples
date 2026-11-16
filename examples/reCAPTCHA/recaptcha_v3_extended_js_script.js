import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

/**
 * This example solves reCAPTCHA v3 when execute() is called from an external script. It installs an interceptor before navigation, captures the site key and action, creates Tasks.RecaptchaV3Proxyless, and calls CaptchaClient.solve(). It resolves the intercepted Promise with gRecaptchaResponse and separately requires a page-specific success element.
 *
 * To use this example on another page, change the target URL and verify the intercepted API, trigger, action, score, and acceptance signal. Promise resolution alone does not prove server-side acceptance.
 *
 * How it works:
 * STEP-01 - Installing the execute() interceptor.
 * STEP-02 - Opening the reCAPTCHA v3 page.
 * STEP-03 - Captured reCAPTCHA parameters.
 * STEP-04 - Sending the task to Captcha Solver.
 * STEP-05 - Solution received.
 * STEP-06 - Resolving the intercepted execute() promise.
 */

puppeteer.use(StealthPlugin());

/** Install a small execute() interceptor before page scripts run. */
async function installInterceptor(page) {
  await page.evaluateOnNewDocument(() => {
    const patch = (api) => {
      if (!api || api.__captchaPatched) return api;
      Object.defineProperty(api, '__captchaPatched', { value: true });
      Object.defineProperty(api, 'execute', {
        configurable: true,
        get:
          () =>
          (websiteKey, options = {}) => {
            window.__recaptchaV3 = { websiteKey, pageAction: options.action };
            return new Promise((resolve) => {
              window.__resolveRecaptchaV3 = resolve;
            });
          },
      });
      return api;
    };
    let api = patch(window.grecaptcha);
    Object.defineProperty(window, 'grecaptcha', {
      configurable: true,
      get: () => api,
      set: (value) => {
        api = patch(value);
      },
    });
  });
}

/** Solve intercepted reCAPTCHA v3 on an already opened page. */
export async function solveCaptcha(page, solver) {
  if (!process.env.TARGET_URL) throw new Error('Set TARGET_URL for this example.');
  // STEP-01: Installing the execute() interceptor.

  console.log('1. Installing the execute() interceptor');
  await installInterceptor(page);
  // STEP-02: Opening the reCAPTCHA v3 page.

  console.log('2. Opening the reCAPTCHA v3 page');
  await page.goto(process.env.TARGET_URL, { waitUntil: 'domcontentloaded' });

  if (!(await page.evaluate(() => Boolean(window.__recaptchaV3)))) {
    await page.click(process.env.SUBMIT_SELECTOR || 'button[type="submit"], input[type="submit"]');
  }
  const handle = await page.waitForFunction(() => window.__recaptchaV3 || false);
  const params = await handle.jsonValue();
  await handle.dispose();
  // STEP-03: Captured reCAPTCHA parameters.

  console.log('3. Captured reCAPTCHA parameters', params);

  const task = new Tasks.RecaptchaV3Proxyless({
    websiteURL: page.url(),
    ...params,
    minScore: Number(process.env.RECAPTCHA_MIN_SCORE || 0.3),
  });
  // STEP-04: Sending the task to Captcha Solver.

  console.log('4. Sending the task to Captcha Solver');
  const solution = await solver.solve(task);
  // STEP-05: Solution received.

  console.log('5. Solution received', solution);
  if (!solution.gRecaptchaResponse) throw new Error('Captcha Solver returned an empty token.');

  // Token injection and submission are site-specific; adapt this step to the target page.
  // STEP-06: Resolving the intercepted execute() promise.

  console.log('6. Resolving the intercepted execute() promise');
  await page.evaluate((token) => window.__resolveRecaptchaV3(token), solution.gRecaptchaResponse);
  const selector = process.env.SUCCESS_SELECTOR || 'p[class*="successMessage"]';
  await page.waitForSelector(selector, { visible: true });
  return page.$eval(selector, (element) => element.textContent.trim());
}

/** Run the complete standalone intercepted reCAPTCHA v3 example. */
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
