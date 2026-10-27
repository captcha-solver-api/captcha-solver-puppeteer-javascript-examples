import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';

/** Remove locally configured credentials from live-test output. */
function redact(value) {
  let text = String(value);
  for (const name of ['CAPTCHA_API_KEY', 'PROXY_LOGIN', 'PROXY_PASSWORD']) {
    if (process.env[name]) text = text.split(process.env[name]).join('[REDACTED]');
  }
  return text;
}

const { scripts } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const paths = Object.fromEntries(Object.entries(scripts)
  .filter(([name]) => name.startsWith('example:'))
  .map(([, command]) => {
    const path = command.split(' ').at(-1);
    return [basename(path, '.js'), path];
  }));
const allowed = Object.keys(paths);
const examples = allowed.filter((name) => !name.endsWith('_proxy') && name !== 'tencent');
const selected = process.argv.slice(2).length ? process.argv.slice(2) : examples;
if (selected.some((name) => !allowed.includes(name))) throw new Error('Unknown example name.');
await mkdir('artifacts', { recursive: true });
const report = { started: new Date().toISOString(), results: [] };
const reportPath = `artifacts/live-${Date.now()}.json`;
for (const name of selected) {
  const started = Date.now();
  try {
    const { main } = await import(new URL(`../${paths[name]}`, import.meta.url));
    await main();
    report.results.push({ name, status: 'passed', seconds: (Date.now() - started) / 1000 });
  } catch (error) {
    console.error(`FAIL: ${name}: ${redact(error.message)}`);
    report.results.push({ name, status: 'failed', seconds: (Date.now() - started) / 1000, error: redact(error.message) });
    process.exitCode = 1;
  }
  await writeFile(reportPath, JSON.stringify(report, null, 2));
}
console.log(`Live report: ${reportPath}`);
