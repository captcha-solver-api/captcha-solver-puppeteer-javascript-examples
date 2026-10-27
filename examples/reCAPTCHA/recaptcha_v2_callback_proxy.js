/**
 * Solve callback-based reCAPTCHA v2 through an HTTP proxy.
 * Chrome and the API task use the same proxy. The callback is discovered from
 * the widget's data-callback attribute, then called with the returned token.
 */
import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

/** Read proxy settings from environment variables. */
function getProxy() {
  const proxyAddress = process.env.PROXY_ADDRESS;
  const proxyPort = Number(process.env.PROXY_PORT);
  if (!proxyAddress || !Number.isInteger(proxyPort)) throw new Error('Set PROXY_ADDRESS and PROXY_PORT.');
  return {
    proxyType: process.env.PROXY_TYPE || 'http', proxyAddress, proxyPort,
    proxyLogin: process.env.PROXY_LOGIN || undefined,
    proxyPassword: process.env.PROXY_PASSWORD || undefined,
  };
}

/** Solve reCAPTCHA and invoke its named callback. */
export async function solveCaptcha(page, solver, proxy) {
  if (!process.env.TARGET_URL) throw new Error('Set TARGET_URL for this example.');
  console.log('1. Opening the page through the configured proxy');
  await page.goto(process.env.TARGET_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-sitekey][data-callback]');

  console.log('2. Reading CAPTCHA parameters and callback name');
  const captcha = await page.$eval('[data-sitekey][data-callback]', (element) => ({
    websiteKey: element.dataset.sitekey,
    callbackName: element.dataset.callback,
    isInvisible: element.dataset.size === 'invisible',
  }));
  const task = new Tasks.RecaptchaV2({
    websiteURL: page.url(), websiteKey: captcha.websiteKey,
    isInvisible: captcha.isInvisible, userAgent: await page.evaluate(() => navigator.userAgent),
    ...proxy,
  });
  console.log('3. Sending the task to Captcha Solver');
  const solution = await solver.solve(task);
  console.log('4. Solution received', solution);
  if (!solution.gRecaptchaResponse) throw new Error('Captcha Solver returned an empty token.');

  console.log(`5. Calling ${captcha.callbackName}`);
  await page.evaluate((name, token) => {
    const callback = name.split('.').reduce((value, key) => value?.[key], window);
    if (typeof callback !== 'function') throw new Error(`Callback ${name} was not found.`);
    callback(token);
  }, captcha.callbackName, solution.gRecaptchaResponse);
  const selector = process.env.SUCCESS_SELECTOR || 'p[class*="successMessage"]';
  await page.waitForSelector(selector, { visible: true });
  return page.$eval(selector, (element) => element.textContent.trim());
}

/** Run the complete standalone proxy callback example. */
export async function main() {
  const apiKey = process.env.CAPTCHA_API_KEY;
  if (!apiKey || apiKey === 'your_api_key') throw new Error('Set CAPTCHA_API_KEY.');
  const proxy = getProxy();
  const solver = new CaptchaClient({ clientKey: apiKey });
  const browser = await puppeteer.launch({
    headless: process.env.HEADLESS === 'true',
    executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
    args: [`--proxy-server=${proxy.proxyType}://${proxy.proxyAddress}:${proxy.proxyPort}`],
  });
  try {
    const page = await browser.newPage();
    if (proxy.proxyLogin) await page.authenticate({ username: proxy.proxyLogin, password: proxy.proxyPassword });
    console.log('Captcha solved successfully:', await solveCaptcha(page, solver, proxy));
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error('Example failed:', error.message); process.exitCode = 1; });
}
