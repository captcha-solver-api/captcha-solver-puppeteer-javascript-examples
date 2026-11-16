import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { demos } from '../config/demos.js';

/**
 * This example solves reCAPTCHA v2 through the same proxy in Puppeteer and the solver task. It extracts the widget parameters and browser User-Agent, creates Tasks.RecaptchaV2 with named proxy settings, and calls CaptchaClient.solve(). It injects the returned gRecaptchaResponse, submits the form, and requires a page-specific success element.
 *
 * To use this example on another page, change the target URL, proxy configuration, selectors, and acceptance signal. Token injection and submission are site-specific.
 *
 * How it works:
 * STEP-01 - Opening the page through the configured proxy.
 * STEP-02 - Reading reCAPTCHA parameters.
 * STEP-03 - Sending RecaptchaV2 task.
 * STEP-04 - Solution received.
 * STEP-05 - Writing the token and submitting the form.
 * STEP-06 - Waiting for page acceptance.
 */

/** Run the complete standalone proxy example. */

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
    const proxy = getProxy();
    const solver = new CaptchaClient({
      clientKey: process.env.CAPTCHA_API_KEY || 'YOUR_API_KEY',
    });
    return Promise.resolve(
      puppeteer.launch({
        headless: process.env.HEADLESS === 'true',
        executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
        args: [`--proxy-server=${proxy.proxyType}://${proxy.proxyAddress}:${proxy.proxyPort}`],
      }),
    ).then(function (browser) {
      const _temp3 = _finallyRethrows(
        function () {
          return Promise.resolve(browser.newPage()).then(function (page) {
            /** Authenticate the browser proxy when credentials were configured, then solve. */
            function _temp2() {
              return Promise.resolve(solveCaptcha(page, solver, proxy)).then(
                function (_solveCaptcha) {
                  console.log('Page confirmation:', _solveCaptcha);
                },
              );
            }
            const _temp = (function () {
              if (proxy.proxyLogin) {
                return Promise.resolve(
                  page.authenticate({
                    username: proxy.proxyLogin,
                    password: proxy.proxyPassword,
                  }),
                ).then(function () {});
              }
            })();
            return _temp && _temp.then ? _temp.then(_temp2) : _temp2(_temp);
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
/** Solve and submit proxy-based reCAPTCHA v2 on an opened page. */
export const solveCaptcha = function (page, solver, proxy) {
  try {
    // STEP-01: Opening the page through the configured proxy.
    console.log('1. Opening the page through the configured proxy');
    return Promise.resolve(
      page.goto(process.env.TARGET_URL || DEFAULT_URL, {
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
            recaptchaDataSValue: element.getAttribute('data-s') || undefined,
          })),
        ).then(function (captcha) {
          const _page$url = page.url();
          return Promise.resolve(page.evaluate(() => navigator.userAgent)).then(
            function (_page$evaluate) {
              const task = new Tasks.RecaptchaV2({
                websiteURL: _page$url,
                ...captcha,
                ...proxy,
                userAgent: _page$evaluate,
              });
              // STEP-03: Sending RecaptchaV2 task.
              console.log('3. Sending RecaptchaV2 task');
              return Promise.resolve(solver.solve(task)).then(function (solution) {
                // STEP-04: Solution received.
                console.log('4. Solution received', solution);
                if (!solution.gRecaptchaResponse)
                  throw new Error('Captcha Solver returned an empty token.');
                // Token injection and submission are site-specific; adapt this step to the target page.
                // Inspect the target page's fields, submission flow, and acceptance signals before adapting it.
                // STEP-05: Writing the token and submitting the form.
                console.log('5. Writing the token and submitting the form');
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
                      new Event('change', {
                        bubbles: true,
                      }),
                    );
                  }, solution.gRecaptchaResponse),
                ).then(function () {
                  return Promise.resolve(
                    page.click(
                      process.env.SUBMIT_SELECTOR || 'button[type="submit"], input[type="submit"]',
                    ),
                  ).then(function () {
                    // STEP-06: Waiting for page acceptance.
                    console.log('6. Waiting for page acceptance');
                    const selector =
                      process.env.SUCCESS_SELECTOR ||
                      '.recaptcha-success, p[class*="successMessage"]';
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

/** Read proxy settings from environment variables. */
function getProxy() {
  const proxyAddress = process.env.PROXY_ADDRESS;
  const proxyPort = Number(process.env.PROXY_PORT);
  if (!proxyAddress || !Number.isInteger(proxyPort)) {
    throw new Error('Set PROXY_ADDRESS and PROXY_PORT.');
  }
  return {
    proxyType: process.env.PROXY_TYPE || 'http',
    proxyAddress,
    proxyPort,
    proxyLogin: process.env.PROXY_LOGIN || undefined,
    proxyPassword: process.env.PROXY_PASSWORD || undefined,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('Example failed:', error.message);
    process.exitCode = 1;
  });
}
