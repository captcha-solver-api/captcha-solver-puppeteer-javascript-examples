import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

/**
 * This example solves GeeTest v3 without a proxy. It intercepts a fresh gt/challenge pair,
 * creates Tasks.GeeTestProxyless, submits the returned fields to the page verification endpoint,
 * and requires an explicit successful response. It uses CaptchaClient.solve().
 *
 * To adapt it, change GEETEST_V3_TARGET_URL and inspect how the target initializes GeeTest,
 * consumes the solution, and reports acceptance. Solution integration is unique to every site.
 *
 * How it works:
 * STEP-01 - Install the GeeTest initialization interceptor.
 * STEP-02 - Open the target and capture gt/challenge.
 * STEP-03 - Create and solve the GeeTest v3 task.
 * STEP-04 - Log and submit the solution.
 * STEP-05 - Verify that the page endpoint accepts it.
 * STEP-06 - Handle errors and close Chromium.
 */

puppeteer.use(StealthPlugin());
const DEFAULT_URL = 'https://example.com/page_with_geetest_v3';
const solverTimeout = 300_000;

/** Solve GeeTest v3 on an already opened page. */
export function solveCaptcha(page, solver) {
  const websiteURL = process.env.GEETEST_V3_TARGET_URL || DEFAULT_URL;

  // STEP-01: Install the interceptor before the target initializes GeeTest.
  return (
    page
      .evaluateOnNewDocument(() => {
        Object.defineProperty(window, 'initGeetest', {
          configurable: true,
          set(originalInitGeetest) {
            Object.defineProperty(window, 'initGeetest', {
              configurable: true,
              value: (config, callback) => {
                window.__geetestConfig = config;
                window.__originalInitGeetest = originalInitGeetest;
                window.__originalGeeTestCallback = callback;
              },
            });
          },
        });
      })
      // STEP-02: Open the target and wait for the fresh initialization parameters.
      .then(() => page.goto(websiteURL, { waitUntil: 'domcontentloaded' }))
      .then(() => page.waitForFunction(() => window.__geetestConfig))
      .then(() => page.evaluate(() => window.__geetestConfig))
      .then((config) => {
        if (!config.gt || !config.challenge) throw new Error('GeeTest v3 parameters not found.');
        // STEP-03: Create and solve the GeeTest v3 task.
        const task = new Tasks.GeeTestProxyless({
          websiteURL: page.url(),
          gt: config.gt,
          challenge: config.challenge,
          geetestApiServerSubdomain: config.api_server || 'api.geetest.com',
        });
        console.log('3. Sending GeeTest v3 task', task.toDict());
        return solver.solve(task);
      })
      .then((solution) => {
        // STEP-04: Log and submit all v3 solution fields to this demo endpoint.
        console.log('4. Solution received', solution);
        // Solution submission is site-specific; adapt this step to the target page.
        // Inspect the target page's verification endpoint, required fields, and acceptance response before adapting it.
        return page.evaluate((result) => {
          return fetch('/api/v1/captcha-demo/gee-test/verify', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              geetest_challenge: result.challenge,
              geetest_validate: result.validate,
              geetest_seccode: result.seccode,
            }),
          }).then((response) => response.json().then((body) => ({ ok: response.ok, body })));
        }, solution);
      })
      .then(({ ok, body }) => {
        // STEP-05: Require HTTP and application-level acceptance.
        if (!ok || body.success !== true) throw new Error('Page rejected the GeeTest v3 solution.');
        return 'GeeTest v3 solution accepted.';
      })
  );
}

/** Launch Chromium and run the complete GeeTest v3 example. */
export function main() {
  const solver = new CaptchaClient({
    clientKey: process.env.CAPTCHA_API_KEY || 'YOUR_API_KEY',
    timeout: solverTimeout,
  });
  let browser;
  return puppeteer
    .launch({
      headless: process.env.HEADLESS === 'true',
      executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
    })
    .then((instance) => {
      browser = instance;
      return browser.newPage();
    })
    .then((page) => solveCaptcha(page, solver))
    .then((message) => console.log('Page confirmation:', message))
    .finally(() => browser?.close());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // STEP-06: Report errors; main() closes Chromium in every outcome.
  main().catch((error) => {
    console.error('Example failed:', error.message);
    process.exitCode = 1;
  });
}
