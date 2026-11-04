/**
 * Solve a Cloudflare managed Challenge page.
 * The Turnstile render call is intercepted before navigation so dynamic fields
 * and the original callback remain available in the browser.
 */
import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

/** Install the Turnstile render interceptor before page scripts run. */
async function installInterceptor(page) {
  await page.evaluateOnNewDocument(() => {
    const timer = setInterval(() => {
      const turnstile = window.turnstile;
      if (!turnstile || turnstile.__captchaPatched || typeof turnstile.render !== 'function') return;
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
  console.log('1. Installing the Turnstile interceptor');
  await installInterceptor(page);
  console.log('2. Opening the Cloudflare Challenge page');
  await page.goto(process.env.TARGET_URL, { waitUntil: 'domcontentloaded' });

  const selector = process.env.SUCCESS_SELECTOR || 'p[class*="successMessage"]';
  const handle = await page.waitForFunction((successSelector) => {
    if (document.querySelector('#cf-error-details')?.textContent.includes('you have been blocked')) {
      return { blocked: true };
    }
    const success = document.querySelector(successSelector);
    if (success?.getClientRects().length && success.textContent.trim()) {
      return { success: success.textContent.trim() };
    }
    return window.__turnstileParams ? { params: window.__turnstileParams } : false;
  }, {}, selector);
  const state = await handle.jsonValue();
  await handle.dispose();
  if (state.blocked) throw new Error('Cloudflare blocked the browser before a task was created.');
  if (state.success) return `Already passed: ${state.success}`;

  console.log('3. Captured Challenge parameters', state.params);
  const task = new Tasks.TurnstileProxyless(state.params);
  console.log('4. Sending the task to Captcha Solver');
  const solution = await solver.solve(task);
  console.log('5. Solution received', solution);
  if (!solution.token) throw new Error('Captcha Solver returned an empty token.');

  // Token injection and submission are site-specific; adapt this step to the target page.
  console.log('6. Passing the token to the original Turnstile callback');
  await page.evaluate((token) => {
    if (typeof window.__turnstileCallback !== 'function') throw new Error('Turnstile callback was not found.');
    window.__turnstileCallback(token);
  }, solution.token);
  await page.waitForSelector(selector, { visible: true });
  return page.$eval(selector, (element) => element.textContent.trim());
}

/** Run the complete standalone Cloudflare Challenge example. */
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
