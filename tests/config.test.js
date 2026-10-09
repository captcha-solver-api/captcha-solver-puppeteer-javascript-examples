import assert from 'node:assert/strict';
import test from 'node:test';
import { proxySettings, redact, numberSetting } from '../lib/config.js';
import { scaleCoordinates } from '../lib/dom.js';

test('proxy fields match the browser configuration and reject invalid ports', () => {
  const env = { PROXY_TYPE: 'http', PROXY_ADDRESS: 'proxy.example.com', PROXY_PORT: '8080', PROXY_LOGIN: 'user', PROXY_PASSWORD: 'pass' };
  assert.deepEqual(proxySettings(env), { proxyType: 'http', proxyAddress: 'proxy.example.com', proxyPort: 8080, proxyLogin: 'user', proxyPassword: 'pass' });
  assert.throws(() => proxySettings({ ...env, PROXY_PORT: '65536' }), /PROXY_PORT/);
  assert.throws(() => proxySettings({ ...env, PROXY_PORT: 'NaN' }), /PROXY_PORT/);
  assert.throws(() => proxySettings({ ...env, PROXY_PASSWORD: '' }), /both/);
  assert.throws(() => proxySettings({ ...env, PROXY_TYPE: 'socks5' }), /authenticated/);
});

test('coordinates account for CSS scaling and reject malformed API answers', () => {
  const image = { width: 400, height: 200 };
  const box = { x: 30, y: 40, width: 200, height: 100 };
  assert.deepEqual(scaleCoordinates([{ x: 100, y: 50 }], image, box), [{ x: 80, y: 65 }]);
  assert.throws(() => scaleCoordinates([{ x: 400, y: 50 }], image, box), /outside/);
  assert.throws(() => scaleCoordinates([{ x: '100', y: 50 }], image, box), /outside/);
  assert.throws(() => scaleCoordinates([], image, box), /Missing/);
});

test('diagnostics redact every occurrence of configured credentials', () => {
  assert.equal(redact('key private-key proxy-secret private-key', { CAPTCHA_API_KEY: 'private-key', PROXY_PASSWORD: 'proxy-secret' }),
    'key [REDACTED] [REDACTED] [REDACTED]');
});

test('numeric settings reject invalid values instead of disabling timeouts', () => {
  assert.equal(numberSetting('LIMIT', 100, 1, {}), 100);
  assert.throws(() => numberSetting('LIMIT', 100, 1, { LIMIT: '-1' }), /Invalid/);
  assert.throws(() => numberSetting('LIMIT', 100, 1, { LIMIT: 'bad' }), /Invalid/);
});
