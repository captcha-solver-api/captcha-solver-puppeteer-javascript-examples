import { entrypoint } from '../lib/runtime.js';
import { main as image } from './normal_captcha_screenshot.js';

/** Add character-set and length hints to the same screenshot recognition flow. */
export async function main() { return image({ hints: true }); }
entrypoint(import.meta.url, main);
