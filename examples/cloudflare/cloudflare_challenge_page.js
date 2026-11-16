import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

/**
 * This example solves a Cloudflare managed Challenge without a proxy. It intercepts Turnstile before navigation, captures the site key, action, challenge data, page data, callback, and browser User-Agent, creates Tasks.TurnstileProxyless, and calls CaptchaClient.solve(). It passes the returned token to the original callback and requires a page-specific success element; callback delivery alone is not server-side acceptance.
 *
 * To use this example on another page, change the target URL and success selector, then verify the intercepted fields and callback. Challenge behavior and acceptance signals are site-specific.
 *
 * How it works:
 * STEP-01 - Installing the Turnstile interceptor.
 * STEP-02 - Opening the Cloudflare Challenge page.
 * STEP-03 - Captured Challenge parameters.
 * STEP-04 - Sending the task to Captcha Solver.
 * STEP-05 - Solution received.
 * STEP-06 - Passing the token to the original Turnstile callback.
 * STEP-07 - Verifying a new clearance cookie and page confirmation.
 */

puppeteer.use(StealthPlugin());

/** Install the Turnstile render interceptor before page scripts run. */
async function installInterceptor(page) {
  await page.evaluateOnNewDocument(() => {
    const timer = setInterval(() => {
      const turnstile = window.turnstile;
      if (!turnstile || turnstile.__captchaPatched || typeof turnstile.render !== 'function')
        return;
      const originalRender = turnstile.render;
      Object.defineProperty(turnstile, '__captchaPatched', { value: true });
      turnstile.render = function render(container, options = {}) {
        window.__turnstileParams = {
          websiteURL: location.href,
          websiteKey: options.sitekey,
          action: options.action,
          data: options.cData,
          pagedata: options.chlPageData,
          userAgent: navigator.userAgent,
        };
        window.__turnstileCallback = options.callback;
        return originalRender.call(turnstile, container, options);
      };
      clearInterval(timer);
    }, 10);
  });
}

/** Solve the managed Challenge on an already opened page. */
export async function solveCaptcha(page, solver) {
  if (!process.env.TARGET_URL) throw new Error('Set TARGET_URL for this example.');
  // STEP-01: Installing the Turnstile interceptor.

  console.log('1. Installing the Turnstile interceptor');
  await installInterceptor(page);
  // STEP-02: Opening the Cloudflare Challenge page.

  console.log('2. Opening the Cloudflare Challenge page');
  await page.goto(process.env.TARGET_URL, { waitUntil: 'domcontentloaded' });

  const selector = process.env.SUCCESS_SELECTOR || 'p[class*="successMessage"]';
  const handle = await page.waitForFunction(
    (successSelector) => {
      if (
        document.querySelector('#cf-error-details')?.textContent.includes('you have been blocked')
      ) {
        return { blocked: true };
      }
      const success = document.querySelector(successSelector);
      if (success?.getClientRects().length && success.textContent.trim()) {
        return { success: success.textContent.trim() };
      }
      return window.__turnstileParams ? { params: window.__turnstileParams } : false;
    },
    {},
    selector,
  );
  const state = await handle.jsonValue();
  await handle.dispose();
  if (state.blocked) throw new Error('Cloudflare blocked the browser before a task was created.');
  if (state.success) return `Already passed: ${state.success}`;
  const previousClearance = (await page.cookies()).find(
    (cookie) => cookie.name === 'cf_clearance',
  )?.value;

  // STEP-03: Captured Challenge parameters.

  console.log('3. Captured Challenge parameters', state.params);
  const task = new Tasks.TurnstileProxyless(state.params);
  // STEP-04: Sending the task to Captcha Solver.

  console.log('4. Sending the task to Captcha Solver');
  const solution = await solver.solve(task);
  // STEP-05: Solution received.

  console.log('5. Solution received', solution);
  if (!solution.token) throw new Error('Captcha Solver returned an empty token.');

  // Token injection and submission are site-specific; adapt this step to the target page.
  // Inspect the target page's callback, submission flow, and acceptance signals before adapting it.
  // STEP-06: Passing the token to the original Turnstile callback.

  console.log('6. Passing the token to the original Turnstile callback');
  await page.evaluate((token) => {
    if (typeof window.__turnstileCallback !== 'function')
      throw new Error('Turnstile callback was not found.');
    window.__turnstileCallback(token);
  }, solution.token);
  await page.waitForSelector(selector, { visible: true });
  // STEP-07: Verify that the Challenge produced fresh clearance and page confirmation.
  const currentClearance = (await page.cookies()).find(
    (cookie) => cookie.name === 'cf_clearance',
  )?.value;
  if (!currentClearance || currentClearance === previousClearance) {
    throw new Error('Cloudflare did not issue a new cf_clearance cookie.');
  }
  return page.$eval(selector, (element) => element.textContent.trim());
}

/** Run the complete standalone Cloudflare Challenge example. */
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
