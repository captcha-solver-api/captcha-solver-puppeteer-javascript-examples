import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

/**
 * This example solves reCAPTCHA v3 without a proxy. It extracts the site key and action from grecaptcha.execute(), creates Tasks.RecaptchaV3Proxyless with the configured minimum score, and calls CaptchaClient.solve(). It passes gRecaptchaResponse to the page callback and separately requires a page-specific success element.
 *
 * To use this example on another page, change the target URL and verify the site key, action, score, callback, and acceptance signal. Callback delivery alone does not prove server-side acceptance.
 *
 * How it works:
 * STEP-01 - Opening the reCAPTCHA v3 page.
 * STEP-02 - Reading the site key and action from page scripts.
 * STEP-03 - Sending the task to Captcha Solver.
 * STEP-04 - Solution received.
 * STEP-05 - Passing the token to ${callbackName}.
 * STEP-06 - Waiting for page acceptance.
 */

/** Run the complete standalone reCAPTCHA v3 example. */

/**
 *
 */
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
/** Solve reCAPTCHA v3 on an already opened page. */
export const solveCaptcha = function (page, solver) {
  try {
    if (!process.env.TARGET_URL) throw new Error('Set TARGET_URL for this example.');
    // STEP-01: Opening the reCAPTCHA v3 page.
    console.log('1. Opening the reCAPTCHA v3 page');
    return Promise.resolve(
      page.goto(process.env.TARGET_URL, {
        waitUntil: 'domcontentloaded',
      }),
    ).then(function () {
      // STEP-02: Reading the site key and action from page scripts.
      console.log('2. Reading the site key and action from page scripts');
      return Promise.resolve(
        page.waitForFunction(
          (sitekey, action) => {
            if (sitekey && action)
              return {
                websiteKey: sitekey,
                pageAction: action,
              };
            const source = Array.from(document.scripts, (script) => script.textContent).join('\n');
            const match = source.match(
              /grecaptcha\.execute\s*\(\s*['"]([^'"]+)['"]\s*,\s*\{[^}]*action\s*:\s*['"]([^'"]+)['"]/,
            );
            return match
              ? {
                  websiteKey: match[1],
                  pageAction: match[2],
                }
              : false;
          },
          {},
          process.env.RECAPTCHA_SITEKEY || '',
          process.env.RECAPTCHA_ACTION || '',
        ),
      ).then(function (captcha) {
        return Promise.resolve(captcha.jsonValue()).then(function (params) {
          return Promise.resolve(captcha.dispose()).then(function () {
            const task = new Tasks.RecaptchaV3Proxyless({
              websiteURL: page.url(),
              websiteKey: params.websiteKey,
              pageAction: params.pageAction,
              minScore: Number(process.env.RECAPTCHA_MIN_SCORE || 0.3),
            });
            // Token injection and submission are site-specific; adapt this step to the target page.
            // Inspect the target page's callback, submission flow, and acceptance signals before adapting it.
            // STEP-03: Sending the task to Captcha Solver.
            console.log('3. Sending the task to Captcha Solver', task.toDict());
            return Promise.resolve(solver.solve(task)).then(function (solution) {
              // STEP-04: Solution received.
              console.log('4. Solution received', solution);
              if (!solution.gRecaptchaResponse)
                throw new Error('Captcha Solver returned an empty token.');
              const callbackName = process.env.CALLBACK_NAME || 'verifyRecaptcha';
              // STEP-05: Passing the token to ${callbackName}.
              console.log(`5. Passing the token to ${callbackName}`);
              return Promise.resolve(
                page.evaluate(
                  (name, token) => {
                    const callback = name.split('.').reduce((value, key) => value?.[key], window);
                    if (typeof callback !== 'function')
                      throw new Error(`Callback ${name} was not found.`);
                    callback(token);
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
          });
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
