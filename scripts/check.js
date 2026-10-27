import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

/** Recursively yield JavaScript source files from a directory. */
async function* javascriptFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) yield* javascriptFiles(path);
    else if (entry.name.endsWith('.js')) yield path;
  }
}

for (const directory of ['config', 'examples', 'scripts', 'tests']) {
  for await (const path of javascriptFiles(directory)) {
    const result = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status || 1);
  }
}
console.log('JavaScript syntax checks passed.');
