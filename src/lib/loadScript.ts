const _cache = new Map<string, Promise<any>>();

export const loadScript = async (src: string, attrs?: Record<string, string>): Promise<HTMLElement> => {
  if (!_cache.has(src)) {
    const _promise = new Promise<HTMLScriptElement>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;

      if (attrs) Object.entries(attrs).map(([k, v]) => script.setAttribute(k, v));

      script.onload = () => resolve(script);
      script.onerror = reject;

      document.head.appendChild(script);
    });

    _cache.set(src, _promise);
  }

  return _cache.get(src)!;
};
