import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

/**
 * This example solves a coordinate CAPTCHA without a proxy. It reads the original image through a canvas, creates Tasks.CoordinatesTask, and calls CaptchaClient.solve(). It logs the returned coordinates, converts them from source-image coordinates to displayed browser coordinates, clicks the image, submits the form, and requires a page-specific success element.
 *
 * To use this example on another page, change the target URL and selectors. If the displayed image is scaled or offset, preserve the coordinate conversion before clicking and verify the target page's actual acceptance signal.
 *
 * How it works:
 * STEP-01 - Opening the page.
 * STEP-02 - Reading the original image pixels and dimensions.
 * STEP-03 - Sending Coordinates task.
 * STEP-04 - Coordinates received.
 * STEP-05 - Scaling and clicking the returned coordinates.
 * STEP-06 - Submitting and waiting for page acceptance.
 */

/** Run the complete standalone coordinate example. */

const _iteratorSymbol =
  /*#__PURE__*/ typeof Symbol !== 'undefined'
    ? Symbol.iterator || (Symbol.iterator = Symbol('Symbol.iterator'))
    : '@@iterator';
/** Settle the lightweight Promise used while iterating over asynchronous click operations. */
function _settle(pact, state, value) {
  if (!pact.s) {
    if (value instanceof _Pact) {
      if (value.s) {
        if (state & 1) {
          state = value.s;
        }
        value = value.v;
      } else {
        value.o = _settle.bind(null, pact, state);
        return;
      }
    }
    if (value && value.then) {
      value.then(_settle.bind(null, pact, state), _settle.bind(null, pact, 2));
      return;
    }
    pact.s = state;
    pact.v = value;
    const observer = pact.o;
    if (observer) {
      observer(pact);
    }
  }
}
const _Pact = /*#__PURE__*/ (function () {
  /** Create a lightweight thenable for the generated iteration flow. */
  function _Pact() {}
  _Pact.prototype.then = function (onFulfilled, onRejected) {
    const result = new _Pact();
    const state = this.s;
    if (state) {
      const callback = state & 1 ? onFulfilled : onRejected;
      if (callback) {
        try {
          _settle(result, 1, callback(this.v));
        } catch (e) {
          _settle(result, 2, e);
        }
        return result;
      } else {
        return this;
      }
    }
    this.o = function (_this) {
      try {
        const value = _this.v;
        if (_this.s & 1) {
          _settle(result, 1, onFulfilled ? onFulfilled(value) : value);
        } else if (onRejected) {
          _settle(result, 1, onRejected(value));
        } else {
          _settle(result, 2, value);
        }
      } catch (e) {
        _settle(result, 2, e);
      }
    };
    return result;
  };
  return _Pact;
})();
/** Return whether a lightweight iteration Promise has already fulfilled. */
function _isSettledPact(thenable) {
  return thenable instanceof _Pact && thenable.s & 1;
}
/** Iterate over array indexes while preserving asynchronous results. */
function _forTo(array, body, check) {
  var i = -1,
    pact,
    reject;
  /** Continue the indexed loop after the previous asynchronous operation settles. */
  function _cycle(result) {
    try {
      while (++i < array.length && (!check || !check())) {
        result = body(i);
        if (result && result.then) {
          if (_isSettledPact(result)) {
            result = result.v;
          } else {
            result.then(_cycle, reject || (reject = _settle.bind(null, (pact = new _Pact()), 2)));
            return;
          }
        }
      }
      if (pact) {
        _settle(pact, 1, result);
      } else {
        pact = result;
      }
    } catch (e) {
      _settle(pact || (pact = new _Pact()), 2, e);
    }
  }
  _cycle();
  return pact;
}
/** Iterate over values while preserving asynchronous results and iterator cleanup. */
function _forOf(target, body, check) {
  if (typeof target[_iteratorSymbol] === 'function') {
    var iterator = target[_iteratorSymbol](),
      step,
      pact,
      reject;
    /** Continue the iterator after the previous asynchronous operation settles. */
    function _cycle(result) {
      try {
        while (!(step = iterator.next()).done && (!check || !check())) {
          result = body(step.value);
          if (result && result.then) {
            if (_isSettledPact(result)) {
              result = result.v;
            } else {
              result.then(_cycle, reject || (reject = _settle.bind(null, (pact = new _Pact()), 2)));
              return;
            }
          }
        }
        if (pact) {
          _settle(pact, 1, result);
        } else {
          pact = result;
        }
      } catch (e) {
        _settle(pact || (pact = new _Pact()), 2, e);
      }
    }
    _cycle();
    if (iterator.return) {
      var _fixup = function (value) {
        try {
          if (!step.done) {
            iterator.return();
          }
        } catch {
          // Ignore iterator cleanup errors while preserving the original rejection.
        }
        return value;
      };
      if (pact && pact.then) {
        return pact.then(_fixup, function (e) {
          throw _fixup(e);
        });
      }
      _fixup();
    }
    return pact;
  }
  // No support for Symbol.iterator
  if (!('length' in target)) {
    throw new TypeError('Object is not iterable');
  }
  // Handle live collections properly
  var values = [];
  for (var i = 0; i < target.length; i++) {
    values.push(target[i]);
  }
  return _forTo(
    values,
    function (i) {
      return body(values[i]);
    },
    check,
  );
}
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
/** Solve the coordinate CAPTCHA on an already opened page. */
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
      ).then(function (imageElement) {
        // STEP-02: Reading the original image pixels and dimensions.
        console.log('2. Reading the original image pixels and dimensions');
        return Promise.resolve(
          page.$eval(IMAGE_SELECTOR, (element) => {
            const canvas = document.createElement('canvas');
            canvas.width = element.naturalWidth;
            canvas.height = element.naturalHeight;
            canvas.getContext('2d').drawImage(element, 0, 0);
            return {
              body: canvas.toDataURL('image/png').split(',')[1],
              width: canvas.width,
              height: canvas.height,
            };
          }),
        ).then(function (image) {
          const task = new Tasks.CoordinatesTask({
            body: image.body,
          });
          // STEP-03: Sending Coordinates task.
          console.log('3. Sending Coordinates task', {
            ...task.toDict(),
            body: `[${image.body.length} base64 characters]`,
          });
          return Promise.resolve(solver.solve(task)).then(function (solution) {
            // STEP-04: Coordinates received.
            console.log('4. Coordinates received', solution.coordinates);
            if (!solution.coordinates?.length)
              throw new Error('Captcha Solver returned no coordinates.');
            return Promise.resolve(imageElement.scrollIntoView()).then(function () {
              return Promise.resolve(imageElement.boundingBox()).then(function (box) {
                /** Submit the clicked coordinates and read the page acceptance message. */
                function _temp2() {
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
                }
                if (!box) throw new Error('The CAPTCHA image is not visible.');
                // STEP-05: Scaling and clicking the returned coordinates.
                console.log('5. Scaling and clicking the returned coordinates');
                const _temp = _forOf(solution.coordinates, function (point) {
                  const x = box.x + (point.x * box.width) / image.width;
                  const y = box.y + (point.y * box.height) / image.height;
                  return Promise.resolve(page.mouse.click(x, y)).then(function () {});
                });
                return _temp && _temp.then ? _temp.then(_temp2) : _temp2(_temp);
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
const IMAGE_SELECTOR = 'img[alt="clickcaptcha example"]';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('Example failed:', error.message);
    process.exitCode = 1;
  });
}
