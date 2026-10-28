// Browser-safe factory embedded into the pinned Scramjet 1.1.0 bundle.
export function createCookieStore(parse) {
  return class CipherCookieStore {
    cookies = Object.create(null);
    setCookies(headers, url) {
      for (const header of headers) {
        const cookie = parse(header, { decodeValues: false, silent: true })[0];
        if (!cookie?.name) continue;
        const suppliedDomain = cookie.domain;
        const domain = (suppliedDomain || url.hostname).replace(/^\./, '').toLowerCase();
        if (url.hostname !== domain && !url.hostname.endsWith('.' + domain)) continue;
        if (suppliedDomain && !domain.includes('.') && domain !== url.hostname) continue;
        cookie.domain = '.' + domain;
        cookie.hostOnly = !suppliedDomain;
        if (!cookie.path?.startsWith('/')) {
          const lastSlash = url.pathname.lastIndexOf('/');
          cookie.path = lastSlash > 0 ? url.pathname.slice(0, lastSlash) : '/';
        }
        cookie.sameSite ||= 'lax';
        const key = `${cookie.domain}@${cookie.path}@${cookie.name}`;
        if (Number.isFinite(cookie.maxAge)) {
          if (cookie.maxAge <= 0) { delete this.cookies[key]; continue; }
          cookie.expires = new Date(Math.min(Date.now() + cookie.maxAge * 1000, 8640000000000000)).toISOString();
        } else if (cookie.expires) {
          const timestamp = new Date(cookie.expires).getTime();
          if (Number.isFinite(timestamp)) cookie.expires = new Date(timestamp).toISOString();
          else delete cookie.expires;
        }
        this.cookies[key] = cookie;
      }
    }
    getCookies(url, fromJs) {
      const valid = [];
      for (const [key, cookie] of Object.entries(this.cookies)) {
        if (!cookie || typeof cookie.name !== 'string' || typeof cookie.domain !== 'string') continue;
        if (cookie.expires && Date.parse(cookie.expires) <= Date.now()) { delete this.cookies[key]; continue; }
        if (cookie.secure && url.protocol !== 'https:') continue;
        if (cookie.httpOnly && fromJs) continue;
        const domain = cookie.domain.replace(/^\./, '').toLowerCase();
        if (cookie.hostOnly ? url.hostname !== domain : url.hostname !== domain && !url.hostname.endsWith('.' + domain)) continue;
        const path = cookie.path || '/';
        if (url.pathname !== path && !(url.pathname.startsWith(path) && (path.endsWith('/') || url.pathname[path.length] === '/'))) continue;
        valid.push(cookie);
      }
      valid.sort((a,b) => (b.path || '/').length - (a.path || '/').length);
      return valid.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
    }
    load(value) {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) this.cookies = Object.assign(Object.create(null), parsed);
    }
    dump() { return JSON.stringify(this.cookies); }
  };
}
