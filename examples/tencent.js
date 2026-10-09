import { Tasks } from '@captcha-solver-api/javascript-sdk';
import { required } from '../lib/config.js';
import { waitForSuccess } from '../lib/dom.js';
import { interceptTencent } from '../lib/intercept.js';
import { entrypoint, runExample, solve } from '../lib/runtime.js';

/** Capture a Tencent CAPTCHA request, solve it, and invoke the page callback. */
export async function flow({ page, solver }) {
  const targetUrl = required('TARGET_URL');
  const successSelector = required('TENCENT_SUCCESS_SELECTOR');
  await interceptTencent(page);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

  const triggerSelector = process.env.TENCENT_TRIGGER_SELECTOR?.trim();
  if (triggerSelector) await page.locator(triggerSelector).click();

  const handle = await page.waitForFunction(() => window.__captchaSolverTencent?.pending()[0] || false);
  const params = await handle.jsonValue();
  await handle.dispose();
  const { id, ...taskParams } = params;
  const solution = await solve(solver, new Tasks.TencentTaskProxyless(taskParams));
  await page.evaluate((recordId, answer) => {
    window.__captchaSolverTencent.submit(recordId, answer);
  }, id, solution);
  return waitForSuccess(page, successSelector);
}

export async function main() { return runExample('tencent', flow); }
entrypoint(import.meta.url, main);
