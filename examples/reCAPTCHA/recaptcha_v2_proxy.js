import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

/**
 * Solve Google reCAPTCHA v2 through the same proxy in Chromium and Captcha Solver. It uses
 * Tasks.RecaptchaV2 and CaptchaClient.solve(), injects the token, submits the form, and checks
 * page acceptance.
 * Token injection and submission are site-specific. You must inspect the target page and
 * determine the correct way to pass the token yourself.
 *
 * How it works:
 * STEP-01 - Read proxy settings and configure the SDK client.
 * STEP-02 - Launch Chromium through the proxy and open the target.
 * STEP-03 - Extract the widget parameters.
 * STEP-04 - Create and solve a proxy-based task.
 * STEP-05 - Log and inject the solution.
 * STEP-06 - Submit the form and verify acceptance.
 * STEP-07 - Handle errors and close Chromium.
 */

puppeteer.use(StealthPlugin());

/** Solve a task with the SDK and log the task ID returned by createTask(). */
function solveAndLogTaskId(solver, task) {
  const loggingSolver = Object.create(solver);
  loggingSolver.createTask = (...args) =>
    solver.createTask(...args).then((taskId) => {
      console.log('Task ID:', taskId);
      return taskId;
    });
  return loggingSolver.solve(task);
}
const websiteURL =
  process.env.RECAPTCHA_V2_TARGET_URL || 'https://www.google.com/recaptcha/api2/demo';
const client = new CaptchaClient({ clientKey: process.env.CAPTCHA_API_KEY || 'YOUR_API_KEY' });
let browser;

/** Read and validate proxy settings from the environment. */
function getProxy() {
  const proxyPort = Number(process.env.PROXY_PORT);
  if (!process.env.PROXY_ADDRESS || !Number.isInteger(proxyPort)) {
    throw new Error('Set PROXY_ADDRESS and PROXY_PORT for the proxy example.');
  }
  return {
    proxyType: process.env.PROXY_TYPE || 'http',
    proxyAddress: process.env.PROXY_ADDRESS,
    proxyPort,
    proxyLogin: process.env.PROXY_LOGIN || undefined,
    proxyPassword: process.env.PROXY_PASSWORD || undefined,
  };
}

/** Solve and submit reCAPTCHA v2 through the configured proxy. */
export function solveCaptcha(page, solver = client, proxy = getProxy()) {
  // STEP-02: Open the target through Chromium's configured proxy.
  return (
    page
      .goto(process.env.RECAPTCHA_V2_TARGET_URL || websiteURL, { waitUntil: 'domcontentloaded' })
      .then(() => page.waitForSelector('[data-sitekey]'))
      // STEP-03: Read widget parameters and the browser User-Agent.
      .then(() =>
        Promise.all([
          page.$eval('[data-sitekey]', (element) => ({
            websiteKey: element.getAttribute('data-sitekey'),
            isInvisible: element.getAttribute('data-size') === 'invisible',
            recaptchaDataSValue: element.getAttribute('data-s') || undefined,
          })),
          page.evaluate(() => navigator.userAgent),
        ]),
      )
      // STEP-04: Send the same proxy identity with the SDK task.
      .then(([captcha, userAgent]) =>
        solveAndLogTaskId(
          solver,
          new Tasks.RecaptchaV2({
            websiteURL: page.url(),
            ...captcha,
            ...proxy,
            userAgent,
          }),
        ),
      )
      .then((solution) => {
        // STEP-05: Token injection and submission are site-specific.
        console.log('Solution:', solution);
        if (!solution.gRecaptchaResponse)
          throw new Error('Captcha Solver returned an empty token.');
        return page.evaluate((token) => {
          let response = document.querySelector('[name="g-recaptcha-response"]');
          if (!response) {
            response = document.createElement('textarea');
            response.name = 'g-recaptcha-response';
            document.querySelector('form')?.append(response);
          }
          response.value = token;
          response.dispatchEvent(new Event('change', { bubbles: true }));
        }, solution.gRecaptchaResponse);
      })
      // STEP-06: Submit and require a visible acceptance signal.
      .then(() => page.click('button[type="submit"], input[type="submit"]'))
      .then(() =>
        page.waitForSelector('.recaptcha-success, p[class*="successMessage"]', { visible: true }),
      )
      .then(() =>
        page.$eval('.recaptcha-success, p[class*="successMessage"]', (element) =>
          element.textContent.trim(),
        ),
      )
  );
}

/** Run the complete standalone proxy example. */
export function main() {
  // STEP-01: Validate proxy configuration before launching the browser.
  const proxy = getProxy();
  const endpoint = `${proxy.proxyType}://${proxy.proxyAddress}:${proxy.proxyPort}`;
  return (
    puppeteer
      .launch({ headless: process.env.HEADLESS === 'true', args: [`--proxy-server=${endpoint}`] })
      .then((instance) => {
        browser = instance;
        return browser.newPage();
      })
      .then((page) => {
        const authentication = proxy.proxyLogin
          ? page.authenticate({ username: proxy.proxyLogin, password: proxy.proxyPassword })
          : page.evaluate(() => true);
        return authentication.then(() => solveCaptcha(page, client, proxy));
      })
      .then((message) => console.log(`Page confirmation: ${message}`))
      // STEP-07: Always close Chromium.
      .finally(() => browser?.close())
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
