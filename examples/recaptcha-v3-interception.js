import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

/**
 * This example solves reCAPTCHA v3 when execute() is called from an external script. It installs an interceptor before navigation, captures the site key and action, creates Tasks.RecaptchaV3Proxyless, and calls CaptchaClient.solve(). It resolves the intercepted Promise with gRecaptchaResponse and separately requires a page-specific success element.
 *
 * To use this example on another page, change the target URL and verify the intercepted API, trigger, action, score, and acceptance signal. Promise resolution alone does not prove server-side acceptance.
 *
 * How it works:
 * STEP-01 - Installing the execute() interceptor.
 * STEP-02 - Opening the reCAPTCHA v3 page.
 * STEP-03 - Captured reCAPTCHA parameters.
 * STEP-04 - Sending the task to Captcha Solver.
 * STEP-05 - Solution received.
 * STEP-06 - Resolving the intercepted execute() promise.
 * STEP-07 - Waiting for page acceptance.
 */

/** Run the complete standalone intercepted reCAPTCHA v3 example. */

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
      const _temp3 = _finallyRethrows(
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
      if (_temp3 && _temp3.then) return _temp3.then(function () {});
    });
  } catch (e) {
    return Promise.reject(e);
  }
};
/** Solve intercepted reCAPTCHA v3 on an already opened page. */
export const solveCaptcha = function (page, solver) {
  try {
    if (!process.env.TARGET_URL) throw new Error('Set TARGET_URL for this example.');
    // STEP-01: Installing the execute() interceptor.
    console.log('1. Installing the execute() interceptor');
    return Promise.resolve(installInterceptor(page)).then(function () {
      // STEP-02: Opening the reCAPTCHA v3 page.
      console.log('2. Opening the reCAPTCHA v3 page');
      return Promise.resolve(
        page.goto(process.env.TARGET_URL, {
          waitUntil: 'domcontentloaded',
        }),
      ).then(function () {
        return Promise.resolve(page.evaluate(() => Boolean(window.__recaptchaV3))).then(
          function (_page$evaluate) {
            /** Wait for intercepted execute() parameters and solve the captured challenge. */
            function _temp2() {
              return Promise.resolve(
                page.waitForFunction(() => window.__recaptchaV3 || false),
              ).then(function (handle) {
                return Promise.resolve(handle.jsonValue()).then(function (params) {
                  return Promise.resolve(handle.dispose()).then(function () {
                    // STEP-03: Captured reCAPTCHA parameters.
                    console.log('3. Captured reCAPTCHA parameters', params);
                    const task = new Tasks.RecaptchaV3Proxyless({
                      websiteURL: page.url(),
                      ...params,
                      minScore: Number(process.env.RECAPTCHA_MIN_SCORE || 0.3),
                    });
                    // STEP-04: Sending the task to Captcha Solver.
                    console.log('4. Sending the task to Captcha Solver');
                    return Promise.resolve(solver.solve(task)).then(function (solution) {
                      // STEP-05: Solution received.
                      console.log('5. Solution received', solution);
                      if (!solution.gRecaptchaResponse)
                        throw new Error('Captcha Solver returned an empty token.');
                      // Token injection and submission are site-specific; adapt this step to the target page.
                      // Inspect the target page's intercepted flow and acceptance signals before adapting it.
                      // STEP-06: Resolving the intercepted execute() promise.
                      console.log('6. Resolving the intercepted execute() promise');
                      return Promise.resolve(
                        page.evaluate(
                          (token) => window.__resolveRecaptchaV3(token),
                          solution.gRecaptchaResponse,
                        ),
                      ).then(function () {
                        // STEP-07: Waiting for page acceptance.
                        const selector =
                          process.env.SUCCESS_SELECTOR || 'p[class*="successMessage"]';
                        return Promise.resolve(
                          page.waitForSelector(selector, {
                            visible: true,
                          }),
                        ).then(function () {
                          return page.$eval(selector, (element) => element.textContent.trim());
                        });
                      });
                    });
                  });
                });
              });
            }
            const _temp = (function () {
              if (!_page$evaluate) {
                return Promise.resolve(
                  page.click(
                    process.env.SUBMIT_SELECTOR || 'button[type="submit"], input[type="submit"]',
                  ),
                ).then(function () {});
              }
            })();
            return _temp && _temp.then ? _temp.then(_temp2) : _temp2(_temp);
          },
        );
      });
    });
  } catch (e) {
    return Promise.reject(e);
  }
};
/** Install a small execute() interceptor before page scripts run. */
const installInterceptor = function (page) {
  try {
    return Promise.resolve(
      page.evaluateOnNewDocument(() => {
        const patch = (api) => {
          if (!api || api.__captchaPatched) return api;
          Object.defineProperty(api, '__captchaPatched', {
            value: true,
          });
          Object.defineProperty(api, 'execute', {
            configurable: true,
            get:
              () =>
              (websiteKey, options = {}) => {
                window.__recaptchaV3 = {
                  websiteKey,
                  pageAction: options.action,
                };
                return new Promise((resolve) => {
                  window.__resolveRecaptchaV3 = resolve;
                });
              },
          });
          return api;
        };
        let api = patch(window.grecaptcha);
        Object.defineProperty(window, 'grecaptcha', {
          configurable: true,
          get: () => api,
          set: (value) => {
            api = patch(value);
          },
        });
      }),
    ).then(function () {});
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
