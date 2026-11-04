/**
 * Solve Tencent CAPTCHA with Puppeteer and Captcha Solver.
 * The TencentCaptcha constructor is intercepted so the task parameters and
 * original callback can be used without hardcoded values.
 */
import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

/** Install the TencentCaptcha constructor interceptor before navigation. */
async function installInterceptor(page) {
  await page.evaluateOnNewDocument(() => {
    const records = new Map();
    let originalConstructor;
    let nextId = 0;

    Object.defineProperty(window, '__captchaSolverTencent', {
      value: {
        pending: () => [...records.values()]
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
              captchaScript: document.currentScript?.src || [...document.scripts]
                .map((script) => script.src)
                .find((src) => /\/TCaptcha-global\.js(?:\?|$)/i.test(src)),
            };
            const nativeArgs = [...args];
            nativeArgs[offset + 1] = () => {};
            const instance = Reflect.construct(Target, nativeArgs, newTarget);
            instance.show = () => {};
            records.set(id, { params, callback, submitted: false });
            return instance;
          },
        });
      },
    });
  });
}

/** Solve Tencent CAPTCHA on an already opened page. */
export async function solveCaptcha(page, solver) {
  if (!process.env.TARGET_URL) throw new Error('Set TARGET_URL for this example.');
  if (!process.env.TENCENT_SUCCESS_SELECTOR) throw new Error('Set TENCENT_SUCCESS_SELECTOR.');
  console.log('1. Installing the TencentCaptcha interceptor');
  await installInterceptor(page);
  console.log('2. Opening the Tencent CAPTCHA page');
  await page.goto(process.env.TARGET_URL, { waitUntil: 'domcontentloaded' });

  if (process.env.TENCENT_TRIGGER_SELECTOR) {
    console.log('3. Opening the CAPTCHA widget');
    await page.click(process.env.TENCENT_TRIGGER_SELECTOR);
  }
  const handle = await page.waitForFunction(() => window.__captchaSolverTencent.pending()[0] || false);
  const captured = await handle.jsonValue();
  await handle.dispose();
  const { id, ...taskParameters } = captured;
  console.log('4. Captured Tencent parameters', taskParameters);

  const task = new Tasks.TencentTaskProxyless(taskParameters);
  console.log('5. Sending the task to Captcha Solver');
  const solution = await solver.solve(task);
  console.log('6. Solution received', solution);

  // Token injection and submission are site-specific; adapt this step to the target page.
  console.log('7. Passing the solution to the original Tencent callback');
  await page.evaluate((recordId, answer) => {
    window.__captchaSolverTencent.submit(recordId, answer);
  }, id, solution);
  await page.waitForSelector(process.env.TENCENT_SUCCESS_SELECTOR, { visible: true });
  return page.$eval(process.env.TENCENT_SUCCESS_SELECTOR, (element) => element.textContent.trim());
}

/** Run the complete standalone Tencent CAPTCHA example. */
export async function main() {
  const apiKey = process.env.CAPTCHA_API_KEY;
  if (!apiKey || apiKey === 'your_api_key') throw new Error('Set CAPTCHA_API_KEY.');
  const solver = new CaptchaClient({ clientKey: apiKey });
  const browser = await puppeteer.launch({
    headless: process.env.HEADLESS === 'true',
    executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
  });
  try {
    const page = await browser.newPage();
    console.log('Captcha solved successfully:', await solveCaptcha(page, solver));
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error('Example failed:', error.message); process.exitCode = 1; });
}
