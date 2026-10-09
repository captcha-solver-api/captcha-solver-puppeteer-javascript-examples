import { Tasks } from '@captcha-solver-api/javascript-sdk';
import { numberSetting, targetUrl } from '../lib/config.js';
import { callNamedCallback, submit, waitForSuccess } from '../lib/dom.js';
import { interceptRecaptchaV3 } from '../lib/intercept.js';
import { entrypoint, runExample, solve } from '../lib/runtime.js';

/** Find the execute() parameters in scripts, or intercept the call for the extended variant. */
export async function flow({ page, solver }, { extended = false } = {}) {
  if (extended) await interceptRecaptchaV3(page);
  await page.goto(targetUrl('recaptchaV3'), { waitUntil: 'domcontentloaded' });
  if (extended) {
    await page.waitForFunction(() => window.__recaptchaV3 || typeof window.grecaptcha?.execute === 'function');
    // This demo executes v3 on submit. Other integrations may execute on load.
    if (!await page.evaluate(() => Boolean(window.__recaptchaV3))) await submit(page);
  }
  const handle = await page.waitForFunction((capture, sitekey, action) => {
    if (sitekey && action) return { websiteKey: sitekey, pageAction: action };
    if (capture) return window.__recaptchaV3 || false;
    const source = Array.from(document.scripts, (script) => script.textContent).join('\n');
    const match = source.match(/grecaptcha\.execute\s*\(\s*['"]([^'"]+)['"]\s*,\s*\{[^}]*action\s*:\s*['"]([^'"]+)['"]/);
    return match ? { websiteKey: match[1], pageAction: match[2] } : false;
  }, {}, extended, process.env.RECAPTCHA_SITEKEY || '', process.env.RECAPTCHA_ACTION || '');
  const params = await handle.jsonValue();
  await handle.dispose();
  const minScore = numberSetting('RECAPTCHA_MIN_SCORE', 0.3);
  if (minScore > 1) throw new Error('RECAPTCHA_MIN_SCORE must be between 0 and 1.');
  const solution = await solve(solver, new Tasks.RecaptchaV3Proxyless({
    ...params, websiteURL: page.url(), minScore,
  }));
  if (extended) {
    await page.evaluate((token) => {
      if (typeof window.__resolveRecaptchaV3 !== 'function') throw new Error('No captured execute() promise.');
      window.__resolveRecaptchaV3(token);
    }, solution.gRecaptchaResponse);
  } else {
    await callNamedCallback(page, process.env.CALLBACK_NAME || 'verifyRecaptcha', solution.gRecaptchaResponse);
  }
  // The demo callback sends the token for verification itself. Clicking Check
  // again would run execute() again and replace our API token.
  return waitForSuccess(page);
}

export async function main(options = {}) {
  return runExample(options.extended ? 'recaptcha_v3_extended_js_script' : 'recaptcha_v3',
    (context) => flow(context, options));
}
entrypoint(import.meta.url, main);
