import { proxySettings } from '../lib/config.js';
import { entrypoint } from '../lib/runtime.js';
import { main as callback } from './recaptcha_v2_callback_variant1.js';

/** Discover the callback while using the same proxy in Chrome and the API task. */
export async function main() { return callback({ auto: true, proxy: proxySettings() }); }
entrypoint(import.meta.url, main);
