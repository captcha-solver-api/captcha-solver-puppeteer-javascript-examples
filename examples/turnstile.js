import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

/**
 * This example solves an embedded Cloudflare Turnstile widget without a proxy. It extracts the widget parameters and browser User-Agent, creates Tasks.TurnstileProxyless, and calls CaptchaClient.solve(). It writes the returned token to the response field, submits the form, and requires a page-specific success element.
 *
 * To use this example on another page, change the target URL and verify the widget selector, response field, submission control, and success indicator. Token injection and acceptance are site-specific.
 *
 * How it works:
 * STEP-01 - Opening the Turnstile page.
 * STEP-02 - Reading Turnstile widget parameters.
 * STEP-03 - Sending the task to Captcha Solver.
 * STEP-04 - Solution received.
 * STEP-05 - Writing the token into cf-turnstile-response.
 * STEP-06 - Submitting and waiting for page acceptance.
 */

/** Run the complete standalone Turnstile example. */

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
/** Solve Turnstile on an already opened page. */
export const solveCaptcha = function (page, solver) {
  try {
    if (!process.env.TARGET_URL) throw new Error('Set TARGET_URL for this example.');
    // STEP-01: Opening the Turnstile page.
    console.log('1. Opening the Turnstile page');
    return Promise.resolve(
      page.goto(process.env.TARGET_URL, {
        waitUntil: 'domcontentloaded',
      }),
    ).then(function () {
      return Promise.resolve(page.waitForSelector('.cf-turnstile[data-sitekey]')).then(function () {
        // Token injection and submission are site-specific; adapt this step to the target page.
        // Inspect the target page's fields, submission flow, and acceptance signals before adapting it.
        // STEP-02: Reading Turnstile widget parameters.
        console.log('2. Reading Turnstile widget parameters');
        return Promise.resolve(
          page.$eval('.cf-turnstile[data-sitekey]', (widget) => ({
            websiteKey: widget.dataset.sitekey,
            action: widget.dataset.action,
            data: widget.dataset.cdata,
          })),
        ).then(function (captcha) {
          const _page$url = page.url();
          return Promise.resolve(page.evaluate(() => navigator.userAgent)).then(
            function (_page$evaluate) {
              const task = new Tasks.TurnstileProxyless({
                websiteURL: _page$url,
                ...captcha,
                userAgent: _page$evaluate,
              });
              // STEP-03: Sending the task to Captcha Solver.
              console.log('3. Sending the task to Captcha Solver', task.toDict());
              return Promise.resolve(solver.solve(task)).then(function (solution) {
                // STEP-04: Solution received.
                console.log('4. Solution received', solution);
                if (!solution.token) throw new Error('Captcha Solver returned an empty token.');
                // STEP-05: Writing the token into cf-turnstile-response.
                console.log('5. Writing the token into cf-turnstile-response');
                return Promise.resolve(
                  page.evaluate((token) => {
                    const fields = document.getElementsByName('cf-turnstile-response');
                    if (!fields.length)
                      throw new Error('cf-turnstile-response field was not found.');
                    for (const field of fields) {
                      field.value = token;
                      field.dispatchEvent(
                        new Event('input', {
                          bubbles: true,
                        }),
                      );
                      field.dispatchEvent(
                        new Event('change', {
                          bubbles: true,
                        }),
                      );
                    }
                  }, solution.token),
                ).then(function () {
                  // STEP-06: Submitting and waiting for page acceptance.
                  console.log('6. Submitting and waiting for page acceptance');
                  return Promise.resolve(
                    page.click(
                      process.env.SUBMIT_SELECTOR || 'button[type="submit"], input[type="submit"]',
                    ),
                  ).then(function () {
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
