import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { CaptchaClient, Tasks } from '@captcha-solver-api/javascript-sdk';

/**
 * This example shows how to solve a coordinate CAPTCHA. It reads a local image, adds an
 * instruction describing which objects to select, sends the task to the service, and prints the
 * returned click coordinates. It uses Tasks.CoordinatesTask and CaptchaClient.solve().
 *
 * How it works:
 * STEP-01 - Create the SDK client.
 * STEP-02 - Read the image and create the coordinate task.
 * STEP-03 - Send the task and wait for the solver result.
 * STEP-04 - Print the click coordinates or report an error.
 */

// STEP-01: Create the SDK client with the API key from CAPTCHA_API_KEY.
const client = new CaptchaClient({
  clientKey: process.env.CAPTCHA_API_KEY || 'YOUR_API_KEY',
});

// STEP-02: Read the image and create the task with a base64 body and click instruction.
const task = new Tasks.CoordinatesTask({
  body: readFileSync(new URL('../assets/coordinates-captcha.png', import.meta.url)).toString(
    'base64',
  ),
  comment: 'Click on all squares with street signs',
});

/** Create, solve, and print the coordinate task. */
export function main() {
  return (
    client
      // STEP-03: Send the coordinate task and wait for the solver result.
      .solve(task)
      .then((solution) => {
        // STEP-04: Print coordinates in the original image's x/y coordinate system.
        console.log(solution.coordinates);
        // Use browser automation to click the original image at each returned x/y coordinate.
        return solution;
      })
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
