# FIX THE HOSTING ISSUE — START HERE

## What is fixed in this ZIP
- Corrected Wisp DNS logic: normal system DNS is used by default and IPv4 is preferred; custom DNS IPs now activate the resolve mode instead of being silently ignored.
- Added a single-page server diagnostic at `/diagnostics.html` and a cached `/health/network` backend test for Whatnot, Instagram and eBay.
- Preserved browser error reporting, Australia-focused search and the Fly.io Sydney deployment configuration.
- No extra Node package dependencies.

## Updating your separate Render TEST server (easy)
1. Extract the ZIP; open `Scramjet-Australia`.
2. On GitHub open `shaunjose92-lgtm/Scramjet-App` and select branch `scramjet-fixes` (not `main`).
3. Upload and replace the matching files/folders from inside `Scramjet-Australia`; commit.
4. Open your new `scramjet-test` URL on Render and append `/diagnostics.html` to the URL.
5. This tells whether the *Render host* can reach Whatnot. If Whatnot says HTTP 500 here, it responded with HTTP 500 to a basic server request. If it says 200 while Whatnot fails in Scramjet, the problem involves the proxy/browser compatibility, site scripts, or site-specific security rules.

## What CAN'T be fixed by editing this ZIP
Render has no Australian region. Even your Singapore test server uses a datacenter IP. A browser timezone, DNS setting, or HTTP header will not give it a trusted Australian residential IP or remove CAPTCHAs. Moving hosting requires deploying the code onto an actual Sydney host and changing Cipher to point to it. We have NOT done that deployment.

## If you really want an Australian hosting region
Use `fly.toml` and the guide `README-AUSTRALIA.md` to create a new server in Fly.io's `syd` region. This may cost money. It will still have a *datacenter* IP, so Whatnot/Google may reject it. Do not replace your working Cipher backend until tested. No hosting provider can promise third-party CAPTCHA-free logins.

## What the diagnostic means
- `/health/ready` 200 = server and proxy assets present; it does **not** prove site loading works.
- `/health/network`: `network-error` = outbound connection trouble; `upstream-5xx` = destination returned a server error; 403/429 = possible restriction/rate limit; 200/3xx = basic reachability only.
- `[www/id:...]` seen on a Whatnot error page is a site error reference, not necessarily a Render error.

**Don't enter passwords or capture cookies in debugging output.**
