import { Tasks } from '@captcha-solver-api/javascript-sdk';
import { targetUrl } from '../lib/config.js';
import { fillResponse, submit, waitForSuccess } from '../lib/dom.js';
import { entrypoint, runExample, solve } from '../lib/runtime.js';

/** Solve an embedded Turnstile widget and submit the containing demo form. */
export async function flow({ page, solver }) {
  await page.goto(targetUrl('turnstile'), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.cf-turnstile[data-sitekey]');
  const params = await page.$eval('.cf-turnstile[data-sitekey]', (widget) => ({
    websiteKey: widget.dataset.sitekey,
    action: widget.dataset.action,
    data: widget.dataset.cdata,
  }));
  const solution = await solve(solver, new Tasks.TurnstileProxyless({
    ...params, websiteURL: page.url(), userAgent: await page.evaluate(() => navigator.userAgent),
  }));
  await fillResponse(page, 'cf-turnstile-response', solution.token);
  await submit(page);
  return waitForSuccess(page);
}
export async function main() { return runExample('cloudflare_turnstile', flow); }
entrypoint(import.meta.url, main);
