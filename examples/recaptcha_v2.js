import { Tasks } from '@captcha-solver-api/javascript-sdk';
import { targetUrl } from '../lib/config.js';
import { fillResponse, recaptchaParams, submit, waitForSuccess } from '../lib/dom.js';
import { entrypoint, runExample, solve } from '../lib/runtime.js';

/** Extract the widget, solve through our API, and verify the token on the page. */
export async function flow({ page, solver }, proxy) {
  await page.goto(targetUrl('recaptchaV2'), { waitUntil: 'domcontentloaded' });
  const params = await recaptchaParams(page);
  const Task = proxy ? Tasks.RecaptchaV2 : Tasks.RecaptchaV2Proxyless;
  const solution = await solve(solver, new Task({
    ...params,
    websiteURL: page.url(),
    userAgent: await page.evaluate(() => navigator.userAgent),
    ...proxy,
  }));
  await fillResponse(page, 'g-recaptcha-response', solution.gRecaptchaResponse);
  await submit(page);
  return waitForSuccess(page);
}

export async function main({ proxy } = {}) {
  return runExample(proxy ? 'recaptcha_v2_proxy' : 'recaptcha_v2',
    (context) => flow(context, proxy), { proxy });
}

entrypoint(import.meta.url, main);
