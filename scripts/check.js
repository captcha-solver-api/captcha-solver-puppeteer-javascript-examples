import { readFile, readdir } from 'node:fs/promises';
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
    const result = spawnSync(process.execPath, ['--check', path], {
      stdio: 'inherit',
    });
    if (result.status !== 0) process.exit(result.status || 1);
  }
}

for await (const path of javascriptFiles('examples')) {
  const source = await readFile(path, 'utf8');
  const guideCount = source.match(/How it works:/g)?.length || 0;
  if (guideCount !== 1) {
    throw new Error(`${path} must contain exactly one How it works guide.`);
  }
  const described = [...source.matchAll(/STEP-(?<number>\d{2}) -/g)].map(
    (match) => match.groups.number,
  );
  const implemented = new Set(
    [...source.matchAll(/\/\/ STEP-(?<number>\d{2}):/g)].map((match) => match.groups.number),
  );
  described.forEach((number, index) => {
    const expected = String(index + 1).padStart(2, '0');
    if (number !== expected || !implemented.has(number)) {
      throw new Error(`${path} has an incomplete or non-sequential STEP-${number} guide.`);
    }
  });
  const describedSteps = new Set(described);
  for (const number of implemented) {
    if (!describedSteps.has(number)) {
      throw new Error(`${path} implements undocumented STEP-${number}.`);
    }
  }
}
console.log('JavaScript syntax checks passed.');
