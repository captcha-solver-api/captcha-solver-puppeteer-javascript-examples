import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { before, after, test } from 'node:test';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { CaptchaClient } from '@captcha-solver-api/javascript-sdk';
import { solveCaptcha as v2 } from '../examples/reCAPTCHA/recaptcha_v2.js';
import { solveCaptcha as v2Callback } from '../examples/reCAPTCHA/recaptcha_v2_callback.js';
import { solveCaptcha as v2CallbackAuto } from '../examples/reCAPTCHA/recaptcha_v2_callback_auto.js';
import { solveCaptcha as v2Proxy } from '../examples/reCAPTCHA/recaptcha_v2_proxy.js';
import { solveCaptcha as v2CallbackProxy } from '../examples/reCAPTCHA/recaptcha_v2_callback_proxy.js';
import { solveCaptcha as enterprise } from '../examples/reCAPTCHA/recaptcha_v2_enterprise.js';
import { solveCaptcha as v3 } from '../examples/reCAPTCHA/recaptcha_v3.js';
import { solveCaptcha as turnstile } from '../examples/cloudflare/turnstile.js';
import { solveCaptcha as challenge } from '../examples/cloudflare/turnstile_challenge.js';
import { solveCaptcha as tencent } from '../examples/tencent/tencent.js';
import { solveCaptcha as yandex } from '../examples/yandex/yandex_smartcaptcha.js';
import { solveCaptcha as geetestV3 } from '../examples/geetest/geetest_v3.js';
import { solveCaptcha as geetestV4 } from '../examples/geetest/geetest_v4.js';

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
  '/v2-callback': `<div data-sitekey="fixture-key" data-callback="verifyDemoRecaptcha"></div><script>
    window.verifyDemoRecaptcha = token => { if (token === 'fixture-token') accept(); };
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
      chlPageData: 'page-data', callback: token => {
        if (token === 'fixture-token') {
           location.href = '/challenge-passed';
        }
      },
    }), 25);
    </script>`,
  '/challenge-passed': `<script>
    document.cookie = 'cf_clearance=fresh-fixture-clearance; path=/';
    accept();
    </script>`,
  '/challenge-http-error': `<script>
    window.turnstile = { render: () => 'widget-id' };
    setTimeout(() => window.turnstile.render('#widget', {
      sitekey: 'fixture-key', action: 'managed', cData: 'session-data',
      chlPageData: 'page-data', callback: () => { location.href = '/challenge-rejected'; },
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
  '/tencent': `<script src="/TCaptcha-global.js"></script><script>
    window.TencentCaptcha = class { constructor(appId, callback) { this.callback = callback; } show() {} };
    setTimeout(() => new TencentCaptcha('fixture-app-id', answer => {
      if (answer.appid === 'fixture-app-id' && answer.ret === 0 && answer.ticket === 'fixture-ticket' && answer.randstr === 'fixture-randstr') accept();
    }).show(), 25);
    </script>`,
  '/yandex': `<div class="smart-captcha" data-sitekey="fixture-key"></div>
    <input name="smart-token" type="hidden"><button id="smartcaptcha-demo-submit">Submit</button>
    <script>document.querySelector('button').onclick = () => {
      if (document.querySelector('[name="smart-token"]').value === 'fixture-token') {
        document.querySelector('p[class*="successMessage"]').textContent = 'Hello, user!';
        accept();
      }
    };</script>`,
  '/geetest-v3': `<script>
    window.initGeetest = () => {};
    initGeetest({ gt: 'fixture-gt', challenge: 'fixture-challenge' }, () => {});
    </script>`,
  '/geetest-v4': `<script>
    setTimeout(() => {
      const loader = document.createElement('script');
      loader.src = '/load?captcha_id=fixture-captcha-id';
      document.head.append(loader);
    }, 25);
    </script>`,
};

before(async () => {
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
      if (req.url === '/api/v1/captcha-demo/gee-test/verify') {
        assert.equal(data.geetest_validate, 'fixture-validate');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true }));
        return;
      }
      if (req.url === '/api/v1/captcha-demo/gee-test-v4/verify') {
        assert.equal(data.captcha_id, 'fixture-captcha-id');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ result: 'success' }));
        return;
      }
      assert.equal(data.clientKey, 'fixture-key');
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/createTask') {
        submitted = data.task;
        receivedHeader = req.headers['x-sdk'];
        res.end(JSON.stringify({ errorId: 0, taskId: 1 }));
      } else if (req.url === '/getTaskResult') {
        const solution =
          submitted.type === 'ImageToTextTask'
            ? { text: 'test' }
            : submitted.type === 'CoordinatesTask'
              ? { coordinates: [{ x: 100, y: 50 }] }
              : submitted.type === 'TurnstileTaskProxyless'
                ? { token: 'fixture-token', userAgent: 'FixtureBrowser/1.0' }
                : submitted.type === 'TencentTaskProxyless'
                  ? {
                      appid: 'fixture-app-id',
                      ret: 0,
                      ticket: 'fixture-ticket',
                      randstr: 'fixture-randstr',
                    }
                  : submitted.type === 'YandexSmartCaptchaTaskProxyless'
                    ? { token: 'fixture-token' }
                    : submitted.type === 'GeeTestTaskProxyless' && submitted.version === 4
                      ? { captcha_id: 'fixture-captcha-id', lot_number: 'fixture-lot' }
                      : submitted.type === 'GeeTestTaskProxyless'
                        ? {
                            challenge: 'fixture-challenge',
                            validate: 'fixture-validate',
                            seccode: 'fixture-seccode',
                          }
                        : { gRecaptchaResponse: 'fixture-token' };
        res.end(JSON.stringify({ errorId: 0, status: 'ready', solution }));
      }
    } else {
      res.setHeader('Content-Type', 'text/html');
      if (req.url === '/challenge-rejected') res.statusCode = 403;
      res.end(success + (fixtures[req.url] || ''));
    }
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  browser = await puppeteer.launch({
    headless: true,
    // GitHub's hosted runner requires Chrome's sandbox to be disabled. Local
    // examples keep the browser sandbox enabled.
    args: process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : [],
  });
});

after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  process.env = originalEnv;
});

/** Run an example flow against the local page and API fixtures. */
async function run(path, solveCaptcha, ...options) {
  const targetURL = baseUrl + path;
  process.env.RECAPTCHA_V2_TARGET_URL = targetURL;
  process.env.RECAPTCHA_V3_TARGET_URL = targetURL;
  process.env.TURNSTILE_TARGET_URL = targetURL;
  process.env.TURNSTILE_CHALLENGE_TARGET_URL = targetURL;
  process.env.TENCENT_TARGET_URL = targetURL;
  submitted = null;
  const page = await browser.newPage();
  page.setDefaultTimeout(3000);
  await page.setViewport({ width: 1000, height: 700, deviceScaleFactor: 1 });
  const solver = new CaptchaClient({
    clientKey: 'fixture-key',
    baseUrl,
    timeout: 3000,
    pollingInterval: 1,
  });
  try {
    const message = await solveCaptcha(page, solver, ...options);
    assert.match(
      message,
      /Demo accepted|callback received|Hello, user!|Tencent callback received|challenge cleared and target page loaded/,
    );
    if (submitted) assert.match(receivedHeader, /^javascript-sdk\//);
    return {
      message,
      task: submitted,
      userAgent: await page.evaluate(() => navigator.userAgent),
    };
  } finally {
    await page.close();
  }
}

test('v2 sends a real SDK request and submits the returned token', async () => {
  const { task } = await run('/v2', v2);
  assert.equal(task.type, 'RecaptchaV2TaskProxyless');
  assert.equal(task.websiteKey, 'fixture-key');
});
test('v2 known-callback example delivers the returned token', async () => {
  const { task } = await run('/v2-callback', v2Callback);
  assert.equal(task.type, 'RecaptchaV2TaskProxyless');
});
test('v2 callback-discovery example finds and invokes the widget callback', async () => {
  const { task } = await run('/v2-callback', v2CallbackAuto);
  assert.equal(task.type, 'RecaptchaV2TaskProxyless');
});
test('v2 proxy example creates a proxy task and submits the token', async () => {
  const proxy = { proxyType: 'http', proxyAddress: '127.0.0.1', proxyPort: 8080 };
  const { task } = await run('/v2', v2Proxy, proxy);
  assert.equal(task.type, 'RecaptchaV2Task');
  assert.equal(task.proxyAddress, '127.0.0.1');
});
test('v2 callback proxy example creates a proxy task and invokes the callback', async () => {
  const proxy = { proxyType: 'http', proxyAddress: '127.0.0.1', proxyPort: 8080 };
  const { task } = await run('/v2-callback', v2CallbackProxy, proxy);
  assert.equal(task.type, 'RecaptchaV2Task');
});
test('Enterprise v2 creates the Enterprise task and verifies acceptance', async () => {
  process.env.RECAPTCHA_ENTERPRISE_TARGET_URL = `${baseUrl}/v2`;
  try {
    const { task } = await run('/v2', enterprise);
    assert.equal(task.type, 'RecaptchaV2EnterpriseTaskProxyless');
  } finally {
    delete process.env.RECAPTCHA_ENTERPRISE_TARGET_URL;
  }
});
test('v3 preserves the action extracted from the page script', async () => {
  const { task } = await run('/v3', v3);
  assert.equal(task.pageAction, 'fixture_action');
  assert.equal(task.minScore, 0.3);
});
test('embedded Turnstile submits its response field', async () => {
  await run('/turnstile', turnstile);
});
test('Challenge interception preserves session fields and the browser User-Agent', async () => {
  const { message, task, userAgent } = await run('/challenge', challenge);
  assert.equal(message, 'challenge cleared and target page loaded.');
  assert.equal(task.data, 'session-data');
  assert.equal(task.pagedata, 'page-data');
  assert.equal(task.action, 'managed');
  assert.notEqual(userAgent, 'FixtureBrowser/1.0');
  assert.equal(task.userAgent, userAgent);
});
test('an already passed Challenge makes no paid request', async () => {
  assert.equal((await run('/already', challenge)).task, null);
});
test('Challenge rejects a failed navigation response', async () => {
  await assert.rejects(run('/challenge-http-error', challenge), /HTTP 403/);
});
test('Tencent interception sends captured fields and invokes the original callback', async () => {
  const { task } = await run('/tencent', tencent);
  assert.equal(task.type, 'TencentTaskProxyless');
  assert.equal(task.appId, 'fixture-app-id');
  assert.match(task.captchaScript, /\/TCaptcha-global\.js$/);
});
test('Yandex SmartCaptcha sends the site key and submits the returned token', async () => {
  process.env.YANDEX_TARGET_URL = `${baseUrl}/yandex`;
  try {
    const { task, userAgent } = await run('/yandex', yandex);
    assert.equal(task.type, 'YandexSmartCaptchaTaskProxyless');
    assert.equal(task.websiteKey, 'fixture-key');
    assert.equal(task.userAgent, userAgent);
  } finally {
    delete process.env.YANDEX_TARGET_URL;
  }
});
test('a Cloudflare block page fails before creating a paid task', async () => {
  await assert.rejects(run('/blocked', challenge), /blocked the browser/);
  assert.equal(submitted, null);
});
test('GeeTest v3 submits all returned verification fields', async () => {
  process.env.GEETEST_V3_TARGET_URL = `${baseUrl}/geetest-v3`;
  const page = await browser.newPage();
  try {
    const solver = new CaptchaClient({
      clientKey: 'fixture-key',
      baseUrl,
      timeout: 3000,
      pollingInterval: 1,
    });
    assert.match(await geetestV3(page, solver), /accepted/);
    assert.equal(submitted.type, 'GeeTestTaskProxyless');
    assert.equal(submitted.gt, 'fixture-gt');
  } finally {
    delete process.env.GEETEST_V3_TARGET_URL;
    await page.close();
  }
});

test('GeeTest v4 submits the complete solver response', async () => {
  process.env.GEETEST_V4_TARGET_URL = `${baseUrl}/geetest-v4`;
  const page = await browser.newPage();
  try {
    const solver = new CaptchaClient({
      clientKey: 'fixture-key',
      baseUrl,
      timeout: 3000,
      pollingInterval: 1,
    });
    assert.match(await geetestV4(page, solver), /accepted/);
    assert.equal(submitted.version, 4);
    assert.equal(submitted.initParameters.captcha_id, 'fixture-captcha-id');
  } finally {
    delete process.env.GEETEST_V4_TARGET_URL;
    await page.close();
  }
});
