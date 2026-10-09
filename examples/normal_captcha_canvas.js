import { entrypoint } from '../lib/runtime.js';
import { main as image } from './normal_captcha_screenshot.js';

/** Preserve original image pixels instead of taking a browser screenshot. */
export async function main() { return image({ canvas: true }); }
entrypoint(import.meta.url, main);
