/**
 * Solve reCAPTCHA v2 when the callback name is unknown.
 * The example discovers the callback in the live reCAPTCHA configuration,
 * keeps the function inside the page, solves the task, and invokes it.
 */
import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

/** Find the active reCAPTCHA callback and return its public task parameters. */
async function discoverCaptcha(page) {
  const handle = await page.waitForFunction(() => {
    const resolveName = (name) => name.split('.').reduce((value, key) => value?.[key], window);
    const widget = document.querySelector('[data-sitekey][data-callback]');
    if (widget && typeof resolveName(widget.dataset.callback) === 'function') {
      window.__captchaCallback = resolveName(widget.dataset.callback);
      return { websiteKey: widget.dataset.sitekey, isInvisible: widget.dataset.size === 'invisible' };
    }

    const visited = new WeakSet();
    const search = (value, depth = 0) => {
      if (!value || typeof value !== 'object' || depth > 6 || visited.has(value) || value instanceof Node) return null;
      visited.add(value);
      if (typeof value.sitekey === 'string' && value.callback) {
        const callback = typeof value.callback === 'string' ? resolveName(value.callback) : value.callback;
        if (typeof callback === 'function') {
          window.__captchaCallback = callback.bind(value);
          return { websiteKey: value.sitekey, isInvisible: value.size === 'invisible' };
        }
      }
      for (const child of Object.values(value)) {
        const result = search(child, depth + 1);
        if (result) return result;
      }
      return null;
    };
    return search(window.___grecaptcha_cfg?.clients);
  });
  const captcha = await handle.jsonValue();
  await handle.dispose();
  return captcha;
}

/** Solve reCAPTCHA and invoke the automatically discovered callback. */
export async function solveCaptcha(page, solver) {
  if (!process.env.TARGET_URL) throw new Error('Set TARGET_URL for this example.');
  console.log('1. Opening the callback-based reCAPTCHA page');
  await page.goto(process.env.TARGET_URL, { waitUntil: 'domcontentloaded' });

  console.log('2. Discovering the callback and CAPTCHA parameters');
  const captcha = await discoverCaptcha(page);
  const task = new Tasks.RecaptchaV2Proxyless({
    websiteURL: page.url(),
    ...captcha,
    userAgent: await page.evaluate(() => navigator.userAgent),
  });
  console.log('3. Sending the task to Captcha Solver', task.toDict());
  const solution = await solver.solve(task);
  console.log('4. Solution received', solution);
  if (!solution.gRecaptchaResponse) throw new Error('Captcha Solver returned an empty token.');

  console.log('5. Passing the token to the discovered callback');
  await page.evaluate((token) => window.__captchaCallback(token), solution.gRecaptchaResponse);
  const selector = process.env.SUCCESS_SELECTOR || 'p[class*="successMessage"]';
  await page.waitForSelector(selector, { visible: true });
  return page.$eval(selector, (element) => element.textContent.trim());
}

/** Run the complete standalone callback-discovery example. */
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
