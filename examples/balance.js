import { pathToFileURL } from 'node:url';
import { CaptchaClient } from '@captcha-solver-api/javascript-sdk';

/**
 * This example checks the current Captcha Solver account balance. It creates an SDK client,
 * requests the balance without creating a CAPTCHA task, and prints the returned amount.
 * It uses CaptchaClient.getBalance().
 *
 * How it works:
 * STEP-01 - Create the SDK client.
 * STEP-02 - Request and print the account balance.
 * STEP-03 - Report request errors.
 */

/** Request and print the current account balance. */
export function main() {
  // STEP-01: Create the SDK client with the API key from CAPTCHA_API_KEY.
  const client = new CaptchaClient({
    clientKey: process.env.CAPTCHA_API_KEY || 'YOUR_API_KEY',
  });

  // STEP-02: Request and print the account balance.
  return client.getBalance().then((balance) => {
    console.log('Balance:', balance);
    return balance;
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // STEP-03: Report request errors.
  main().catch((error) => {
    console.error('Example failed:', error.message);
    process.exitCode = 1;
  });
}
