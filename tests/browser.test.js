import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { before, after, test } from 'node:test';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { CaptchaClient } from '@captcha-solver-api/javascript-sdk';
import { solveCaptcha as v2 } from '../examples/reCAPTCHA/recaptcha_v2.js';
import { solveCaptcha as v2Proxy } from '../examples/reCAPTCHA/recaptcha_v2_proxy.js';
import { solveCaptcha as callback } from '../examples/reCAPTCHA/recaptcha_v2_callback_variant1.js';
import { solveCaptcha as callbackAuto } from '../examples/reCAPTCHA/recaptcha_v2_callback_variant2.js';
import { solveCaptcha as v3 } from '../examples/reCAPTCHA/recaptcha_v3.js';
import { solveCaptcha as v3Extended } from '../examples/reCAPTCHA/recaptcha_v3_extended_js_script.js';
import { solveCaptcha as turnstile } from '../examples/cloudflare/cloudflare_turnstile.js';
import { solveCaptcha as challenge } from '../examples/cloudflare/cloudflare_challenge_page.js';
import { solveCaptcha as tencent } from '../examples/tencent/tencent.js';
import { solveCaptcha as yandex } from '../examples/yandex/yandex_smartcaptcha.js';
import { solveCaptcha as imageScreenshot } from '../examples/normal_captcha/normal_captcha_screenshot.js';
import { solveCaptcha as imageCanvas } from '../examples/normal_captcha/normal_captcha_canvas.js';
import { solveCaptcha as imageParams } from '../examples/normal_captcha/normal_captcha_screenshot_params.js';
import { solveCaptcha as coordinates } from '../examples/coordinates/coordinates.js';

puppeteer.use(StealthPlugin());

let browser;
let server;
let baseUrl;
let submitted;
let receivedHeader;
const originalEnv = { ...process.env };
const success = `<p class="_successMessage_fixture" hidden>Demo accepted</p><script>
window.accept = () => { document.querySelector('p[class*="successMessage"]').hidden = false; };
</script>`;
const button = '<button type="submit">Check</button>';
const fixtures = {
  '/v2': `<div data-sitekey="fixture-key"></div><textarea name="g-recaptcha-response"></textarea>${button}
    <script>document.querySelector('button').onclick = () => {
      if (document.querySelector('textarea').value === 'fixture-token') accept();
    };</script>`,
  '/callback': `<div data-sitekey="fixture-key"></div><script>
    window.verifyDemoRecaptcha = token => { if (token === 'fixture-token') accept(); };
    window.___grecaptcha_cfg = { clients: {0: { child: { sitekey: 'fixture-key', callback: window.verifyDemoRecaptcha } }} };
    window.___grecaptcha_cfg.clients.self = window.___grecaptcha_cfg.clients;
    </script>`,
  '/v3': `${button}<script>
    window.verifyRecaptcha = token => { if (token === 'fixture-token') accept(); };
    window.grecaptcha = { ready: fn => fn(), execute: () => Promise.resolve('browser-token') };
    document.querySelector('button').onclick = () => {
      grecaptcha.execute('fixture-key', { action: 'fixture_action' }).then(window.verifyRecaptcha);
    };
    </script>`,
  '/turnstile': `<div class="cf-turnstile" data-sitekey="fixture-key"></div><input name="cf-turnstile-response">${button}
    <script>document.querySelector('button').onclick = () => {
      if (document.querySelector('input').value === 'fixture-token') accept();
    };</script>`,
  '/challenge': `<script>
    window.turnstile = { render: () => 'widget-id' };
    setTimeout(() => window.turnstile.render('#widget', {
      sitekey: 'fixture-key', action: 'managed', cData: 'session-data',
      chlPageData: 'page-data', callback: token => { if (token === 'fixture-token') accept(); },
    }), 25);
    </script>`,
  '/already': `<script>accept();</script>`,
  '/blocked': '<div id="cf-error-details">Sorry, you have been blocked</div>',
  '/image': `<img alt="normal captcha example" class="_captchaImage_fixture"><input id="simple-captcha-field">${button}<script>
    const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 100;
    canvas.getContext('2d').fillText('test', 10, 30); document.querySelector('img').src = canvas.toDataURL();
    document.querySelector('button').onclick = () => { if (document.querySelector('input').value === 'test') accept(); };
    </script>`,
  '/coordinates': `<div style="height:1200px"></div><img alt="clickcaptcha example" style="width:200px;height:100px">${button}<script>
    const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 200;
    const image = document.querySelector('img'); image.src = canvas.toDataURL();
    image.onclick = event => { window.clicked = [event.offsetX, event.offsetY]; };
    document.querySelector('button').onclick = () => {
      if (Math.abs(window.clicked?.[0] - 50) < 2 && Math.abs(window.clicked?.[1] - 25) < 2) accept();
    };</script>`,
  '/tencent': `<button id="open-tencent">Verify</button><script src="/TCaptcha-global.js"></script><script>
    window.TencentCaptcha = class { constructor(appId, callback) { this.callback = callback; } show() {} };
    document.querySelector('#open-tencent').onclick = () => new TencentCaptcha('fixture-app-id', answer => {
      if (answer.appid === 'fixture-app-id' && answer.ret === 0 && answer.ticket === 'fixture-ticket' && answer.randstr === 'fixture-randstr') accept();
    }).show();
    </script>`,
  '/yandex': `<div class="smart-captcha" data-sitekey="fixture-key"></div>
    <input name="smart-token" type="hidden"><button id="smartcaptcha-demo-submit">Submit</button>
    <script>document.querySelector('button').onclick = () => {
      if (document.querySelector('[name="smart-token"]').value === 'fixture-token') accept();
    };</script>`,
};

before(async () => {
  delete process.env.SUCCESS_SELECTOR;
  delete process.env.SUBMIT_SELECTOR;
  delete process.env.CALLBACK_NAME;
  delete process.env.RECAPTCHA_SITEKEY;
  delete process.env.RECAPTCHA_ACTION;
  delete process.env.TENCENT_TRIGGER_SELECTOR;
  delete process.env.TENCENT_SUCCESS_SELECTOR;
  process.env.RECAPTCHA_MIN_SCORE = '0.3';
  server = createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/TCaptcha-global.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.end('window.fixtureTencentScript = true;');
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const data = JSON.parse(body);
      assert.equal(data.clientKey, 'fixture-key');
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/createTask') {
        submitted = data.task;
        receivedHeader = req.headers['x-sdk'];
        res.end(JSON.stringify({ errorId: 0, taskId: 1 }));
      } else if (req.url === '/getTaskResult') {
        const solution = submitted.type === 'ImageToTextTask' ? { text: 'test' }
          : submitted.type === 'CoordinatesTask' ? { coordinates: [{ x: 100, y: 50 }] }
          : submitted.type === 'TurnstileTaskProxyless' ? { token: 'fixture-token', userAgent: 'FixtureBrowser/1.0' }
          : submitted.type === 'TencentTaskProxyless' ? { appid: 'fixture-app-id', ret: 0, ticket: 'fixture-ticket', randstr: 'fixture-randstr' }
          : submitted.type === 'YandexSmartCaptchaTaskProxyless' ? { token: 'fixture-token' }
          : { gRecaptchaResponse: 'fixture-token' };
        res.end(JSON.stringify({ errorId: 0, status: 'ready', solution }));
      }
    } else {
      res.setHeader('Content-Type', 'text/html');
      res.end(success + (fixtures[req.url] || ''));
    }
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
    // GitHub's hosted runner requires Chrome's sandbox to be disabled. Local
    // examples keep the browser sandbox enabled.
    args: process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : [],
  });
});

after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  process.env = originalEnv;
});

/** Run an example flow against the local page and API fixtures. */
async function run(path, solveCaptcha, ...options) {
  process.env.TARGET_URL = baseUrl + path;
  submitted = null;
  const page = await browser.newPage();
  page.setDefaultTimeout(3000);
  await page.setViewport({ width: 1000, height: 700, deviceScaleFactor: 1 });
  const solver = new CaptchaClient({ clientKey: 'fixture-key', baseUrl, timeout: 3000, pollingInterval: 1 });
  try {
    const message = await solveCaptcha(page, solver, ...options);
    assert.match(message, /Demo accepted/);
    if (submitted) assert.match(receivedHeader, /^javascript-sdk\//);
    return { task: submitted, userAgent: await page.evaluate(() => navigator.userAgent) };
  } finally { await page.close(); }
}

test('v2 sends a real SDK request and submits the returned token', async () => {
  const { task } = await run('/v2', v2);
  assert.equal(task.type, 'RecaptchaV2TaskProxyless');
  assert.equal(task.websiteKey, 'fixture-key');
});
test('proxy variant passes the configured proxy into its task', async () => {
  const { task } = await run('/v2', v2Proxy, { proxyType: 'http', proxyAddress: 'proxy.example.com', proxyPort: 8080 });
  assert.equal(task.type, 'RecaptchaV2Task');
  assert.equal(task.proxyPort, 8080);
});
test('known callback receives the API token', async () => { await run('/callback', callback); });
test('automatic discovery handles cyclic callback configuration', async () => { await run('/callback', callbackAuto); });
test('v3 preserves the action extracted from the page script', async () => {
  const { task } = await run('/v3', v3);
  assert.equal(task.pageAction, 'fixture_action');
  assert.equal(task.minScore, 0.3);
});
test('extended v3 resolves the intercepted promise with the API answer', async () => { await run('/v3', v3Extended); });
test('embedded Turnstile submits its response field', async () => { await run('/turnstile', turnstile); });
test('Challenge interception preserves session fields and the browser User-Agent', async () => {
  const { task, userAgent } = await run('/challenge', challenge);
  assert.equal(task.data, 'session-data');
  assert.equal(task.pagedata, 'page-data');
  assert.equal(task.action, 'managed');
  assert.notEqual(userAgent, 'FixtureBrowser/1.0');
  assert.equal(task.userAgent, userAgent);
});
test('an already passed Challenge makes no paid request', async () => {
  assert.equal((await run('/already', challenge)).task, null);
});
test('Tencent interception sends captured fields and invokes the original callback', async () => {
  process.env.TENCENT_TRIGGER_SELECTOR = '#open-tencent';
  process.env.TENCENT_SUCCESS_SELECTOR = 'p[class*="successMessage"]';
  const { task } = await run('/tencent', tencent);
  assert.equal(task.type, 'TencentTaskProxyless');
  assert.equal(task.appId, 'fixture-app-id');
  assert.match(task.captchaScript, /\/TCaptcha-global\.js$/);
});
test('Yandex SmartCaptcha sends the site key and submits the returned token', async () => {
  process.env.SUCCESS_SELECTOR = 'p[class*="successMessage"]';
  try {
    const { task, userAgent } = await run('/yandex', yandex);
    assert.equal(task.type, 'YandexSmartCaptchaTaskProxyless');
    assert.equal(task.websiteKey, 'fixture-key');
    assert.equal(task.userAgent, userAgent);
  } finally {
    delete process.env.SUCCESS_SELECTOR;
  }
});
test('a Cloudflare block page fails before creating a paid task', async () => {
  await assert.rejects(run('/blocked', challenge), /blocked the browser/);
  assert.equal(submitted, null);
});
for (const [name, solveImage, hasHints] of [
  ['screenshot', imageScreenshot, false],
  ['canvas', imageCanvas, false],
  ['hints', imageParams, true],
]) {
  test(`image ${name} sends image data and verifies recognized text`, async () => {
    const { task } = await run('/image', solveImage);
    assert.equal(task.type, 'ImageToTextTask');
    assert.ok(Buffer.from(task.body, 'base64').length > 100);
    if (hasHints) assert.equal(task.numeric, 4);
  });
}
test('coordinate clicks account for image scaling and scroll position', async () => { await run('/coordinates', coordinates); });
