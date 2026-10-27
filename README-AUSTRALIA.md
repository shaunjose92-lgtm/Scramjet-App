# Cipher Scramjet — fixes for site loading, HTTP 500 reporting and Australian hosting

## Why location cannot be changed inside Render
Render currently provides no Australia hosting region. Websites see the public IP
of the server making the outbound Wisp requests, not a client-side timezone or
locale setting. Changing HTML, Accept-Language, DNS or a "country" variable
**cannot** make the existing Render server's IP Australian.

This project is configured to deploy to the `syd` (Sydney, Australia) region on
Fly.io. It cannot be automatically migrated from Render without deploying it to
your own Fly account. The host's public IP is a shared datacenter IP, not a
residential IP, so some websites may still reject it or require challenges.
This does not defeat Google's rules against proxy/embedded sign-ins.

## Deploy in Sydney
1. Make a Fly.io account at https://fly.io/ and check their current pricing.
2. Install the Fly CLI: https://fly.io/docs/flyctl/install/
3. Open a terminal inside this extracted `Scramjet-Australia` directory.
4. Run:

   ```sh
   fly auth login
   fly launch --region syd --no-deploy
   ```

   Select or retain the existing `fly.toml` settings and confirm that
   `primary_region = "syd"` remains in the resulting file.
   The app name must be unique; Fly Launch will choose/ask for one.
5. Deploy:

   ```sh
   fly deploy
   fly status
   ```

6. Open your new HTTPS URL (`https://YOUR-APP-NAME.fly.dev/`) and verify
   `https://YOUR-APP-NAME.fly.dev/health/ready` returns `"status":"ready"` and
   `"hostingRegion":"syd"`. If missing, check `fly logs`.
7. **Critical:** Update your Cipher HTML to use your *actual* new Fly URL.
   In the same directory as the HTML you want to update, run:

   ```sh
   python configure_cipher_endpoint.py Cipher-Scramjet-Fix.html https://YOUR-APP-NAME.fly.dev
   ```

   Replace `YOUR-APP-NAME` with your real deployed app name and use the actual
   filename for your Cipher HTML. Copy the script into the HTML's folder first,
   or supply its full path. The script writes `Cipher-Scramjet-Fix-Australia.html`.
   It changes the browser origin, updates the hostname-based safety check,
   updates the startup probe to `/health/ready`, updates CSP `connect-src`,
   and **recalculates all inline-script CSP hashes**.
   Upload this resulting HTML in place of your previous Cipher HTML to switch.
   Keep the old service active until the Sydney service and Cipher integration work.

**Costs:** This configuration keeps one Fly machine awake in Sydney (for consistent
proxy availability), which may incur continuous charges. Use `min_machines_running = 0`
if you prefer idle suspension and are willing to accept cold starts.

## What was repaired in this backend

These are real code fixes, not just a hosting-region change:

- **Wisp / WebSocket:** browser checks that `/wisp/` actually accepts WebSocket connections; the server recognises the route by URL path and logs upgrade failures.
- **DNS:** replaced the filtering-specific `1.1.1.3,1.0.0.3` with the standard `1.1.1.1,1.0.0.1` resolver defaults. Override with `SCRAMJET_DNS_SERVERS` if needed.
- **Proxy transport:** always refreshes BareMux's libcurl/Wisp URL when the browser starts. This prevents reusing a stale transport from before migration.
- **Service worker:** waits for activation before launching a site, activates the updated worker on deployment, and reports document HTTP 5xx and network failures separately.
- **HTTP 500 diagnostics:** server errors receive a request ID in the error response and are logged; Wisp error logging is no longer disabled. Failed site requests produce a warning without closing an otherwise working page.
- **Cipher connectivity:** the original Cipher host is allowed to inspect the real HTTP status of `GET /` rather than receiving an opaque response with hidden status.
- **Hosting readiness:** `/health/ready` returns 503 if the essential browser files are missing.

The app itself is **not yet deployed or end-to-end tested against Whatnot, Instagram or eBay**. A website can return its own 500 or bot-check failure even when the proxy is healthy.

## Diagnostics after deployment

Run `node --test tests/*.test.mjs` locally with Node.js 22 to verify the browser-runtime failure paths (no downloads required for these tests). Check the server:

```sh
curl -i https://YOUR-APP-NAME.fly.dev/health/ready
```

The response should be HTTP 200 and `"status":"ready"`. A 503 response lists missing app resources.

After `fly deploy`, run the outbound network probe **on the deployed server**:

```sh
fly ssh console -C "node scripts/diagnose.mjs"
```

This tests outbound HTTPS reachability to Whatnot, Instagram, eBay and Google's login endpoint. A successful HTTPS response does **not** prove the website will render inside Scramjet or permit authentication. If it reports 403/429, the destination may be restricting traffic; that is not repaired by changing an HTTP header or lying about the user's location.

With the affected page open, inspect browser DevTools (F12) → Network for a failed `/wisp/` WebSocket or `/scram/` request and compare with `fly logs`. Report the exact time and **sanitised** error, not cookies, authentication tokens or passwords.

### If you still use Render

The backend source fixes work on Render too after you deploy them there, but the server IP will still be in its Render hosting region. To let Cipher check the HTTP status from any other first-party origin, set `CIPHER_ALLOWED_ORIGINS` to a comma-separated list of HTTPS origins (no trailing slash), for example:

```sh
CIPHER_ALLOWED_ORIGINS=https://cipher-message.edgeone.dev,https://your-own-cipher-domain.example
```

This does not grant websites third-party cookie privileges and cannot make unsupported embedded Google OAuth work.

## Validate Australian network exit
While a site is loaded through Scramjet, requests travel via the Wisp server.
Checking the `hostingRegion` field demonstrates where the server is deployed,
not what every site's anti-fraud system sees. To confirm the country of the
*actual public exit IP*, use an IP-lookup page through the proxied browser and
verify its country is Australia. Region or timezone configuration alone cannot
guarantee geolocation database classification.

## Important limits
- This update is a **deployment configuration**, not a live relocation.
- It does not guarantee Whatnot, Instagram, eBay, Google OAuth or anti-bot access.
- Public proxies may face restrictions or require approval by destination sites.
- Do not add fake device fingerprints, bypass CAPTCHA, or collect login credentials.

## Initial Sydney packaging changes
- Added `fly.toml` with Sydney region, TLS and WebSocket-capable HTTP service.
- Fixed Dockerfile: your original required a nonexistent `package-lock.json` and
  used Node 18 even though Fastify 5 requires Node 20+.
- Added `/health` response showing the real `FLY_REGION` from the host.
- Excluded `.git` history from the distributed ZIP.
- Preserved your custom Cipher Browser frontend and repaired its transport startup and error handling.
