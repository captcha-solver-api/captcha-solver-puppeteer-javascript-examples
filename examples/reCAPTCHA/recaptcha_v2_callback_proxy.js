import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

/**
 * This example solves callback-based reCAPTCHA v2 through the same proxy in Puppeteer and the solver task. It extracts the widget and callback parameters, creates Tasks.RecaptchaV2 with named proxy settings, and calls CaptchaClient.solve(). It invokes the page callback with gRecaptchaResponse and separately requires a page-specific success element.
 *
 * To use this example on another page, change the target URL, proxy configuration, callback selector, and acceptance signal. Callback delivery alone does not prove server-side acceptance.
 *
 * How it works:
 * STEP-01 - Opening the page through the configured proxy.
 * STEP-02 - Reading CAPTCHA parameters and callback name.
 * STEP-03 - Sending the task to Captcha Solver.
 * STEP-04 - Solution received.
 * STEP-05 - Calling ${captcha.callbackName}.
 */

puppeteer.use(StealthPlugin());

/** Read proxy settings from environment variables. */
function getProxy() {
  const proxyAddress = process.env.PROXY_ADDRESS;
  const proxyPort = Number(process.env.PROXY_PORT);
  if (!proxyAddress || !Number.isInteger(proxyPort))
    throw new Error('Set PROXY_ADDRESS and PROXY_PORT.');
  return {
    proxyType: process.env.PROXY_TYPE || 'http',
    proxyAddress,
    proxyPort,
    proxyLogin: process.env.PROXY_LOGIN || undefined,
    proxyPassword: process.env.PROXY_PASSWORD || undefined,
  };
}

/** Solve reCAPTCHA and invoke its named callback. */
export async function solveCaptcha(page, solver, proxy) {
  if (!process.env.TARGET_URL) throw new Error('Set TARGET_URL for this example.');
  // STEP-01: Opening the page through the configured proxy.

  console.log('1. Opening the page through the configured proxy');
  await page.goto(process.env.TARGET_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-sitekey][data-callback]');

  // STEP-02: Reading CAPTCHA parameters and callback name.

  console.log('2. Reading CAPTCHA parameters and callback name');
  const captcha = await page.$eval('[data-sitekey][data-callback]', (element) => ({
    websiteKey: element.dataset.sitekey,
    callbackName: element.dataset.callback,
    isInvisible: element.dataset.size === 'invisible',
  }));
  const task = new Tasks.RecaptchaV2({
    websiteURL: page.url(),
    websiteKey: captcha.websiteKey,
    isInvisible: captcha.isInvisible,
    userAgent: await page.evaluate(() => navigator.userAgent),
    ...proxy,
  });
  // STEP-03: Sending the task to Captcha Solver.

  console.log('3. Sending the task to Captcha Solver');
  const solution = await solver.solve(task);
  // STEP-04: Solution received.

  console.log('4. Solution received', solution);
  if (!solution.gRecaptchaResponse) throw new Error('Captcha Solver returned an empty token.');

  // Token injection and submission are site-specific; adapt this step to the target page.
  // Inspect the target page's callback, submission flow, and acceptance signals before adapting it.
  // STEP-05: Calling ${captcha.callbackName}.

  console.log(`5. Calling ${captcha.callbackName}`);
  await page.evaluate(
    (name, token) => {
      const callback = name.split('.').reduce((value, key) => value?.[key], window);
      if (typeof callback !== 'function') throw new Error(`Callback ${name} was not found.`);
      callback(token);
    },
    captcha.callbackName,
    solution.gRecaptchaResponse,
  );
  const selector = process.env.SUCCESS_SELECTOR || 'p[class*="successMessage"]';
  await page.waitForSelector(selector, { visible: true });
  return page.$eval(selector, (element) => element.textContent.trim());
}

/** Run the complete standalone proxy callback example. */
export async function main() {
  const proxy = getProxy();
  const solver = new CaptchaClient({ clientKey: process.env.CAPTCHA_API_KEY || 'YOUR_API_KEY' });
  const browser = await puppeteer.launch({
    headless: process.env.HEADLESS === 'true',
    executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
    args: [`--proxy-server=${proxy.proxyType}://${proxy.proxyAddress}:${proxy.proxyPort}`],
  });
  try {
    const page = await browser.newPage();
    if (proxy.proxyLogin)
      await page.authenticate({
        username: proxy.proxyLogin,
        password: proxy.proxyPassword,
      });
    console.log('Page confirmation:', await solveCaptcha(page, solver, proxy));
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
