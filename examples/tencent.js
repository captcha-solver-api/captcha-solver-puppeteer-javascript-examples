import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

/**
 * This example solves Tencent CAPTCHA without a proxy. It intercepts the TencentCaptcha constructor before navigation, captures the app ID, script URL, and original callback, creates Tasks.TencentTaskProxyless, and calls CaptchaClient.solve(). It passes the returned multi-field solution to the callback and separately requires a configured page success element.
 *
 * To use this example on another page, change the target URL, trigger, and success selector and verify the constructor signature and script URL. Callback delivery proves delivery only, not server-side acceptance.
 *
 * How it works:
 * STEP-01 - Installing the TencentCaptcha interceptor.
 * STEP-02 - Opening the Tencent CAPTCHA page.
 * STEP-03 - Opening the CAPTCHA widget.
 * STEP-04 - Captured Tencent parameters.
 * STEP-05 - Sending the task to Captcha Solver.
 * STEP-06 - Solution received.
 * STEP-07 - Passing the solution to the original Tencent callback.
 * STEP-08 - Waiting for page acceptance.
 */

/** Run the complete standalone Tencent CAPTCHA example. */

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
/** Solve Tencent CAPTCHA on an already opened page. */
export const solveCaptcha = function (page, solver) {
  try {
    if (!process.env.TARGET_URL) throw new Error('Set TARGET_URL for this example.');
    if (!process.env.TENCENT_SUCCESS_SELECTOR) throw new Error('Set TENCENT_SUCCESS_SELECTOR.');
    // STEP-01: Installing the TencentCaptcha interceptor.
    console.log('1. Installing the TencentCaptcha interceptor');
    return Promise.resolve(installInterceptor(page)).then(function () {
      // STEP-02: Opening the Tencent CAPTCHA page.
      console.log('2. Opening the Tencent CAPTCHA page');
      return Promise.resolve(
        page.goto(process.env.TARGET_URL, {
          waitUntil: 'domcontentloaded',
        }),
      ).then(function () {
        /** Wait for captured constructor parameters, solve the task, and invoke its callback. */
        function _temp2() {
          return Promise.resolve(
            page.waitForFunction(() => window.__captchaSolverTencent.pending()[0] || false),
          ).then(function (handle) {
            return Promise.resolve(handle.jsonValue()).then(function (captured) {
              return Promise.resolve(handle.dispose()).then(function () {
                const { id, ...taskParameters } = captured;
                // Solution submission is site-specific; adapt this step to the target page.
                // Inspect the target page's callback, submission flow, and acceptance signals before adapting it.
                // STEP-04: Captured Tencent parameters.
                console.log('4. Captured Tencent parameters', taskParameters);
                const task = new Tasks.TencentTaskProxyless(taskParameters);
                // STEP-05: Sending the task to Captcha Solver.
                console.log('5. Sending the task to Captcha Solver');
                return Promise.resolve(solver.solve(task)).then(function (solution) {
                  // STEP-06: Solution received.
                  console.log('6. Solution received', solution);
                  // STEP-07: Passing the solution to the original Tencent callback.
                  console.log('7. Passing the solution to the original Tencent callback');
                  return Promise.resolve(
                    page.evaluate(
                      (recordId, answer) => {
                        window.__captchaSolverTencent.submit(recordId, answer);
                      },
                      id,
                      solution,
                    ),
                  ).then(function () {
                    // STEP-08: Waiting for page acceptance.
                    return Promise.resolve(
                      page.waitForSelector(process.env.TENCENT_SUCCESS_SELECTOR, {
                        visible: true,
                      }),
                    ).then(function () {
                      return page.$eval(process.env.TENCENT_SUCCESS_SELECTOR, (element) =>
                        element.textContent.trim(),
                      );
                    });
                  });
                });
              });
            });
          });
        }
        const _temp = (function () {
          if (process.env.TENCENT_TRIGGER_SELECTOR) {
            // STEP-03: Opening the CAPTCHA widget.
            console.log('3. Opening the CAPTCHA widget');
            return Promise.resolve(page.click(process.env.TENCENT_TRIGGER_SELECTOR)).then(
              function () {},
            );
          }
        })();
        return _temp && _temp.then ? _temp.then(_temp2) : _temp2(_temp);
      });
    });
  } catch (e) {
    return Promise.reject(e);
  }
};
/** Install the TencentCaptcha constructor interceptor before navigation. */
const installInterceptor = function (page) {
  try {
    return Promise.resolve(
      page.evaluateOnNewDocument(() => {
        const records = new Map();
        let originalConstructor;
        let nextId = 0;
        Object.defineProperty(window, '__captchaSolverTencent', {
          value: {
            pending: () =>
              [...records.values()]
                .filter((record) => !record.submitted)
                .map((record) => record.params),
            submit(id, solution) {
              const record = records.get(id);
              if (!record || record.submitted) throw new Error('Tencent callback was not found.');
              record.submitted = true;
              record.callback(solution);
            },
          },
        });
        Object.defineProperty(window, 'TencentCaptcha', {
          configurable: true,
          get: () => originalConstructor,
          set: (Constructor) => {
            originalConstructor = new Proxy(Constructor, {
              construct(Target, args, newTarget) {
                const offset = typeof args[1] === 'function' ? 0 : 1;
                const appId = args[offset];
                const callback = args[offset + 1];
                const id = `tencent-${++nextId}`;
                const params = {
                  id,
                  websiteURL: location.href,
                  appId: String(appId),
                  captchaScript:
                    document.currentScript?.src ||
                    [...document.scripts]
                      .map((script) => script.src)
                      .find((src) => /\/TCaptcha-global\.js(?:\?|$)/i.test(src)),
                };
                const nativeArgs = [...args];
                nativeArgs[offset + 1] = () => {};
                const instance = Reflect.construct(Target, nativeArgs, newTarget);
                instance.show = () => {};
                records.set(id, {
                  params,
                  callback,
                  submitted: false,
                });
                return instance;
              },
            });
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
