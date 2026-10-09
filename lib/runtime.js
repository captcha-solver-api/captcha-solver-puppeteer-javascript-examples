import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import puppeteer from 'puppeteer';
import { CaptchaClient } from '@captcha-solver-api/javascript-sdk';
import { numberSetting, redact, required } from './config.js';

/** Create a client for our API; keys are never sent to a demo page. */
export function createSolver() {
  return new CaptchaClient({
    clientKey: required('CAPTCHA_API_KEY'),
    timeout: numberSetting('SOLVE_TIMEOUT_MS', 180000, 1000),
    pollingInterval: 5000,
  });
}

/** Launch a fresh browser session, optionally through the same proxy as the task. */
export async function launchBrowser(proxy) {
  const args = [];
  if (proxy) {
    const host = proxy.proxyAddress.includes(':') && !proxy.proxyAddress.startsWith('[')
      ? `[${proxy.proxyAddress}]` : proxy.proxyAddress;
    args.push(`--proxy-server=${proxy.proxyType}://${host}:${proxy.proxyPort}`);
  }
  const browser = await puppeteer.launch({
    headless: process.env.HEADLESS === 'true',
    executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
    defaultViewport: { width: 1280, height: 900, deviceScaleFactor: 1 },
    args,
  });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(numberSetting('PAGE_TIMEOUT_MS', 60000, 1000));
    page.setDefaultNavigationTimeout(numberSetting('PAGE_TIMEOUT_MS', 60000, 1000));
    if (proxy?.proxyLogin) await page.authenticate({ username: proxy.proxyLogin, password: proxy.proxyPassword });
    if (process.env.BROWSER_USER_AGENT) await page.setUserAgent(process.env.BROWSER_USER_AGENT);
    return { browser, page };
  } catch (error) {
    await browser.close();
    throw error;
  }
}

/** Bound shutdown time for pages whose background workers keep Chrome alive. */
export async function closeBrowser(browser) {
  const child = browser.process();
  let timer;
  try {
    await Promise.race([
      browser.close().catch(() => {}),
      new Promise((resolve) => { timer = setTimeout(resolve, 5000); }),
    ]);
  } finally {
    clearTimeout(timer);
    // This is the Chrome process launched by this example, never an existing browser.
    if (child && child.exitCode === null) child.kill();
    await browser.disconnect().catch(() => {});
  }
}

/** Send one paid task. Retries are explicit to prevent accidental repeated charges. */
export async function solve(solver, task) {
  console.log(`Solving ${task.toDict().type}...`);
  const solution = await solver.solve(task);
  if (!solution || typeof solution !== 'object') throw new Error('API returned no solution object.');
  console.log('Solution received.');
  if (process.env.PRINT_SOLUTION === 'true') console.log(redact(JSON.stringify(solution, null, 2)));
  return solution;
}

/** Always close the browser, and preserve a local screenshot when the flow fails. */
export async function runExample(name, flow, { proxy } = {}) {
  const solver = createSolver();
  const { browser, page } = await launchBrowser(proxy);
  try {
    console.log(`Started: ${name}`);
    const result = await flow({ page, solver });
    console.log(`PASS: ${name}${result ? ` — ${redact(result)}` : ''}`);
    await delay(numberSetting('KEEP_OPEN_MS', 3000));
    return result;
  } catch (error) {
    const directory = resolve('artifacts');
    await mkdir(directory, { recursive: true });
    await page.screenshot({ path: resolve(directory, `${name}-failure.png`), fullPage: true }).catch(() => {});
    await writeFile(resolve(directory, `${name}-failure.txt`), redact(error.message), 'utf8');
    throw error;
  } finally {
    await closeBrowser(browser);
  }
}

/** Allow examples to be imported in fixture tests without starting paid API calls. */
export function entrypoint(moduleUrl, main) {
  if (process.argv[1] && moduleUrl === pathToFileURL(resolve(process.argv[1])).href) {
    main().catch((error) => { console.error(`FAIL: ${redact(error.message)}`); process.exitCode = 1; });
  }
}
