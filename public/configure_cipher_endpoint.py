"""Switch Cipher HTML to a deployed Australian Scramjet service.

Usage: python configure_cipher_endpoint.py Cipher-Scramjet-Fix.html https://MY-SERVER.fly.dev

This utility also refreshes the strict inline-script CSP SHA-256 hashes that
would otherwise break when an inline script is edited.
"""
from __future__ import annotations
import base64
import hashlib
from pathlib import Path
import re
import sys
from urllib.parse import urlsplit

OLD_HOST = 'scramjet-app-bx7d.onrender.com'

def change_endpoint(html: str, base_url: str) -> str:
    target = urlsplit(base_url.rstrip('/'))
    if (target.scheme != 'https' or not target.hostname or target.username or
        target.password or target.path or target.query or target.fragment):
        raise ValueError('Use the HTTPS origin only, for example https://my-sydney-app.fly.dev')
    if OLD_HOST not in html:
        raise ValueError('Could not find the original Scramjet endpoint in this file.')
    # Replace both origin references and the hostname-only self-proxy guard.
    html = html.replace(OLD_HOST, target.netloc)
    # The new backend verifies that browser JS/WASM files exist. Cipher should
    # check this endpoint rather than interpreting any HTTP 200 HTML homepage
    # as proof that the proxy transport is healthy. Keep old-format HTML usable.
    html = html.replace("fetch(URL_,{mode:'cors',cache:'no-store',signal:ctrl.signal})",
                        "fetch(URL_+'health/ready',{mode:'cors',cache:'no-store',signal:ctrl.signal})")
    html = html.replace("fetch(URL_,{mode:'no-cors',cache:'no-store',signal:ctrl.signal})",
                        "fetch(URL_+'health/ready',{mode:'no-cors',cache:'no-store',signal:ctrl.signal})")

    inline = []
    for m in re.finditer(r'<script\b([^>]*)>(.*?)</script\s*>', html, re.IGNORECASE | re.DOTALL):
        if not re.search(r'\bsrc\s*=', m.group(1), re.IGNORECASE):
            inline.append(m.group(2))
    hashes = ["'sha256-" + base64.b64encode(hashlib.sha256(s.encode('utf-8')).digest()).decode() + "'"
              for s in inline]

    csp_meta = re.compile(r'(<meta\s+http-equiv="Content-Security-Policy"\s+content=")([^"]*)(")', re.I)
    match = csp_meta.search(html)
    if not match:
        raise ValueError('Cannot find Cipher CSP meta tag; refusing to output an unverified file.')
    policy = match.group(2)
    def update_script_src(src_match: re.Match) -> str:
        script_src = re.sub(r"\s*'sha256-[A-Za-z0-9+/=]+'", '', src_match.group(0))
        return "script-src 'self' " + ' '.join(hashes) + script_src.removeprefix("script-src 'self'")
    new_policy, count = re.subn(r'script-src\s+[^;]+', update_script_src, policy, count=1)
    if count != 1:
        raise ValueError('Cannot locate script-src policy; refusing to output an unverified file.')
    html = html[:match.start(2)] + new_policy + html[match.end(2):]
    return html

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print('Usage: python configure_cipher_endpoint.py Cipher-Scramjet-Fix.html https://MY-APP.fly.dev', file=sys.stderr)
        sys.exit(2)
    src = Path(sys.argv[1]); base_url = sys.argv[2]
    changed = change_endpoint(src.read_text(encoding='utf-8'), base_url)
    dest = src.with_name(src.stem + '-Australia.html')
    dest.write_text(changed, encoding='utf-8')
    print(f'Updated Cipher to {base_url}\nSaved: {dest}')
