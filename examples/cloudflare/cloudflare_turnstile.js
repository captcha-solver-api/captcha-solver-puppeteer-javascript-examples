/**
 * Solve an embedded Cloudflare Turnstile widget.
 * The example reads the widget parameters, solves them through the SDK, fills
 * the response field, submits the form, and confirms page acceptance.
 */
import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

/** Solve Turnstile on an already opened page. */
export async function solveCaptcha(page, solver) {
  if (!process.env.TARGET_URL) throw new Error('Set TARGET_URL for this example.');
  console.log('1. Opening the Turnstile page');
  await page.goto(process.env.TARGET_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.cf-turnstile[data-sitekey]');

  console.log('2. Reading Turnstile widget parameters');
  const captcha = await page.$eval('.cf-turnstile[data-sitekey]', (widget) => ({
    websiteKey: widget.dataset.sitekey,
    action: widget.dataset.action,
    data: widget.dataset.cdata,
  }));
  const task = new Tasks.TurnstileProxyless({
    websiteURL: page.url(),
    ...captcha,
    userAgent: await page.evaluate(() => navigator.userAgent),
  });

  console.log('3. Sending the task to Captcha Solver', task.toDict());
  const solution = await solver.solve(task);
  console.log('4. Solution received', solution);
  if (!solution.token) throw new Error('Captcha Solver returned an empty token.');

  // Token injection and submission are site-specific; adapt this step to the target page.
  console.log('5. Writing the token into cf-turnstile-response');
  await page.evaluate((token) => {
    const fields = document.getElementsByName('cf-turnstile-response');
    if (!fields.length) throw new Error('cf-turnstile-response field was not found.');
    for (const field of fields) {
      field.value = token;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, solution.token);

  console.log('6. Submitting and waiting for page acceptance');
  await page.click(process.env.SUBMIT_SELECTOR || 'button[type="submit"], input[type="submit"]');
  const selector = process.env.SUCCESS_SELECTOR || 'p[class*="successMessage"]';
  await page.waitForSelector(selector, { visible: true });
  return page.$eval(selector, (element) => element.textContent.trim());
}

/** Run the complete standalone Turnstile example. */
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
