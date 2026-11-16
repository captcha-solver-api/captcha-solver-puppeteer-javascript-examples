import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

/**
 * This example solves callback-based reCAPTCHA v2 through the same proxy in Puppeteer and the solver task. It extracts the widget and callback parameters, creates Tasks.RecaptchaV2 with named proxy settings, and calls CaptchaClient.solve(). It invokes the page callback with gRecaptchaResponse and separately requires a page-specific success element.
 *
 * To use this example on another page, change the target URL, proxy configuration, callback selector, and acceptance signal. Callback delivery alone does not prove server-side acceptance.
 *
 * How it works:
 * STEP-01 - Opening the page through the configured proxy.
 * STEP-02 - Reading CAPTCHA parameters and callback name.
 * STEP-03 - Sending the task to Captcha Solver.
 * STEP-04 - Solution received.
 * STEP-05 - Calling ${captcha.callbackName}.
 * STEP-06 - Waiting for page acceptance.
 */

/** Run the complete standalone proxy callback example. */

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
              if (proxy.proxyLogin)
                return Promise.resolve(
                  page.authenticate({
                    username: proxy.proxyLogin,
                    password: proxy.proxyPassword,
                  }),
                ).then(function () {});
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
/** Solve reCAPTCHA and invoke its named callback. */
export const solveCaptcha = function (page, solver, proxy) {
  try {
    if (!process.env.TARGET_URL) throw new Error('Set TARGET_URL for this example.');
    // STEP-01: Opening the page through the configured proxy.
    console.log('1. Opening the page through the configured proxy');
    return Promise.resolve(
      page.goto(process.env.TARGET_URL, {
        waitUntil: 'domcontentloaded',
      }),
    ).then(function () {
      return Promise.resolve(page.waitForSelector('[data-sitekey][data-callback]')).then(
        function () {
          // STEP-02: Reading CAPTCHA parameters and callback name.
          console.log('2. Reading CAPTCHA parameters and callback name');
          return Promise.resolve(
            page.$eval('[data-sitekey][data-callback]', (element) => ({
              websiteKey: element.dataset.sitekey,
              callbackName: element.dataset.callback,
              isInvisible: element.dataset.size === 'invisible',
            })),
          ).then(function (captcha) {
            const _captcha$isInvisible = captcha.isInvisible,
              _captcha$websiteKey = captcha.websiteKey,
              _page$url = page.url();
            return Promise.resolve(page.evaluate(() => navigator.userAgent)).then(
              function (_page$evaluate) {
                const task = new Tasks.RecaptchaV2({
                  websiteURL: _page$url,
                  websiteKey: _captcha$websiteKey,
                  isInvisible: _captcha$isInvisible,
                  userAgent: _page$evaluate,
                  ...proxy,
                });
                // STEP-03: Sending the task to Captcha Solver.
                console.log('3. Sending the task to Captcha Solver');
                return Promise.resolve(solver.solve(task)).then(function (solution) {
                  // STEP-04: Solution received.
                  console.log('4. Solution received', solution);
                  if (!solution.gRecaptchaResponse)
                    throw new Error('Captcha Solver returned an empty token.');
                  // Token injection and submission are site-specific; adapt this step to the target page.
                  // Inspect the target page's callback, submission flow, and acceptance signals before adapting it.
                  // STEP-05: Calling ${captcha.callbackName}.
                  console.log(`5. Calling ${captcha.callbackName}`);
                  return Promise.resolve(
                    page.evaluate(
                      (name, token) => {
                        const callback = name
                          .split('.')
                          .reduce((value, key) => value?.[key], window);
                        if (typeof callback !== 'function')
                          throw new Error(`Callback ${name} was not found.`);
                        callback(token);
                      },
                      captcha.callbackName,
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
        },
      );
    });
  } catch (e) {
    return Promise.reject(e);
  }
};
puppeteer.use(StealthPlugin());

/** Read proxy settings from environment variables. */
function getProxy() {
  const proxyAddress = process.env.PROXY_ADDRESS;
  const proxyPort = Number(process.env.PROXY_PORT);
  if (!proxyAddress || !Number.isInteger(proxyPort))
    throw new Error('Set PROXY_ADDRESS and PROXY_PORT.');
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
