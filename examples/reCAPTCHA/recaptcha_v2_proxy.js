import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

/**
 * This example solves reCAPTCHA v2 through the same proxy in Puppeteer and the solver task. It extracts the widget parameters and browser User-Agent, creates Tasks.RecaptchaV2 with named proxy settings, and calls CaptchaClient.solve(). It injects the returned gRecaptchaResponse, submits the form, and requires a page-specific success element.
 *
 * To use this example on another page, change the target URL, proxy configuration, selectors, and acceptance signal. Token injection and submission are site-specific.
 *
 * How it works:
 * STEP-01 - Opening the page through the configured proxy.
 * STEP-02 - Reading reCAPTCHA parameters.
 * STEP-03 - Sending RecaptchaV2 task.
 * STEP-04 - Solution received.
 * STEP-05 - Writing the token and submitting the form.
 * STEP-06 - Waiting for page acceptance.
 */

puppeteer.use(StealthPlugin());
const DEFAULT_URL = 'https://www.google.com/recaptcha/api2/demo';

/** Read proxy settings from environment variables. */
function getProxy() {
  const proxyAddress = process.env.PROXY_ADDRESS;
  const proxyPort = Number(process.env.PROXY_PORT);
  if (!proxyAddress || !Number.isInteger(proxyPort)) {
    throw new Error('Set PROXY_ADDRESS and PROXY_PORT.');
  }
  return {
    proxyType: process.env.PROXY_TYPE || 'http',
    proxyAddress,
    proxyPort,
    proxyLogin: process.env.PROXY_LOGIN || undefined,
    proxyPassword: process.env.PROXY_PASSWORD || undefined,
  };
}

/** Solve and submit proxy-based reCAPTCHA v2 on an opened page. */
export async function solveCaptcha(page, solver, proxy) {
  // STEP-01: Opening the page through the configured proxy.

  console.log('1. Opening the page through the configured proxy');
  await page.goto(process.env.TARGET_URL || DEFAULT_URL, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('[data-sitekey]');

  // STEP-02: Reading reCAPTCHA parameters.

  console.log('2. Reading reCAPTCHA parameters');
  const captcha = await page.$eval('[data-sitekey]', (element) => ({
    websiteKey: element.getAttribute('data-sitekey'),
    isInvisible: element.getAttribute('data-size') === 'invisible',
    recaptchaDataSValue: element.getAttribute('data-s') || undefined,
  }));
  const task = new Tasks.RecaptchaV2({
    websiteURL: page.url(),
    ...captcha,
    ...proxy,
    userAgent: await page.evaluate(() => navigator.userAgent),
  });

  // STEP-03: Sending RecaptchaV2 task.

  console.log('3. Sending RecaptchaV2 task');
  const solution = await solver.solve(task);
  // STEP-04: Solution received.

  console.log('4. Solution received', solution);
  if (!solution.gRecaptchaResponse) throw new Error('Captcha Solver returned an empty token.');

  // Token injection and submission are site-specific; adapt this step to the target page.
  // Inspect the target page's fields, submission flow, and acceptance signals before adapting it.
  // STEP-05: Writing the token and submitting the form.

  console.log('5. Writing the token and submitting the form');
  await page.evaluate((token) => {
    let response = document.querySelector('[name="g-recaptcha-response"]');
    if (!response) {
      response = document.createElement('textarea');
      response.name = 'g-recaptcha-response';
      document.querySelector('form')?.append(response);
    }
    response.value = token;
    response.dispatchEvent(new Event('change', { bubbles: true }));
  }, solution.gRecaptchaResponse);
  await page.click(process.env.SUBMIT_SELECTOR || 'button[type="submit"], input[type="submit"]');

  // STEP-06: Waiting for page acceptance.

  console.log('6. Waiting for page acceptance');
  const selector = process.env.SUCCESS_SELECTOR || '.recaptcha-success, p[class*="successMessage"]';
  await page.waitForSelector(selector, { visible: true });
  return page.$eval(selector, (element) => element.textContent.trim());
}

/** Run the complete standalone proxy example. */
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
    if (proxy.proxyLogin) {
      await page.authenticate({
        username: proxy.proxyLogin,
        password: proxy.proxyPassword,
      });
    }
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
