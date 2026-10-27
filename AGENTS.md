# Project instructions

- Use JavaScript ES modules and Node.js 22.12+. Browser automation uses Puppeteer.
- Use `@captcha-solver-api/javascript-sdk` for CAPTCHA solving. Do not duplicate its HTTP client.
- Keep API keys in environment variables or ignored `.env`; never commit keys or artifacts.
- Demo targets live in `config/demos.js`. Update `docs/TESTING.md` after live verification.
- Keep every example understandable on its own: show SDK setup, task creation,
  solving, result logging, browser injection, and acceptance verification.
- Document every function with JSDoc and run `npm run lint` before committing.
- `npm run check` and `npm test` must pass. Local tests must not call the paid API.
- Live tests require explicit user authorization and use one attempt per example by default.
- Confirm page acceptance; receiving an API token alone does not prove success.
- Use English Conventional Commits.
