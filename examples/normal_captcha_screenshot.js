import { Tasks } from '@captcha-solver-api/javascript-sdk';
import { targetUrl } from '../lib/config.js';
import { imageFromCanvas, submit, waitForSuccess } from '../lib/dom.js';
import { entrypoint, runExample, solve } from '../lib/runtime.js';

const IMAGE = 'img[alt="normal captcha example"]';
const ANSWER = '#simple-captcha-field';

/** Capture an image, recognize its text, and type the answer into the demo form. */
export async function flow({ page, solver }, { canvas = false, hints = false } = {}) {
  await page.goto(targetUrl('image'), { waitUntil: 'domcontentloaded' });
  const image = await page.waitForSelector(IMAGE, { visible: true });
  await page.waitForFunction((css) => {
    const node = document.querySelector(css);
    return node.complete && node.naturalWidth > 0;
  }, {}, IMAGE);
  const body = canvas ? (await imageFromCanvas(page, IMAGE)).body
    : await image.screenshot({ encoding: 'base64', type: 'png' });
  // Demo answers contain letters; do not force a digits-only recognition mode.
  const params = hints ? { numeric: 4, minLength: 4, maxLength: 10 } : {};
  const solution = await solve(solver, new Tasks.ImageToText({ body, ...params }));
  if (!solution.text) throw new Error('API returned an empty recognized answer.');
  await page.locator(ANSWER).fill(solution.text);
  await submit(page);
  return waitForSuccess(page);
}
export async function main(options = {}) {
  const name = options.canvas ? 'normal_captcha_canvas'
    : options.hints ? 'normal_captcha_screenshot_params' : 'normal_captcha_screenshot';
  return runExample(name, (context) => flow(context, options));
}
entrypoint(import.meta.url, main);
