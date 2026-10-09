# Project instructions

- Use JavaScript ES modules and Node.js 22.12+. Browser automation uses Puppeteer.
- Use `@captcha-solver-api/javascript-sdk` for CAPTCHA solving. Do not duplicate its HTTP client.
- Keep API keys in environment variables or ignored `.env`; never commit keys or artifacts.
- This repository is private during development. Do not change its visibility without approval.
- Demo targets live in `config/demos.js`. Update `docs/TESTING.md` after live verification.
- `npm run check` and `npm test` must pass. Local tests must not call the paid API.
- Live tests require explicit user authorization and use one attempt per example by default.
- Confirm page acceptance; receiving an API token alone does not prove success.
- Use English Conventional Commits.
