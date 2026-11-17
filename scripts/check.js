import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { basename } from 'node:path';

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

const examplePaths = [];
for await (const path of javascriptFiles('examples')) {
  examplePaths.push(path);
  const source = await readFile(path, 'utf8');
  const forbiddenPatterns = [
    [/\basync\b|\bawait\b/, 'must use a Promise chain instead of async/await'],
    [/_finallyRethrows|Promise\.resolve\(/, 'contains generated Promise wrapper code'],
    [/(?:match|args)\[\d+\]/, 'contains a magic positional index'],
  ];
  for (const [pattern, message] of forbiddenPatterns) {
    if (pattern.test(source)) throw new Error(`${path} ${message}.`);
  }
  const guideCount = source.match(/How it works:/g)?.length || 0;
  if (guideCount !== 1) {
    throw new Error(`${path} must contain exactly one How it works guide.`);
  }
  const described = [...source.matchAll(/STEP-(?<number>\d{2}) -/g)].map(
    (match) => match.groups.number,
  );
  const implementedList = [...source.matchAll(/\/\/ STEP-(?<number>\d{2}):/g)].map(
    (match) => match.groups.number,
  );
  const implemented = new Set(implementedList);
  const duplicateSteps = implementedList.filter(
    (number, index) => implementedList.indexOf(number) !== index,
  );
  if (duplicateSteps.some((number) => number !== described.at(-1))) {
    throw new Error(`${path} implements a non-final STEP more than once.`);
  }
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

  if (source.includes("from 'puppeteer-extra'")) {
    if (!source.includes('.catch(') || !source.includes('.finally(')) {
      throw new Error(`${path} must handle errors and close Chromium in its Promise chain.`);
    }
    if (
      !/Token injection and submission are site-specific|Solution submission is site-specific/.test(
        source,
      )
    ) {
      throw new Error(`${path} must explain its site-specific solution application.`);
    }
    if (!source.includes('Page confirmation:')) {
      throw new Error(`${path} must log page acceptance separately from the solver result.`);
    }
  }
}

const packageJSON = JSON.parse(await readFile('package.json', 'utf8'));
const readme = await readFile('README.md', 'utf8');
for (const path of examplePaths) {
  const name = basename(path, '.js');
  const hasScript = Object.values(packageJSON.scripts).some((command) => command.endsWith(path));
  if (!hasScript) throw new Error(`${path} has no npm run command.`);
  if (!readme.includes(`(examples/${name}.js)`)) {
    throw new Error(`${path} is missing from the README example table.`);
  }
}

const envTemplate = await readFile('.env.example', 'utf8');
const configuredEnvironmentNames = new Set(
  [...envTemplate.matchAll(/^(?<name>[A-Z][A-Z0-9_]*)=/gm)].map((match) => match.groups.name),
);
for (const path of examplePaths) {
  const source = await readFile(path, 'utf8');
  for (const match of source.matchAll(/process\.env\.(?<name>[A-Z][A-Z0-9_]*)/g)) {
    if (!configuredEnvironmentNames.has(match.groups.name)) {
      throw new Error(`${match.groups.name}, used by ${path}, is missing from .env.example.`);
    }
  }
}
console.log('JavaScript syntax checks passed.');
