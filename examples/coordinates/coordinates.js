/**
 * Solve a click-coordinate CAPTCHA with Puppeteer.
 * The example captures the source image, sends it through the official SDK,
 * scales the returned coordinates to the displayed image, clicks, and submits.
 */
import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());
const IMAGE_SELECTOR = 'img[alt="clickcaptcha example"]';

/** Solve the coordinate CAPTCHA on an already opened page. */
export async function solveCaptcha(page, solver) {
  if (!process.env.TARGET_URL) throw new Error('Set TARGET_URL for this example.');
  console.log('1. Opening the page');
  await page.goto(process.env.TARGET_URL, { waitUntil: 'domcontentloaded' });
  const imageElement = await page.waitForSelector(IMAGE_SELECTOR, { visible: true });

  console.log('2. Reading the original image pixels and dimensions');
  const image = await page.$eval(IMAGE_SELECTOR, (element) => {
    const canvas = document.createElement('canvas');
    canvas.width = element.naturalWidth;
    canvas.height = element.naturalHeight;
    canvas.getContext('2d').drawImage(element, 0, 0);
    return {
      body: canvas.toDataURL('image/png').split(',')[1],
      width: canvas.width,
      height: canvas.height,
    };
  });

  const task = new Tasks.CoordinatesTask({ body: image.body });
  console.log('3. Sending Coordinates task', {
    ...task.toDict(),
    body: `[${image.body.length} base64 characters]`,
  });
  const solution = await solver.solve(task);
  console.log('4. Coordinates received', solution.coordinates);
  if (!solution.coordinates?.length) throw new Error('Captcha Solver returned no coordinates.');

  await imageElement.scrollIntoView();
  const box = await imageElement.boundingBox();
  if (!box) throw new Error('The CAPTCHA image is not visible.');

  console.log('5. Scaling and clicking the returned coordinates');
  for (const point of solution.coordinates) {
    const x = box.x + point.x * box.width / image.width;
    const y = box.y + point.y * box.height / image.height;
    await page.mouse.click(x, y);
  }

  console.log('6. Submitting and waiting for page acceptance');
  await page.click(process.env.SUBMIT_SELECTOR || 'button[type="submit"], input[type="submit"]');
  const selector = process.env.SUCCESS_SELECTOR || 'p[class*="successMessage"]';
  await page.waitForSelector(selector, { visible: true });
  return page.$eval(selector, (element) => element.textContent.trim());
}

/** Run the complete standalone coordinate example. */
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
