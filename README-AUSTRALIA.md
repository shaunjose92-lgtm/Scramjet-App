# Hosting location

Your current Render service is in Oregon, USA. Changes to DNS, timezone,
headers or the Cipher interface do not move that server or guarantee a
particular IP geolocation result.

The included `fly.toml` is an OPTIONAL configuration for Fly.io's Sydney region.
It does not migrate anything by itself and can incur charges. It is not needed
for the repair in START-HERE.md. This repair keeps the existing Render service.

Even an Australian datacentre IP may receive CAPTCHAs or rejected logins.
Only an actual end-to-end test can establish whether a particular site works.

If you separately choose another host, deploy and test it first, then change
Cipher's backend URL. `configure_cipher_endpoint.py` is an existing helper for
changing that URL and updating inline-script CSP hashes; it has not been run
as part of this repair. Keep your current service until the replacement works.

See START-HERE.md for the implemented repairs and exact validation limits.
