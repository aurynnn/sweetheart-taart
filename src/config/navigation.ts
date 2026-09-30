// src/config/navigation.ts — Main site navigation, shared by the desktop header and the mobile menu.

export const NAV_LINKS = [
  { href: '/', label: 'Home', icon: 'fa-house' },
  { href: '/feestcollectie', label: 'Feestcollectie', icon: 'fa-cake-candles' },
  { href: '/mini-collectie', label: 'Mini-collectie', icon: 'fa-ice-cream' },
  { href: '/koekjescollectie', label: 'Koekjes', icon: 'fa-cookie-bite' },
  { href: '/tips', label: 'Tips', icon: 'fa-lightbulb' },
] as const;

/** True when `href` is the page being viewed (ignores a trailing slash) */
export function isCurrent(href: string, pathname: string) {
  const clean = (p: string) => (p.length > 1 ? p.replace(/\/$/, '') : p);
  return clean(href) === clean(pathname);
}
