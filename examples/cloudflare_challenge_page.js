import { Tasks } from '@captcha-solver-api/javascript-sdk';
import { targetUrl } from '../lib/config.js';
import { waitForSuccess } from '../lib/dom.js';
import { interceptTurnstile } from '../lib/intercept.js';
import { entrypoint, runExample, solve } from '../lib/runtime.js';

/** Capture Challenge parameters before page scripts run and invoke the captured callback. */
export async function flow({ page, solver }) {
  await interceptTurnstile(page);
  await page.goto(targetUrl('challenge'), { waitUntil: 'domcontentloaded' });
  const selector = process.env.SUCCESS_SELECTOR || 'p[class*="successMessage"]';
  const handle = await page.waitForFunction((css) => {
    if (document.querySelector('#cf-error-details')?.textContent.includes('you have been blocked')) {
      return { blocked: true };
    }
    const success = document.querySelector(css);
    if (success?.getClientRects().length && success.textContent.trim()) return { success: success.textContent.trim() };
    if (window.__turnstileParams && typeof window.__turnstileCallback === 'function') return { params: window.__turnstileParams };
    return false;
  }, {}, selector);
  const state = await handle.jsonValue();
  await handle.dispose();
  if (state.blocked) {
    throw new Error('Cloudflare blocked this browser before loading the challenge widget. No API task was created. Test from another permitted network or use a different demo.');
  }
  if (state.success) return `Already passed without a paid task: ${state.success}`;
  const solution = await solve(solver, new Tasks.TurnstileProxyless(state.params));
  // Use the solver's returned browser identity when one is supplied.
  if (solution.userAgent) await page.setUserAgent(solution.userAgent);
  await page.evaluate((token) => {
    if (typeof window.__turnstileCallback !== 'function') throw new Error('Captured callback is no longer available.');
    window.__turnstileCallback(token);
  }, solution.token);
  return waitForSuccess(page, selector);
}
export async function main() { return runExample('cloudflare_challenge_page', flow); }
entrypoint(import.meta.url, main);
