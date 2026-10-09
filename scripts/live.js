import { mkdir, writeFile } from 'node:fs/promises';
import { redact } from '../lib/config.js';

const examples = [
  'recaptcha_v2', 'recaptcha_v2_callback_variant1', 'recaptcha_v2_callback_variant2',
  'recaptcha_v3', 'recaptcha_v3_extended_js_script', 'cloudflare_turnstile',
  'cloudflare_challenge_page', 'normal_captcha_screenshot', 'normal_captcha_canvas',
  'normal_captcha_screenshot_params', 'coordinates',
];
const allowed = [...examples, 'recaptcha_v2_proxy', 'recaptcha_v2_callback_proxy', 'tencent'];
const selected = process.argv.slice(2).length ? process.argv.slice(2) : examples;
if (selected.some((name) => !allowed.includes(name))) throw new Error('Unknown example name.');
process.env.KEEP_OPEN_MS = '0';
await mkdir('artifacts', { recursive: true });
const report = { started: new Date().toISOString(), results: [] };
const reportPath = `artifacts/live-${Date.now()}.json`;
for (const name of selected) {
  const started = Date.now();
  try {
    const { main } = await import(`../examples/${name}.js`);
    const message = await main();
    report.results.push({ name, status: 'passed', seconds: (Date.now() - started) / 1000, message: redact(message) });
  } catch (error) {
    console.error(`FAIL: ${name}: ${redact(error.message)}`);
    report.results.push({ name, status: 'failed', seconds: (Date.now() - started) / 1000, error: redact(error.message) });
    process.exitCode = 1;
  }
  await writeFile(reportPath, JSON.stringify(report, null, 2));
}
console.log(`Live report: ${reportPath}`);
