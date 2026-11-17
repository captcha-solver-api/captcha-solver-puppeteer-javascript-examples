import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

/**
 * This example shows how to solve Tencent CAPTCHA without using a proxy. It intercepts the
 * TencentCaptcha constructor, captures the app ID, script URL, and callback, sends the task to the
 * service, passes the returned solution to the original callback, and confirms callback delivery.
 * It uses Tasks.TencentTaskProxyless and CaptchaClient.solve().
 *
 * To use this example on another page, change the target URL and optional script URL, then verify
 * its constructor signature and callback. Callback delivery is site-specific and does not prove
 * server-side acceptance, so add a separate page-specific acceptance check when one is available.
 *
 * How it works:
 * STEP-01 - Configure the target and create the SDK client.
 * STEP-02 - Launch Chromium and install the constructor interceptor.
 * STEP-03 - Open the target and wait for the CAPTCHA widget.
 * STEP-04 - Capture the Tencent task parameters.
 * STEP-05 - Create the task and wait for the solver result.
 * STEP-06 - Log the solution and pass it to the original callback.
 * STEP-07 - Confirm that the callback receives the solution.
 * STEP-08 - Handle errors and close Chromium.
 */

puppeteer.use(StealthPlugin());

// STEP-01: Read the target settings and create the SDK client.
const websiteURL =
  process.env.TENCENT_TARGET_URL || 'https://example.com/page_with_tencent_captcha';
const client = new CaptchaClient({
  clientKey: process.env.CAPTCHA_API_KEY || 'YOUR_API_KEY',
});

let browser;

/** Install the TencentCaptcha constructor interceptor before navigation. */
function installInterceptor(page) {
  return page.evaluateOnNewDocument(() => {
    const records = new Map();
    let originalConstructor;
    let nextRecordId = 0;

    Object.defineProperty(window, '__captchaSolverTencent', {
      value: {
        pending: () =>
          [...records.values()]
            .filter((record) => !record.submitted)
            .map((record) => record.params),
        submit(recordId, solution) {
          const record = records.get(recordId);
          if (!record || record.submitted) throw new Error('Tencent callback was not found.');
          record.submitted = true;
          record.callback(solution);
          record.receivedSolution = solution;
        },
        received(recordId, solution) {
          const receivedSolution = records.get(recordId)?.receivedSolution;
          return (
            receivedSolution?.ticket === solution.ticket &&
            receivedSolution?.randstr === solution.randstr
          );
        },
      },
    });

    Object.defineProperty(window, 'TencentCaptcha', {
      configurable: true,
      get: () => originalConstructor,
      set: (Constructor) => {
        originalConstructor = new Proxy(Constructor, {
          construct(Target, constructorArguments, newTarget) {
            const [firstArgument, secondArgument, thirdArgument] = constructorArguments;
            const hasContainerArgument = typeof secondArgument !== 'function';
            const appId = hasContainerArgument ? secondArgument : firstArgument;
            const callback = hasContainerArgument ? thirdArgument : secondArgument;
            const callbackArgumentIndex = hasContainerArgument ? 2 : 1;
            const recordId = `tencent-${++nextRecordId}`;
            const params = {
              recordId,
              websiteURL: location.href,
              appId: String(appId),
              captchaScript:
                document.currentScript?.src ||
                [...document.scripts]
                  .map((script) => script.src)
                  .find((source) => /\/TCaptcha-global\.js(?:\?|$)/i.test(source)),
            };

            const nativeArguments = [...constructorArguments];
            nativeArguments[callbackArgumentIndex] = () => {};
            const instance = Reflect.construct(Target, nativeArguments, newTarget);
            instance.show = () => {};
            records.set(recordId, {
              params,
              callback,
              submitted: false,
              receivedSolution: null,
            });
            return instance;
          },
        });
      },
    });
  });
}

/**
 * Solve Tencent CAPTCHA on an opened Puppeteer page.
 * @param {import('puppeteer').Page} page Open Puppeteer page.
 * @param {CaptchaClient} solver Configured Captcha Solver client.
 * @returns {Promise<string>} Message confirming delivery to the page callback.
 */
export function solveCaptcha(page, solver = client) {
  // STEP-02: Install the interceptor before the target defines TencentCaptcha.
  return (
    installInterceptor(page)
      // STEP-03: Open the target; this flow expects the page to create its CAPTCHA widget.
      .then(() =>
        page.goto(process.env.TENCENT_TARGET_URL || websiteURL, { waitUntil: 'domcontentloaded' }),
      )
      // STEP-04: Wait for the constructor parameters captured from a fresh widget instance.
      .then(() =>
        page.waitForFunction(() => window.__captchaSolverTencent.pending().at(0) || false),
      )
      .then((handle) =>
        handle.jsonValue().finally(() => {
          return handle.dispose();
        }),
      )
      // STEP-05: Build the task and wait for the solver result.
      .then(({ recordId, ...taskParameters }) => {
        if (process.env.TENCENT_SCRIPT_URL) {
          taskParameters.captchaScript = process.env.TENCENT_SCRIPT_URL;
        }
        if (!taskParameters.appId) throw new Error('Tencent app ID was not captured.');
        if (!taskParameters.captchaScript) throw new Error('Tencent script URL was not captured.');

        return solver
          .solve(new Tasks.TencentTaskProxyless(taskParameters))
          .then((solution) => ({ recordId, solution }));
      })
      // STEP-06: Log the solution and pass it to the exact callback registered by the page.
      .then(({ recordId, solution }) => {
        console.log('Solution:', solution);

        // Solution submission is site-specific; adapt this step to the target page.
        // Pass every returned Tencent field through the original page callback.
        return page
          .evaluate(
            (capturedRecordId, answer) => {
              window.__captchaSolverTencent.submit(capturedRecordId, answer);
            },
            recordId,
            solution,
          )
          .then(() => ({ recordId, solution }));
      })
      // STEP-07: Confirm delivery of the same ticket and random string to the page callback.
      .then(({ recordId, solution }) =>
        page.waitForFunction(
          (capturedRecordId, answer) =>
            window.__captchaSolverTencent.received(capturedRecordId, answer),
          {},
          recordId,
          solution,
        ),
      )
      .then(() => 'Tencent callback received the solution.')
  );
}

/** Run the complete standalone Tencent CAPTCHA example. */
export function main() {
  // Launch Chromium and create a browser page.
  return (
    puppeteer
      .launch({
        headless: process.env.HEADLESS === 'true',
      })
      .then((instance) => {
        browser = instance;
        return browser.newPage();
      })
      .then((page) => solveCaptcha(page))
      .then((message) => console.log(`Callback confirmation: ${message}`))
      // STEP-08: Always close Chromium and let callers handle failures.
      .finally(() => browser?.close())
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Report errors and set a nonzero exit code when this file runs directly.
  main().catch((error) => {
    console.error('Example failed:', error.message);
    process.exitCode = 1;
  });
}
