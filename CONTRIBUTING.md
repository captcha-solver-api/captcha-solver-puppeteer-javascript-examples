# Contributing

Thank you for helping improve these examples. They are written for readers who
may be new to JavaScript browser automation, so clarity is more important than
removing a few repeated lines.

## Development setup

1. Install Node.js 22.12 or newer.
2. Run `npm ci`.
3. Copy `.env.example` to `.env` only when manually running an example.
4. Run `npm run check` and `npm test` before opening a pull request.

Local tests use a local web page and API stub. They must never call the paid API.
Do not commit API keys, proxy credentials, `.env`, screenshots, or test artifacts.

## Example guidelines

- Use JavaScript ES modules, Puppeteer Extra, and the stealth plugin.
- Use `@captcha-solver-api/javascript-sdk`; do not implement another API client.
- Begin each example with a short explanation of the CAPTCHA and the complete flow.
- Keep task creation, solving, result logging, browser injection, submission, and
  acceptance verification easy to find in the example file.
- Do not make one example call another example or hide its main steps in shared
  runtime helpers. Deliberate repetition keeps each file copyable.
- Add JSDoc to every function.
- Prefer straightforward code over abstraction when abstraction makes an example
  harder to copy and adapt.

## Pull requests

Keep each pull request focused, explain how it was tested, and use English
Conventional Commits such as `feat: add stealth browser setup`. Live checks must
be authorized by a maintainer and recorded in `docs/TESTING.md` only after the
target page confirms that it accepted the solution.

By participating, you agree to follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
