# Cipher browser repair — install this update

This update keeps your existing Cipher browser, branding and Render free plan.
Local validation is described below. Check Render for the live deployment status.

## Update GitHub (no terminal needed)
1. Extract `Cipher-Browser-Repair.zip`.
2. Open https://github.com/shaunjose92-lgtm/Scramjet-App and select **main**.
3. Choose **Add file → Upload files**.
4. Drag the FILES AND FOLDERS INSIDE the extracted folder into GitHub. Include
   `src`, `public`, `scripts`, `tests`, `package.json` and `pnpm-lock.yaml`.
   Do not upload only the README, the ZIP itself, or an extra enclosing folder.
5. Commit the upload. Render's current configuration auto-deploys `main`.
6. Wait until Render reports the new deploy is **Live**.
7. Open https://scramjet-app-bx7d.onrender.com/diagnostics.html and run checks.
8. Refresh Cipher. Its existing backend URL does not need to change.

## What this repairs
- Wait for the service worker to activate and control the page before navigation.
- Refresh the transport's Wisp settings each startup, instead of checking only
  whether a transport module with the same name already exists.
- Accept `/wisp/` URLs with query strings and catch upgrade failures.
- Enable Wisp error logging and add request IDs for backend request failures.
- Use system DNS with IPv4 preferred; the previous custom DNS addresses were
  ignored by Wisp's default lookup mode.
- Add `/health/ready`, `/health/network` and `/diagnostics.html`.
- Pin the existing Scramjet release archive's SHA-512 integrity in the lockfile.
- Specify Node 22 or later, matching the application's current dependencies.

## Understanding the diagnostic
- **Browser files: ready**: required proxy assets are present.
- **Connection tunnel: Connected**: the Wisp WebSocket handshake succeeded.
- **reachable**: a basic server request returned 2xx/3xx, not a verified login.
- **upstream-5xx**: the destination returned a 5xx response to that probe.
- **restricted**: the destination returned 403/429; restrictions or rate limits
  are possible explanations, not confirmed causes.
- **network-error**: the probe could not complete (including timeout).

Probes use fixed destinations only, have an eight-second timeout, and share
results for one minute to limit load. They do not use user accounts or cookies.
No public diagnostic response includes credentials or raw exception messages.
Wisp error logs can include connection-level failure details and hostnames.

## What stays unresolved
Render Free still sleeps when idle. This patch cannot remove that policy,
change your Oregon server into an Australian server, or guarantee that social
media sites will accept its shared datacentre IP. The reported Iran location
and actual Whatnot login/HTTP 500 failure have not been reproduced.
The separate EdgeOne-hosted Cipher HTML is not modified by this update.

## Validation completed
Seven Node tests pass: readiness/assets and live Wisp upgrade, worker setup,
network-result classification, cache/concurrency and exception sanitisation.
A Chromium test at 390 × 844 verified the diagnostic display, actual Wisp
handshake, service-worker control, no horizontal overflow, and no startup JS
errors. HTTP 500 display was tested with a simulated network-probe response.
Server source lint checks pass. Social-account login was not tested.

`pnpm test` runs the included tests. `pnpm diagnose` probes the three fixed
sites from the machine where the command runs. Use Node 22+.
