import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CaptchaClient } from '@captcha-solver-api/javascript-sdk';
import { main } from '../examples/yandex-smartcaptcha-image.js';

test('Yandex image example sends the dedicated SmartCaptchaTask', async (context) => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.CAPTCHA_API_KEY;
  let submittedTask;

  context.after(() => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.CAPTCHA_API_KEY;
    else process.env.CAPTCHA_API_KEY = originalApiKey;
  });

  process.env.CAPTCHA_API_KEY = 'fixture-key';
  globalThis.fetch = (url, options) => {
    const request = JSON.parse(options.body);
    assert.equal(request.clientKey, 'fixture-key');

    if (String(url).endsWith('/createTask')) {
      submittedTask = request.task;
      return Promise.resolve(globalThis.Response.json({ errorId: 0, taskId: 1 }));
    }

    assert.match(String(url), /\/getTaskResult$/);
    return Promise.resolve(
      globalThis.Response.json({
        errorId: 0,
        status: 'ready',
        solution: { coordinates: [{ x: 57, y: 82 }] },
      }),
    );
  };

  const solution = await main(
    new CaptchaClient({
      clientKey: 'fixture-key',
      baseUrl: 'https://fixture.invalid',
      pollingInterval: 1,
    }),
  );

  assert.equal(submittedTask.type, 'SmartCaptchaTask');
  assert.ok(submittedTask.image);
  assert.ok(submittedTask.imgInstructions);
  assert.equal(submittedTask.body, undefined);
  assert.deepEqual(solution.coordinates, [{ x: 57, y: 82 }]);
});
