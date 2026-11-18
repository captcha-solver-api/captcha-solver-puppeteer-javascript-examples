import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

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

/**
 * This example solves GeeTest v4 without a proxy. It extracts captcha_id from the loader script,
 * creates Tasks.GeeTestProxyless, submits the complete returned solution, and verifies acceptance.
 * It uses CaptchaClient.solve().
 *
 * To adapt it, change GEETEST_V4_TARGET_URL and inspect the target's initialization parameters,
 * solution submission, and success response. Solution integration is unique to every site.
 *
 * How it works:
 * STEP-01 - Open the configured target page.
 * STEP-02 - Extract captcha_id from the GeeTest loader.
 * STEP-03 - Create and solve the GeeTest v4 task.
 * STEP-04 - Log and submit the solution.
 * STEP-05 - Verify that the page endpoint accepts it.
 * STEP-06 - Handle errors and close Chromium.
 */

puppeteer.use(StealthPlugin());
const DEFAULT_URL = 'https://example.com/page_with_geetest_v4';
const solverTimeout = 300_000;

/** Solve GeeTest v4 on an already opened page. */
export function solveCaptcha(page, solver) {
  const websiteURL = process.env.GEETEST_V4_TARGET_URL || DEFAULT_URL;

  // STEP-01: Open the configured target page.
  return (
    page
      .goto(websiteURL, { waitUntil: 'domcontentloaded' })
      // STEP-02: Extract captcha_id from the GeeTest loader script URL.
      .then(() => page.waitForSelector('script[src*="captcha_id="]'))
      .then(() => page.$eval('script[src*="captcha_id="]', (element) => element.src))
      .then((scriptURL) => {
        const captchaId = new URL(scriptURL).searchParams.get('captcha_id');
        if (!captchaId) throw new Error('GeeTest v4 captcha ID not found.');
        // STEP-03: Create and solve the GeeTest v4 task.
        const task = new Tasks.GeeTestProxyless({
          websiteURL: page.url(),
          version: 4,
          initParameters: { captcha_id: captchaId },
        });
        return solveAndLogTaskId(solver, task);
      })
      .then((solution) => {
        // STEP-04: Log and submit the complete v4 solution to this demo endpoint.
        console.log('Solution:', solution);
        // Solution submission is site-specific; adapt this step to the target page.
        // Inspect the target page's verification endpoint, required fields, and acceptance response before adapting it.
        return page.evaluate((result) => {
          return fetch('/api/v1/captcha-demo/gee-test-v4/verify', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(result),
          }).then((response) => response.json().then((body) => ({ ok: response.ok, body })));
        }, solution);
      })
      .then(({ ok, body }) => {
        // STEP-05: Require HTTP and application-level acceptance.
        if (!ok || body.result !== 'success')
          throw new Error('Page rejected the GeeTest v4 solution.');
        return 'GeeTest v4 solution accepted.';
      })
  );
}

/** Launch Chromium and run the complete GeeTest v4 example. */
export function main() {
  const solver = new CaptchaClient({
    clientKey: process.env.CAPTCHA_API_KEY || 'YOUR_API_KEY',
    timeout: solverTimeout,
  });
  let browser;
  return puppeteer
    .launch({
      headless: process.env.HEADLESS === 'true',
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
    console.error(error);
    process.exitCode = 1;
  });
}
