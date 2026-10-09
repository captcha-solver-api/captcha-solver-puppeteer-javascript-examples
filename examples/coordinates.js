import { Tasks } from '@captcha-solver-api/javascript-sdk';
import { targetUrl } from '../lib/config.js';
import { imageFromCanvas, scaleCoordinates, submit, waitForSuccess } from '../lib/dom.js';
import { entrypoint, runExample, solve } from '../lib/runtime.js';

const IMAGE = 'img[alt="clickcaptcha example"]';

/** Scale coordinates from the original image into the displayed browser element. */
export async function flow({ page, solver }) {
  await page.goto(targetUrl('coordinates'), { waitUntil: 'domcontentloaded' });
  const element = await page.waitForSelector(IMAGE, { visible: true });
  const image = await imageFromCanvas(page, IMAGE);
  const solution = await solve(solver, new Tasks.CoordinatesTask({ body: image.body }));
  await element.scrollIntoView();
  const box = await element.boundingBox();
  for (const point of scaleCoordinates(solution.coordinates, image, box)) {
    await page.mouse.click(point.x, point.y);
  }
  await submit(page);
  return waitForSuccess(page);
}
export async function main() { return runExample('coordinates', flow); }
entrypoint(import.meta.url, main);
