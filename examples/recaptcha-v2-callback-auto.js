import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

/**
 * This example solves callback-based reCAPTCHA v2 without a proxy when the callback name is unknown. It discovers the active callback and widget parameters, creates Tasks.RecaptchaV2Proxyless, and calls CaptchaClient.solve(). It invokes the discovered callback with gRecaptchaResponse and separately requires a page-specific success element.
 *
 * To use this example on another page, change the target URL and inspect its reCAPTCHA configuration. Callback discovery, invocation, and acceptance indicators are site-specific.
 *
 * How it works:
 * STEP-01 - Opening the callback-based reCAPTCHA page.
 * STEP-02 - Discovering the callback and CAPTCHA parameters.
 * STEP-03 - Sending the task to Captcha Solver.
 * STEP-04 - Solution received.
 * STEP-05 - Passing the token to the discovered callback.
 * STEP-06 - Waiting for page acceptance.
 */

/** Run the complete standalone callback-discovery example. */

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
/** Solve reCAPTCHA and invoke the automatically discovered callback. */
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
      // STEP-02: Discovering the callback and CAPTCHA parameters.
      console.log('2. Discovering the callback and CAPTCHA parameters');
      return Promise.resolve(discoverCaptcha(page)).then(function (captcha) {
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

              // Token injection and submission are site-specific; adapt this step to the target page.
              // Inspect the target page's callback, submission flow, and acceptance signals before adapting it.
              // STEP-05: Passing the token to the discovered callback.
              console.log('5. Passing the token to the discovered callback');
              return Promise.resolve(
                page.evaluate(
                  (token) => window.__captchaCallback(token),
                  solution.gRecaptchaResponse,
                ),
              ).then(function () {
                // STEP-06: Waiting for page acceptance.
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
  } catch (e) {
    return Promise.reject(e);
  }
};
/** Find the active reCAPTCHA callback and return its public task parameters. */
const discoverCaptcha = function (page) {
  try {
    return Promise.resolve(
      page.waitForFunction(() => {
        const resolveName = (name) => name.split('.').reduce((value, key) => value?.[key], window);
        const widget = document.querySelector('[data-sitekey][data-callback]');
        if (widget && typeof resolveName(widget.dataset.callback) === 'function') {
          window.__captchaCallback = resolveName(widget.dataset.callback);
          return {
            websiteKey: widget.dataset.sitekey,
            isInvisible: widget.dataset.size === 'invisible',
          };
        }
        const visited = new WeakSet();
        const search = (value, depth = 0) => {
          if (
            !value ||
            typeof value !== 'object' ||
            depth > 6 ||
            visited.has(value) ||
            value instanceof Node
          )
            return null;
          visited.add(value);
          if (typeof value.sitekey === 'string' && value.callback) {
            const callback =
              typeof value.callback === 'string' ? resolveName(value.callback) : value.callback;
            if (typeof callback === 'function') {
              window.__captchaCallback = callback.bind(value);
              return {
                websiteKey: value.sitekey,
                isInvisible: value.size === 'invisible',
              };
            }
          }
          for (const child of Object.values(value)) {
            const result = search(child, depth + 1);
            if (result) return result;
          }
          return null;
        };
        return search(window.___grecaptcha_cfg?.clients);
      }),
    ).then(function (handle) {
      return Promise.resolve(handle.jsonValue()).then(function (captcha) {
        return Promise.resolve(handle.dispose()).then(function () {
          return captcha;
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
