import { Tasks } from '@captcha-solver-api/javascript-sdk';
import { targetUrl } from '../lib/config.js';
import { callNamedCallback, discoverRecaptchaCallback, recaptchaParams, waitForSuccess } from '../lib/dom.js';
import { entrypoint, runExample, solve } from '../lib/runtime.js';

/** Use a known callback name, or discover the actual function in the second variant. */
export async function flow({ page, solver }, { auto = false, proxy } = {}) {
  await page.goto(targetUrl('recaptchaCallback'), { waitUntil: 'domcontentloaded' });
  const params = auto ? await discoverRecaptchaCallback(page) : await recaptchaParams(page);
  const Task = proxy ? Tasks.RecaptchaV2 : Tasks.RecaptchaV2Proxyless;
  const solution = await solve(solver, new Task({
    ...params, websiteURL: page.url(),
    userAgent: await page.evaluate(() => navigator.userAgent), ...proxy,
  }));
  if (auto) {
    await page.evaluate((token) => window.__captchaCallback(token), solution.gRecaptchaResponse);
  } else {
    await callNamedCallback(page, process.env.CALLBACK_NAME || 'verifyDemoRecaptcha', solution.gRecaptchaResponse);
  }
  return waitForSuccess(page);
}

export async function main(options = {}) {
  const name = options.proxy ? 'recaptcha_v2_callback_proxy'
    : `recaptcha_v2_callback_variant${options.auto ? '2' : '1'}`;
  return runExample(name, (context) => flow(context, options), { proxy: options.proxy });
}
entrypoint(import.meta.url, main);
