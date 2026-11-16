import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

/**
 * This example solves callback-based reCAPTCHA v2 without a proxy when the callback name is known. It extracts the widget parameters, creates Tasks.RecaptchaV2Proxyless, and calls CaptchaClient.solve(). It passes gRecaptchaResponse to the configured page callback and separately requires a page-specific success element.
 *
 * To use this example on another page, change the target URL and callback name and verify the site key, callback ownership, and acceptance signal. Callback delivery alone does not prove server-side acceptance.
 *
 * How it works:
 * STEP-01 - Opening the callback-based reCAPTCHA page.
 * STEP-02 - Reading reCAPTCHA parameters.
 * STEP-03 - Sending the task to Captcha Solver.
 * STEP-04 - Solution received.
 * STEP-05 - Call the configured callback with the returned token.
 * STEP-06 - Waiting for page acceptance.
 */

/** Run the complete standalone callback example. */

/** Run cleanup after a synchronous or Promise-returning operation and preserve failures. */
function _finallyRethrows(body, finalizer) {
  try {
    var result = body();
  } catch (e) {
    return finalizer(true, e);
  }
  if (result && result.then) {
    return result.then(finalizer.bind(null, false), finalizer.bind(null, true));
  }
  return finalizer(false, result);
}
export const main = function () {
  try {
    const solver = new CaptchaClient({
      clientKey: process.env.CAPTCHA_API_KEY || 'YOUR_API_KEY',
    });
    return Promise.resolve(
      puppeteer.launch({
        headless: process.env.HEADLESS === 'true',
        executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
      }),
    ).then(function (browser) {
      const _temp = _finallyRethrows(
        function () {
          return Promise.resolve(browser.newPage()).then(function (page) {
            return Promise.resolve(solveCaptcha(page, solver)).then(function (_solveCaptcha) {
              console.log('Page confirmation:', _solveCaptcha);
            });
          });
        },
        function (_wasThrown, _result) {
          return Promise.resolve(browser.close()).then(function () {
            if (_wasThrown) throw _result;
            return _result;
          });
        },
      );
      if (_temp && _temp.then) return _temp.then(function () {});
    });
  } catch (e) {
    return Promise.reject(e);
  }
};
/** Solve reCAPTCHA and invoke the page callback with the returned token. */
export const solveCaptcha = function (page, solver) {
  try {
    if (!process.env.TARGET_URL) throw new Error('Set TARGET_URL for this example.');
    // STEP-01: Opening the callback-based reCAPTCHA page.
    console.log('1. Opening the callback-based reCAPTCHA page');
    return Promise.resolve(
      page.goto(process.env.TARGET_URL, {
        waitUntil: 'domcontentloaded',
      }),
    ).then(function () {
      return Promise.resolve(page.waitForSelector('[data-sitekey]')).then(function () {
        // STEP-02: Reading reCAPTCHA parameters.
        console.log('2. Reading reCAPTCHA parameters');
        return Promise.resolve(
          page.$eval('[data-sitekey]', (element) => ({
            websiteKey: element.getAttribute('data-sitekey'),
            isInvisible: element.getAttribute('data-size') === 'invisible',
          })),
        ).then(function (captcha) {
          const _page$url = page.url();
          return Promise.resolve(page.evaluate(() => navigator.userAgent)).then(
            function (_page$evaluate) {
              const task = new Tasks.RecaptchaV2Proxyless({
                websiteURL: _page$url,
                ...captcha,
                userAgent: _page$evaluate,
              });
              // STEP-03: Sending the task to Captcha Solver.
              console.log('3. Sending the task to Captcha Solver', task.toDict());
              return Promise.resolve(solver.solve(task)).then(function (solution) {
                // STEP-04: Solution received.
                console.log('4. Solution received', solution);
                if (!solution.gRecaptchaResponse)
                  throw new Error('Captcha Solver returned an empty token.');
                const callbackName = process.env.CALLBACK_NAME || 'verifyDemoRecaptcha';
                // Token injection and submission are site-specific; adapt this step to the target page.
                // Inspect the target page's callback, submission flow, and acceptance signals before adapting it.
                // STEP-05: Call the configured callback with the returned token.
                console.log(`5. Calling ${callbackName} with the returned token`);
                return Promise.resolve(
                  page.evaluate(
                    (name, token) => {
                      const parts = name.split('.');
                      let owner = window;
                      for (const part of parts.slice(0, -1)) owner = owner?.[part];
                      const callback = owner?.[parts.at(-1)];
                      if (typeof callback !== 'function')
                        throw new Error(`Callback ${name} was not found.`);
                      callback.call(owner, token);
                    },
                    callbackName,
                    solution.gRecaptchaResponse,
                  ),
                ).then(function () {
                  // STEP-06: Waiting for page acceptance.
                  console.log('6. Waiting for page acceptance');
                  const selector = process.env.SUCCESS_SELECTOR || 'p[class*="successMessage"]';
                  return Promise.resolve(
                    page.waitForSelector(selector, {
                      visible: true,
                    }),
                  ).then(function () {
                    return page.$eval(selector, (element) => element.textContent.trim());
                  });
                });
              });
            },
          );
        });
      });
    });
  } catch (e) {
    return Promise.reject(e);
  }
};
puppeteer.use(StealthPlugin());
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('Example failed:', error.message);
    process.exitCode = 1;
  });
}
