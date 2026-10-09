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

/** Capture TencentCaptcha constructor arguments and retain the page callback. */
export async function interceptTencent(page) {
  await page.evaluateOnNewDocument(() => {
    const records = new Map();
    const wrappers = new WeakMap();
    let constructor;
    let sequence = 0;

    const wrap = (Original, scriptUrl) => {
      if (typeof Original !== 'function') return Original;
      if (wrappers.has(Original)) return wrappers.get(Original);
      const Wrapped = new Proxy(Original, {
        construct(Target, args, newTarget) {
          const offset = typeof args[1] === 'function' ? 0 : 1;
          const appId = args[offset];
          const callback = args[offset + 1];
          if (!appId || typeof callback !== 'function') return Reflect.construct(Target, args, newTarget);
          const id = `tencent-${++sequence}`;
          const params = {
            id,
            websiteURL: location.href,
            appId: String(appId),
            captchaScript: scriptUrl || [...document.scripts]
              .map((script) => script.src)
              .find((src) => /\/TCaptcha-global\.js(?:\?|$)/i.test(src)),
          };
          const nativeArgs = [...args];
          nativeArgs[offset + 1] = () => {};
          const instance = Reflect.construct(Target, nativeArgs, newTarget);
          instance.show = () => {};
          records.set(id, { params, callback, submitted: false });
          return instance;
        },
      });
      wrappers.set(Original, Wrapped);
      wrappers.set(Wrapped, Wrapped);
      return Wrapped;
    };

    Object.defineProperty(window, '__captchaSolverTencent', { value: {
      pending: () => [...records.values()]
        .filter((record) => !record.submitted)
        .map((record) => record.params),
      submit(id, solution) {
        const record = records.get(id);
        if (!record || record.submitted) throw new Error('Tencent CAPTCHA callback is missing.');
        record.submitted = true;
        record.callback(solution);
      },
    } });

    const existing = window.TencentCaptcha;
    Object.defineProperty(window, 'TencentCaptcha', {
      configurable: true,
      enumerable: true,
      get: () => constructor,
      set: (value) => { constructor = wrap(value, document.currentScript?.src); },
    });
    if (existing) window.TencentCaptcha = existing;
  });
}
