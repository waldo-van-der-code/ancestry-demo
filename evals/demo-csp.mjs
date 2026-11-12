// The demo needs no third-party scripts, styles or fonts; only map tile images come from other hosts.
// The preview server sends this policy and the browser test asserts it, so a regression that adds a CDN dependency fails.
export const DEMO_CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'";
