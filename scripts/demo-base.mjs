// One normalized mount path for Astro, server-rendered links and the local preview.
export function demoBase(value = '') {
  const base = String(value).replace(/^\/+|\/+$/g, '');
  if (!base) return '';
  if (!/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(base)) throw new Error('DEMO_BASE must be a URL path such as /demos/family-tree');
  return '/' + base;
}
