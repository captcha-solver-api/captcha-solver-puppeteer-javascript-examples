import { entrypoint } from '../lib/runtime.js';
import { main as callback } from './recaptcha_v2_callback_variant1.js';

/** Discover a callback in data attributes or the live reCAPTCHA configuration. */
export async function main() { return callback({ auto: true }); }
entrypoint(import.meta.url, main);
