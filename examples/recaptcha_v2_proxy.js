import { proxySettings } from '../lib/config.js';
import { entrypoint } from '../lib/runtime.js';
import { main as recaptcha } from './recaptcha_v2.js';

/** Share one configured proxy between Puppeteer and RecaptchaV2 task. */
export async function main() { return recaptcha({ proxy: proxySettings() }); }
entrypoint(import.meta.url, main);
