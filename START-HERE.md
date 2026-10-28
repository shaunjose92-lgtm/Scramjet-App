# Cipher browser repair

This update fixes confirmed page-loading and login-session defects in the
existing Cipher browser. It keeps the current branding, URL and Render free plan.
The code is ready to deploy; it has not been published to the live service.

## Actual fixes
- Preserve percent-encoded session tokens instead of silently changing them.
- Restore saved cookies correctly when the service worker restarts.
- Persist server-set cookies, including HttpOnly sessions, before redirects.
- Synchronize actual response cookies to pages instead of array-index strings.
- Apply Max-Age expiry and logout deletion, host-only cookies, and domain/path boundaries.
- Stop requests hanging indefinitely when a closed page cannot acknowledge cookies.
- Add the isolation headers required to display proxied pages in Chrome.
- Make concurrent requests wait for engine initialization to finish.
- Wait for worker activation and page control before the first navigation.
- Reconfigure the Wisp transport each startup so stale settings are replaced.
- Accept Wisp URLs containing query strings and handle failed upgrades.
- Prefer IPv4 through system DNS and correct the DNS cache duration from 120 milliseconds to 30 seconds.
- Verify the pinned engine archive and check required assets before declaring readiness.

The cookie and initialization patches apply only to the exact Scramjet 1.1.0
bundle verified by SHA-256. The original dependency is untouched; the server
builds a patched copy when it starts. A different engine bundle fails with a
clear startup error instead of receiving incompatible edits. Review these
patches before upgrading Scramjet.

## Deploy using GitHub (no terminal needed)
1. Extract `Cipher-Browser-Repair.zip`.
2. Open https://github.com/shaunjose92-lgtm/Scramjet-App and select **main**.
3. Choose **Add file → Upload files**.
4. Drag the files and folders INSIDE the extracted folder into GitHub, including
   `src`, `public`, `scripts`, `tests`, `package.json` and `pnpm-lock.yaml`.
   Do not upload the ZIP itself or an extra enclosing folder.
5. Commit the upload. Render's current configuration auto-deploys `main`.
6. Wait until Render reports the new deploy is **Live**.
7. Refresh Cipher. Its existing backend URL does not need to change.

The connected GitHub integration rejected writes with HTTP 403, so these
changes could not be committed remotely or automatically deployed from this session.

## Validation
16 Node tests pass, covering the reproduced original cookie defects, token
preservation, expiry/logout, domain/path isolation, engine initialization,
closed-client handling, response headers, server readiness, Wisp upgrade,
worker activation and the existing diagnostic checks. Source lint passes.

A real Chromium browser at 390 × 844 passed all four local login scenarios
through the actual Scramjet → BareMux → libcurl → Wisp → HTTP pipeline:
1. Form POST login and redirect using a percent-encoded HttpOnly session.
2. Fetch response cookie synchronization and document.cookie HttpOnly filtering.
3. Session preservation after stopping and restarting the service worker.
4. Logout deletion with no page JavaScript exceptions.

The dummy login fixture is included. Run `pnpm test` for the Node tests.
For the optional full browser test, install Playwright and Chromium in your
development environment, then run `node tests/browser-login.cjs`.
`CIPHER_TEST_CHROMIUM` can select an existing Chromium executable.
Use Node 22 or later. No real accounts or passwords are used by these tests.

## Limits
These repairs do not bypass CAPTCHAs, change a destination site's decisions
about Render's IP, remove Render Free's idle sleep, or relocate the server.
Actual Whatnot/social-account login has not been verified. The reported Iran
location and destination HTTP 500 failure have not been reproduced.
The separate EdgeOne-hosted Cipher HTML is unchanged.

## Existing troubleshooting page
`/diagnostics.html` checks required files, the Wisp connection and basic access
to three fixed destinations. A reachable result does not prove login works.
Probes time out after eight seconds and share results for one minute. They
never use user accounts or cookies. Public responses omit raw exceptions.
Wisp error logs can contain connection-level failure details and hostnames.
`pnpm diagnose` runs those probes from the machine where the command executes.
