import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

/**
 * This example shows how to solve a Cloudflare Turnstile Challenge without using a proxy. It
 * intercepts the challenge parameters while the page loads, sends them to the service, passes the
 * returned token to the original callback, and verifies both the page confirmation and a fresh
 * clearance cookie. It uses Tasks.TurnstileProxyless and CaptchaClient.solve().
 *
 * To use this example on another challenge page, change the target URL and verify the interception
 * logic, User-Agent, callback, success selector, and clearance requirements. Challenge behavior is
 * site-specific, so inspect and debug the page before adapting the solution application step.
 * Token injection and submission are site-specific. You must inspect the target page and
 * determine the correct way to pass the token yourself.
 *
 * How it works:
 * STEP-01 - Configure the target, timeout, and SDK client.
 * STEP-02 - Launch Chromium and install the parameter interceptor.
 * STEP-03 - Open the target and capture its challenge parameters.
 * STEP-04 - Create the task and wait for the solver result.
 * STEP-05 - Log the solution and pass its token to the page callback.
 * STEP-06 - Verify the page confirmation and a fresh clearance cookie.
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

// STEP-01: Read the settings and create the SDK client.
const websiteURL =
  process.env.TURNSTILE_CHALLENGE_TARGET_URL || 'https://example.com/page_with_turnstile_challenge';
const parameterCaptureTimeout = 30_000;
const challengeNavigationTimeout = 60_000;
const successSelector = 'p[class*="successMessage"]';
const challengeConfirmation = 'challenge cleared and target page loaded.';
const client = new CaptchaClient({
  clientKey: process.env.CAPTCHA_API_KEY || 'YOUR_API_KEY',
});

let browser;

/** Install the Turnstile render interceptor before page scripts run. */
function installInterceptor(page) {
  return page.evaluateOnNewDocument(() => {
    const interceptionInterval = setInterval(() => {
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
      clearInterval(interceptionInterval);
    }, 10);
  });
}

/**
 * Solve a managed Turnstile Challenge on an opened Puppeteer page.
 * @param {import('puppeteer').Page} page Open Puppeteer page.
 * @param {CaptchaClient} solver Configured Captcha Solver client.
 * @returns {Promise<string>} Page text that confirms acceptance.
 */
export function solveCaptcha(page, solver = client) {
  let previousClearance;

  // STEP-02: Install the interceptor before the target initializes Turnstile.
  return (
    installInterceptor(page)
      // STEP-03: Open the target and wait for challenge parameters or an existing success state.
      .then(() =>
        page.goto(process.env.TURNSTILE_CHALLENGE_TARGET_URL || websiteURL, {
          waitUntil: 'domcontentloaded',
        }),
      )
      .then(() =>
        page.waitForFunction(
          (selector) => {
            if (
              document
                .querySelector('#cf-error-details')
                ?.textContent.includes('you have been blocked')
            ) {
              return { blocked: true };
            }
            const success = document.querySelector(selector);
            if (success?.getClientRects().length && success.textContent.trim()) {
              return { success: success.textContent.trim() };
            }
            return window.__turnstileParams ? { params: window.__turnstileParams } : false;
          },
          { timeout: parameterCaptureTimeout },
          successSelector,
        ),
      )
      .then((handle) =>
        handle.jsonValue().finally(() => {
          return handle.dispose();
        }),
      )
      .then((state) => {
        if (state.blocked) {
          throw new Error('Cloudflare blocked the browser before a task was created.');
        }
        if (state.success) return { alreadyPassed: state.success };

        return page.cookies().then((cookies) => {
          previousClearance = cookies.find((cookie) => cookie.name === 'cf_clearance')?.value;
          // STEP-04: Build the task and wait for the solver result.
          return solveAndLogTaskId(solver, new Tasks.TurnstileProxyless(state.params));
        });
      })
      // STEP-05: Log the solution and pass its token to the original page callback.
      .then((solution) => {
        if (solution.alreadyPassed) return `Already passed: ${solution.alreadyPassed}`;

        console.log('Solution:', solution);
        if (!solution.token) throw new Error('Captcha Solver returned an empty Turnstile token.');

        // Token injection and submission are site-specific; adapt this step to the target page.
        // Call the exact callback registered by this challenge page.
        return (
          Promise.all([
            page.waitForResponse(
              (response) =>
                response.request().isNavigationRequest() && response.frame() === page.mainFrame(),
              { timeout: challengeNavigationTimeout },
            ),
            page.evaluate((token) => {
              if (typeof window.__turnstileCallback !== 'function') {
                throw new Error('Turnstile callback was not found.');
              }
              window.__turnstileCallback(token);
            }, solution.token),
          ])
            .then(([response]) => {
              if (!response.ok()) {
                throw new Error(`Challenge navigation returned HTTP ${response.status()}.`);
              }
              return page.waitForSelector(successSelector, { visible: true });
            })
            // STEP-06: Require a fresh cookie as well as the page confirmation.
            .then(() => page.cookies())
            .then((cookies) => {
              const currentClearance = cookies.find(
                (cookie) => cookie.name === 'cf_clearance',
              )?.value;
              if (!currentClearance || currentClearance === previousClearance) {
                throw new Error('Cloudflare did not issue a new cf_clearance cookie.');
              }
              return challengeConfirmation;
            })
        );
      })
  );
}

/** Run the complete standalone Turnstile Challenge example. */
export function main() {
  // Launch Chromium and create a browser page.
  return (
    puppeteer
      .launch({
        headless: process.env.HEADLESS === 'true',
      })
      .then((instance) => {
        browser = instance;
        return browser.newPage();
      })
      .then((page) => solveCaptcha(page))
      .then((message) => console.log(`Page confirmation: ${message}`))
      // STEP-07: Always close Chromium and let callers handle failures.
      .finally(() => browser?.close())
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Report errors and set a nonzero exit code when this file runs directly.
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
