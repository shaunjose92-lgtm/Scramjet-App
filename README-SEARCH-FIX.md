# Cipher Browser: reducing Google robot prompts

## What changed
- Normal searches now use Bing with the `en-AU` market setting, rather than Google Search.
- Typing **whatnot**, **instagram**, **ebay**, **youtube**, or **reddit** alone goes to the website directly instead of first searching Google.
- Typing a bare domain uses HTTPS by default.
- Dockerfile no longer requires the optional `scripts` directory during container builds, avoiding a previous missing-folder error on Render.

This does **not** remove any CAPTCHA or access restriction shown by Google or another website, and it does **not** fix Whatnot's HTTP 500 error. Those responses are controlled by the destination service and/or the upstream proxy connection. Bing can also issue verification challenges.

## Safely apply to your existing test Render deployment
1. Keep GitHub on the `scramjet-fixes` branch, **not `main`**.
2. Extract this ZIP, open the `Scramjet-Australia` folder, and upload its **contents** to the root of the GitHub test branch (not the ZIP or a nested `Scramjet-Australia` folder).
3. Commit the changes. Render may auto-deploy. Otherwise, on **scramjet-test** select **Manual Deploy > Deploy latest commit**.
4. Test the search box: type `whatnot` and check that no Google search page appears. The Whatnot site itself may still show HTTP 500.

If you want the smallest possible change, edit `public/index.html` on GitHub, find `https://www.google.com/search?q=%s`, and replace the hidden input's value with `https://www.bing.com/search?q=%s&amp;mkt=en-AU`. That alone changes the default search engine, but doesn't provide the brand-name direct shortcuts.
