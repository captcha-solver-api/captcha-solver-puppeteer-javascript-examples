import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { demos } from '../config/demos.js';

/**
 * This example solves reCAPTCHA v2 without a proxy. It extracts the site key, visibility mode, optional data-s value, and browser User-Agent, creates Tasks.RecaptchaV2Proxyless, and calls CaptchaClient.solve(). It logs and injects the returned gRecaptchaResponse, submits the form, and requires the page's success element.
 *
 * To use this example on another page, change the target URL and verify the site key and optional payload. Token fields, callbacks, submission, and success indicators are site-specific.
 *
 * How it works:
 * STEP-01 - Opening the page.
 * STEP-02 - Reading reCAPTCHA parameters from the page.
 * STEP-03 - Sending the task to Captcha Solver.
 * STEP-04 - Solution received.
 * STEP-05 - Writing the token into g-recaptcha-response.
 * STEP-06 - Submitting the form.
 * STEP-07 - Waiting for the page to accept the solution.
 */

/** Run the complete standalone example. */

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
    console.log('Creating Captcha Solver client from CAPTCHA_API_KEY');
    const solver = new CaptchaClient({
      clientKey: process.env.CAPTCHA_API_KEY || 'YOUR_API_KEY',
    });
    return Promise.resolve(
      puppeteer.launch({
        headless: process.env.HEADLESS === 'true',
        executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
        defaultViewport: {
          width: 1280,
          height: 900,
        },
      }),
    ).then(function (browser) {
      const _temp = _finallyRethrows(
        function () {
          return Promise.resolve(browser.newPage()).then(function (page) {
            return Promise.resolve(solveCaptcha(page, solver)).then(function (result) {
              console.log('Page confirmation:', result);
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
/**
 * Solve and submit reCAPTCHA v2 on an already opened page.
 * @param {import('puppeteer').Page} page Open Puppeteer page.
 * @param {CaptchaClient} solver Configured Captcha Solver client.
 * @returns {Promise<string>} Text displayed after successful submission.
 */
export const solveCaptcha = function (page, solver) {
  try {
    // STEP-01: Opening the page.
    console.log('1. Opening the page');
    return Promise.resolve(
      page.goto(process.env.TARGET_URL || DEFAULT_URL, {
        waitUntil: 'domcontentloaded',
      }),
    ).then(function () {
      return Promise.resolve(page.waitForSelector('[data-sitekey]')).then(function () {
        // Token injection and submission are site-specific; adapt this step to the target page.
        // Inspect the target page's fields, submission flow, and acceptance signals before adapting it.
        // STEP-02: Reading reCAPTCHA parameters from the page.
        console.log('2. Reading reCAPTCHA parameters from the page');
        return Promise.resolve(
          page.$eval('[data-sitekey]', (element) => ({
            websiteKey: element.getAttribute('data-sitekey'),
            isInvisible: element.getAttribute('data-size') === 'invisible',
            recaptchaDataSValue: element.getAttribute('data-s') || undefined,
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
                if (!solution.gRecaptchaResponse) {
                  throw new Error('Captcha Solver returned an empty reCAPTCHA token.');
                }
                // STEP-05: Writing the token into g-recaptcha-response.
                console.log('5. Writing the token into g-recaptcha-response');
                return Promise.resolve(
                  page.evaluate((token) => {
                    let response = document.querySelector('[name="g-recaptcha-response"]');
                    if (!response) {
                      response = document.createElement('textarea');
                      response.name = 'g-recaptcha-response';
                      document.querySelector('form')?.append(response);
                    }
                    response.value = token;
                    response.dispatchEvent(
                      new Event('input', {
                        bubbles: true,
                      }),
                    );
                    response.dispatchEvent(
                      new Event('change', {
                        bubbles: true,
                      }),
                    );
                  }, solution.gRecaptchaResponse),
                ).then(function () {
                  // STEP-06: Submitting the form.
                  console.log('6. Submitting the form');
                  return Promise.resolve(
                    page.click(
                      process.env.SUBMIT_SELECTOR || 'button[type="submit"], input[type="submit"]',
                    ),
                  ).then(function () {
                    // STEP-07: Waiting for the page to accept the solution.
                    console.log('7. Waiting for the page to accept the solution');
                    const successSelector =
                      process.env.SUCCESS_SELECTOR ||
                      '.recaptcha-success, p[class*="successMessage"]';
                    return Promise.resolve(
                      page.waitForSelector(successSelector, {
                        visible: true,
                      }),
                    ).then(function () {
                      return page.$eval(successSelector, (element) => element.textContent.trim());
                    });
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
const DEFAULT_URL = demos.recaptchaV2;
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('Example failed:', error.message);
    process.exitCode = 1;
  });
}
