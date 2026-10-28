# Cipher browser — Scramjet v2 upgrade

This package migrates Cipher from Scramjet 1.1.0 to 2.0.67-alpha.2,
controller 0.0.14, and libcurl transport 2.0.6. These exact versions are pinned
in package.json and the pnpm lockfile. The v2 release is an upstream alpha.

## Deploy

The connected GitHub integration rejects writes with HTTP 403. This package
has been tested locally but is NOT deployed until it is uploaded and Render
finishes deploying that commit.

1. Extract Cipher-Browser-Repair.zip.
2. Open https://github.com/shaunjose92-lgtm/Scramjet-App on branch main.
3. Choose Add file → Upload files from the repository ROOT.
4. Upload the extracted CONTENTS, including package.json, pnpm-lock.yaml,
   public, src, scripts, and tests. Do not upload the ZIP or an enclosing folder.
5. Commit. Render is configured to deploy main automatically.
6. Wait for that new deploy to show Live, then open:
   https://scramjet-app-bx7d.onrender.com/health/ready
   It must say engine: 2.0.67-alpha.2 and status: ready.
7. Close old Cipher browser tabs and reopen Cipher before testing Instagram.

Keep the current proxy URL and free Render plan. No change to the separate
EdgeOne Cipher HTML or Supabase is needed. Old unused v1 patch files left by
GitHub's upload interface are no longer imported and cannot alter v2.

## What changed

- Replace the v1 engine, worker/controller API and BareMux integration with
  the matching v2 engine/controller and direct libcurl transport.
- Remove v1 bundle rewrites; use upstream v2 session handling.
- Wait for the NEW service worker to activate and control the page, even if
  an old worker is still active during an upgrade.
- Preserve the isolation headers required for embedded pages in Chromium.
- Preserve Cipher's homepage, watermark and parent-window navigation bridge.
- Route GET links opened in new tabs through a new Cipher controller, retaining
  the session. POST bodies are not redirected through this link handler.
- Retain the existing Wisp upgrade handling and IPv4 DNS configuration.

Scramjet's maintainer reported newer-engine Instagram support here:
https://github.com/MercuryWorkshop/scramjet/issues/106#issuecomment-4527405309
This is a reason to test the upgrade, not evidence of a successful Cipher login.

## Verified locally

12 Node tests and source lint pass. A frozen-lockfile install succeeds.
Real Chromium at 390 × 844 passed the actual v2 → libcurl → Wisp pipeline:

- Form login with server-validated username/password, reserved characters and
  Unicode, plus a CSRF cookie/token; redirect and encoded HttpOnly session.
- Fetch POST JSON body, CSRF header and destination Origin remain correct.
- Response cookie synchronization and HttpOnly filtering.
- New-tab navigation retains the session in a new Cipher shell.
- Session survives stopping and restarting the service worker.
- Logout removes the session, with no page JavaScript exceptions.
- Cross-origin embedding, SPA history state, and Cipher back/forward messages.

Run pnpm test and pnpm lint with Node 22+.
The optional browser suite needs Playwright and Chromium, then:
node tests/browser-login.cjs
CIPHER_TEST_CHROMIUM can select an existing Chromium executable.
Only dummy credentials are used; the fixture rejects incorrect credentials.

## Limits and rollout notes

Actual Instagram, Snapchat and TikTok account login has NOT been verified.
This does not bypass CAPTCHAs or remove account/IP restrictions or Render's
free-plan resource limits. The 50-user workload has not been load-tested.

V2 uses a different browser cookie database. Users may need to sign in again
inside the proxy after upgrading. Cipher messaging accounts are unaffected.
The old v1 browser storage is not deleted.

The previously live commit is 58ff75a7d8ba84ab7adbd31dad24f4894c0194e1.
Keep it available for rollback if the upgraded browser causes regressions.
Do not announce social-login success until an actual account test succeeds.
