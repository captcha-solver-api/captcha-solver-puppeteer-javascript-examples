import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { demos } from '../config/demos.js';

// Resolve from the repository, so scripts also work when launched elsewhere.
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

/** Read a required variable without echoing its value in an error. */
export function required(name, env = process.env) {
  const value = env[name]?.trim();
  if (!value || value === 'your_api_key') throw new Error(`Set ${name} in .env or the environment.`);
  return value;
}

export function numberSetting(name, fallback, minimum = 0, env = process.env) {
  const value = env[name]?.trim() ? Number(env[name]) : fallback;
  if (!Number.isFinite(value) || value < minimum) throw new Error(`Invalid ${name}.`);
  return value;
}

export function targetUrl(kind) {
  const value = process.env.TARGET_URL?.trim() || demos[kind];
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('TARGET_URL must use HTTP or HTTPS.');
  return url.href;
}

/** Same proxy is used in the browser and API task. Chrome cannot authenticate SOCKS. */
export function proxySettings(env = process.env) {
  const proxyType = env.PROXY_TYPE?.trim() || 'http';
  if (!['http', 'socks4', 'socks5'].includes(proxyType)) throw new Error('Invalid PROXY_TYPE.');
  const proxyAddress = required('PROXY_ADDRESS', env);
  if (/[\s/@?#]/.test(proxyAddress) || proxyAddress.includes('://')) {
    throw new Error('PROXY_ADDRESS must contain only a hostname or IP address.');
  }
  const proxyPort = Number(required('PROXY_PORT', env));
  if (!Number.isInteger(proxyPort) || proxyPort < 1 || proxyPort > 65535) throw new Error('Invalid PROXY_PORT.');
  const proxyLogin = env.PROXY_LOGIN || undefined;
  const proxyPassword = env.PROXY_PASSWORD || undefined;
  if (Boolean(proxyLogin) !== Boolean(proxyPassword)) throw new Error('Set both PROXY_LOGIN and PROXY_PASSWORD.');
  if (proxyLogin && proxyType !== 'http') throw new Error('Chrome supports authenticated HTTP proxies, not authenticated SOCKS proxies.');
  return { proxyType, proxyAddress, proxyPort, proxyLogin, proxyPassword };
}

/** Scrub locally configured credentials from diagnostics, including nested error text. */
export function redact(value, env = process.env) {
  let text = String(value);
  for (const name of ['CAPTCHA_API_KEY', 'PROXY_LOGIN', 'PROXY_PASSWORD']) {
    const secret = env[name];
    if (secret) text = text.split(secret).join('[REDACTED]');
  }
  return text;
}
