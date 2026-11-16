import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

/**
 * This example solves an image-to-text CAPTCHA without a proxy. It reads the original image pixels through a browser canvas, creates Tasks.ImageToText, and calls CaptchaClient.solve(). It logs the recognized text, types it into the form, submits the answer, and requires a page-specific success element.
 *
 * To use this example on another page, change the target URL and selectors, confirm that canvas access is not blocked by CORS, and adapt the submission and acceptance checks to that page.
 *
 * How it works:
 * STEP-01 - Opening the page.
 * STEP-02 - Reading the original image pixels through canvas.
 * STEP-03 - Sending ImageToText task.
 * STEP-04 - Recognized text.
 * STEP-05 - Typing the answer and submitting the form.
 * STEP-06 - Waiting for page acceptance.
 */

/** Run the complete standalone canvas example. */

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
/** Solve the image CAPTCHA on an already opened page. */
export const solveCaptcha = function (page, solver) {
  try {
    if (!process.env.TARGET_URL) throw new Error('Set TARGET_URL for this example.');
    // STEP-01: Opening the page.
    console.log('1. Opening the page');
    return Promise.resolve(
      page.goto(process.env.TARGET_URL, {
        waitUntil: 'domcontentloaded',
      }),
    ).then(function () {
      return Promise.resolve(
        page.waitForSelector(IMAGE_SELECTOR, {
          visible: true,
        }),
      ).then(function () {
        // STEP-02: Reading the original image pixels through canvas.
        console.log('2. Reading the original image pixels through canvas');
        return Promise.resolve(
          page.$eval(IMAGE_SELECTOR, (image) => {
            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            canvas.getContext('2d').drawImage(image, 0, 0);
            return canvas.toDataURL('image/png').split(',')[1];
          }),
        ).then(function (body) {
          const task = new Tasks.ImageToText({
            body,
          });
          // STEP-03: Sending ImageToText task.
          console.log('3. Sending ImageToText task', {
            ...task.toDict(),
            body: `[${body.length} base64 characters]`,
          });
          return Promise.resolve(solver.solve(task)).then(function (solution) {
            // STEP-04: Recognized text.
            console.log('4. Recognized text:', solution.text);
            if (!solution.text) throw new Error('Captcha Solver returned empty text.');
            // Answer entry and submission are site-specific; adapt this step to the target page.
            // Inspect the target page's answer field, submission flow, and acceptance signals before adapting it.
            // STEP-05: Typing the answer and submitting the form.
            console.log('5. Typing the answer and submitting the form');
            return Promise.resolve(page.locator(ANSWER_SELECTOR).fill(solution.text)).then(
              function () {
                return Promise.resolve(
                  page.click(
                    process.env.SUBMIT_SELECTOR || 'button[type="submit"], input[type="submit"]',
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
              },
            );
          });
        });
      });
    });
  } catch (e) {
    return Promise.reject(e);
  }
};
puppeteer.use(StealthPlugin());
const IMAGE_SELECTOR = 'img[alt="normal captcha example"]';
const ANSWER_SELECTOR = '#simple-captcha-field';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('Example failed:', error.message);
    process.exitCode = 1;
  });
}
