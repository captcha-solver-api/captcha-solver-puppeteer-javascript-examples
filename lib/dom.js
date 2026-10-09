/** Fill a hidden CAPTCHA response field and notify frameworks of the change. */
export async function fillResponse(page, name, token) {
  if (typeof token !== 'string' || !token) throw new Error(`No token returned for ${name}.`);
  await page.waitForSelector(`[name="${name}"]`);
  await page.evaluate((fieldName, value) => {
    const fields = document.getElementsByName(fieldName);
    if (!fields.length) throw new Error(`Response field ${fieldName} is missing.`);
    for (const field of fields) {
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, name, token);
}

/** Assert a visible success message; receiving a token alone is not a passed test. */
export async function waitForSuccess(page, selector = process.env.SUCCESS_SELECTOR || '.recaptcha-success, p[class*="successMessage"]') {
  const handle = await page.waitForFunction((css) => {
    for (const node of document.querySelectorAll(css)) {
      if (node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden' && node.textContent.trim()) {
        return node.textContent.trim();
      }
    }
    return false;
  }, {}, selector);
  try { return await handle.jsonValue(); } finally { await handle.dispose(); }
}

export async function submit(page) {
  const selector = process.env.SUBMIT_SELECTOR || 'button[type="submit"], input[type="submit"]';
  const button = await page.waitForSelector(selector, { visible: true });
  await button.scrollIntoView();
  await button.click();
}

/** Read the real widget parameters from the page instead of hardcoding a sitekey. */
export async function recaptchaParams(page) {
  await page.waitForSelector('[data-sitekey]');
  return page.$eval('[data-sitekey]', (node) => ({
    websiteKey: node.getAttribute('data-sitekey'),
    isInvisible: node.getAttribute('data-size') === 'invisible',
    recaptchaDataSValue: node.getAttribute('data-s') || undefined,
  }));
}

/** Invoke a named callback, including dotted names, without eval(). */
export async function callNamedCallback(page, name, token) {
  await page.evaluate((callbackName, value) => {
    const parts = callbackName.split('.');
    let owner = window;
    for (const part of parts.slice(0, -1)) owner = owner?.[part];
    const callback = owner?.[parts.at(-1)];
    if (typeof callback !== 'function') throw new Error(`Callback ${callbackName} not found.`);
    return callback.call(owner, value);
  }, name, token);
}

/** Find a v2 callback and retain its function in the page (not serialized to Node). */
export async function discoverRecaptchaCallback(page) {
  const handle = await page.waitForFunction(() => {
    const resolve = (name) => name.split('.').reduce((value, key) => value?.[key], window);
    const widget = document.querySelector('[data-sitekey][data-callback]');
    if (widget && typeof resolve(widget.dataset.callback) === 'function') {
      window.__captchaCallback = resolve(widget.dataset.callback);
      return { websiteKey: widget.dataset.sitekey, isInvisible: widget.dataset.size === 'invisible' };
    }
    const seen = new WeakSet();
    const visit = (value, depth) => {
      if (!value || typeof value !== 'object' || depth > 6 || seen.has(value) || value instanceof Node) return null;
      seen.add(value);
      if (typeof value.sitekey === 'string' && value.callback) {
        const callback = typeof value.callback === 'string' ? resolve(value.callback) : value.callback;
        if (typeof callback === 'function') {
          window.__captchaCallback = callback.bind(value);
          return { websiteKey: value.sitekey, isInvisible: value.size === 'invisible' };
        }
      }
      for (const key of Object.keys(value)) {
        let child;
        try { child = value[key]; } catch { continue; }
        const found = visit(child, depth + 1);
        if (found) return found;
      }
      return null;
    };
    return visit(window.___grecaptcha_cfg?.clients, 0);
  });
  try { return await handle.jsonValue(); } finally { await handle.dispose(); }
}

/** Read a fully loaded image at its original pixel dimensions, using canvas. */
export async function imageFromCanvas(page, selector) {
  await page.waitForFunction((css) => {
    const image = document.querySelector(css);
    return image?.complete && image.naturalWidth > 0;
  }, {}, selector);
  return page.$eval(selector, (image) => {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext('2d').drawImage(image, 0, 0);
    return { body: canvas.toDataURL('image/png').split(',')[1], width: canvas.width, height: canvas.height };
  });
}

/** Convert source-image coordinates to viewport positions; reject out-of-image answers. */
export function scaleCoordinates(points, image, box) {
  if (!Array.isArray(points) || !points.length || !box || image.width <= 0 || image.height <= 0) {
    throw new Error('Missing coordinates or image dimensions.');
  }
  return points.map(({ x, y }) => {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= image.width || y >= image.height) {
      throw new Error('API returned a coordinate outside the source image.');
    }
    return { x: box.x + x * box.width / image.width, y: box.y + y * box.height / image.height };
  });
}
