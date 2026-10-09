import { entrypoint } from '../lib/runtime.js';
import { main as recaptcha } from './recaptcha_v3.js';

/** Capture parameters even when execute() is called from an external script. */
export async function main() { return recaptcha({ extended: true }); }
entrypoint(import.meta.url, main);
