import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';

/** Solve a task with the SDK and log the task ID returned by createTask(). */
function solveAndLogTaskId(solver, task) {
  const loggingSolver = Object.create(solver);
  loggingSolver.createTask = (...args) =>
    solver.createTask(...args).then((taskId) => {
      console.log('Task ID:', taskId);
      return taskId;
    });
  return loggingSolver.solve(task);
}

/**
 * This example solves the image-selection stage of Yandex SmartCaptcha. It reads the challenge
 * and instruction images, creates Tasks.YandexSmartCaptchaImageTask, sends it through
 * CaptchaClient.solve(), and prints the returned click coordinates.
 *
 * To adapt this example, replace both sample images with images from the same challenge. Applying
 * returned coordinates is site-specific: inspect the target widget, its scaling, and click flow.
 *
 * How it works:
 * STEP-01 - Create the SDK client.
 * STEP-02 - Read the challenge and instruction images.
 * STEP-03 - Create and send the Yandex SmartCaptcha image task.
 * STEP-04 - Print the returned coordinates or report an error.
 */

/**
 * Read both sample images, solve the Yandex image task, and print its result.
 * @param {CaptchaClient} [solver] Configured client, primarily for local testing.
 * @returns {Promise<import('@captcha-solver-api/javascript-sdk').CoordinatesSolution>} Solution.
 */
export function main(solver) {
  // STEP-01: Create the SDK client with the API key from CAPTCHA_API_KEY.
  const client =
    solver ||
    new CaptchaClient({
      clientKey: process.env.CAPTCHA_API_KEY || 'YOUR_API_KEY',
    });

  // STEP-02: Read both images without printing their base64 contents.
  return Promise.all([
    readFile(new URL('../../assets/yandex-smartcaptcha-main.png', import.meta.url)),
    readFile(new URL('../../assets/yandex-smartcaptcha-task.png', import.meta.url)),
  ])
    .then(([body, instructions]) => {
      // STEP-03: Create and send the dedicated Yandex SmartCaptcha image task.
      const task = new Tasks.YandexSmartCaptchaImageTask({
        image: body.toString('base64'),
        imgInstructions: instructions.toString('base64'),
        comment: 'Select objects in the order shown in the instruction image',
      });
      return solveAndLogTaskId(client, task);
    })
    .then((solution) => {
      // STEP-04: Print coordinates; applying them in a widget is unique to each target site.
      console.log(solution.coordinates);
      return solution;
    });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
