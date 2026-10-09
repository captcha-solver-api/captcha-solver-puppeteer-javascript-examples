# Before making the repository public

- Replace temporary demo URLs in `config/demos.js` with our own pages. Keep the
  official Google reCAPTCHA v2 demo where appropriate.
- Update page-specific selectors and callback names, then rerun every live flow.
- Search tracked files for the temporary demo provider's name and remove obsolete
  references. Do not publish local artifacts, screenshots, keys, or `.env` files.
- Test both proxy examples with a working proxy and record the result.
- Resolve or explicitly document every failed live check in `TESTING.md`.
- Update README to describe the final public setup.
- Change repository visibility only after an explicit release decision.

Changing files does not remove the temporary URLs from Git history. If the public
repository must contain no historical references either, publish a clean initial
snapshot at release time rather than merely changing this repository's visibility.
