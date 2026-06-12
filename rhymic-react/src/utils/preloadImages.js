const preloaded = new Set();

export function preloadImages(items, limit = 12) {
  if (!Array.isArray(items) || typeof window === 'undefined') return;

  items
    .map(item => (typeof item === 'string' ? item : item?.cover || item?.profile_pic))
    .filter(Boolean)
    .slice(0, limit)
    .forEach((src) => {
      if (preloaded.has(src)) return;
      preloaded.add(src);

      const img = new Image();
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.src = src;
    });
}
