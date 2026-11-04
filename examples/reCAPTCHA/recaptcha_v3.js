/**
 * Solve reCAPTCHA v3 with a known page callback.
 * The example reads the site key and action from page scripts, solves the task,
 * invokes the callback, and verifies that the page accepted the token.
 */
import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

/** Solve reCAPTCHA v3 on an already opened page. */
export async function solveCaptcha(page, solver) {
  if (!process.env.TARGET_URL) throw new Error('Set TARGET_URL for this example.');
  console.log('1. Opening the reCAPTCHA v3 page');
  await page.goto(process.env.TARGET_URL, { waitUntil: 'domcontentloaded' });

  console.log('2. Reading the site key and action from page scripts');
  const captcha = await page.waitForFunction((sitekey, action) => {
    if (sitekey && action) return { websiteKey: sitekey, pageAction: action };
    const source = Array.from(document.scripts, (script) => script.textContent).join('\n');
    const match = source.match(/grecaptcha\.execute\s*\(\s*['"]([^'"]+)['"]\s*,\s*\{[^}]*action\s*:\s*['"]([^'"]+)['"]/);
    return match ? { websiteKey: match[1], pageAction: match[2] } : false;
  }, {}, process.env.RECAPTCHA_SITEKEY || '', process.env.RECAPTCHA_ACTION || '');
  const params = await captcha.jsonValue();
  await captcha.dispose();

  const task = new Tasks.RecaptchaV3Proxyless({
    websiteURL: page.url(),
    websiteKey: params.websiteKey,
    pageAction: params.pageAction,
    minScore: Number(process.env.RECAPTCHA_MIN_SCORE || 0.3),
  });
  console.log('3. Sending the task to Captcha Solver', task.toDict());
  const solution = await solver.solve(task);
  console.log('4. Solution received', solution);
  if (!solution.gRecaptchaResponse) throw new Error('Captcha Solver returned an empty token.');

  // Token injection and submission are site-specific; adapt this step to the target page.
  const callbackName = process.env.CALLBACK_NAME || 'verifyRecaptcha';
  console.log(`5. Passing the token to ${callbackName}`);
  await page.evaluate((name, token) => {
    const callback = name.split('.').reduce((value, key) => value?.[key], window);
    if (typeof callback !== 'function') throw new Error(`Callback ${name} was not found.`);
    callback(token);
  }, callbackName, solution.gRecaptchaResponse);

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
  main().catch((error) => { console.error('Example failed:', error.message); process.exitCode = 1; });
}
