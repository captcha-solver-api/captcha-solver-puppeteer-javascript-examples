/** Install before navigation. Capture an execute() call and resolve it with the API token. */
export async function interceptRecaptchaV3(page) {
  await page.evaluateOnNewDocument(() => {
    const patch = (api) => {
      if (!api || api.__captchaPatched) return api;
      Object.defineProperty(api, '__captchaPatched', { value: true });
      Object.defineProperty(api, 'execute', {
        configurable: true,
        get: () => (sitekey, options = {}) => {
          window.__recaptchaV3 = { websiteKey: sitekey, pageAction: options.action };
          return new Promise((resolve) => { window.__resolveRecaptchaV3 = resolve; });
        },
        set: () => {},
      });
      return api;
    };
    let api = patch(window.grecaptcha);
    Object.defineProperty(window, 'grecaptcha', {
      configurable: true,
      get: () => api,
      set: (value) => { api = patch(value); },
    });
  });
}

/** Capture dynamic Turnstile fields and its callback as soon as render() is assigned. */
export async function interceptTurnstile(page) {
  await page.evaluateOnNewDocument(() => {
    const patch = (api) => {
      if (!api || api.__captchaPatched) return api;
      Object.defineProperty(api, '__captchaPatched', { value: true });
      let original = api.render;
      Object.defineProperty(api, 'render', {
        configurable: true,
        get: () => function (container, options) {
          window.__turnstileParams = {
            websiteURL: location.href,
            websiteKey: options.sitekey,
            action: options.action,
            data: options.cData,
            pagedata: options.chlPageData,
            userAgent: navigator.userAgent,
          };
          window.__turnstileCallback = options.callback;
          return original?.call(this, container, options);
        },
        set: (value) => { original = value; },
      });
      return api;
    };
    let api = patch(window.turnstile);
    Object.defineProperty(window, 'turnstile', {
      configurable: true,
      get: () => api,
      set: (value) => { api = patch(value); },
    });
  });
}
