---
'@trokky/mcp': patch
---

Adding a site no longer needs the agent to ask "have you approved?".

- `add_site` starts polling the site in the background as soon as it has a sign-in code, at the site's interval (backing off on `slow_down`), and saves the site the moment the user approves.
- Its result carries a line for the agent to copy into its reply: `Open <link> and check the code <code>.`
- `finish_add_site` now waits up to about 90 seconds for that background sign-in, and never more than 100. It returns `added` (with the site's name, URL and granted access), `waiting` (with the seconds left before the code expires; call it again), `denied` or `expired`. Denied and expired used to be errors; they are now results that say `add_site` starts a fresh sign-in.
- A sign-in in progress is kept in `mcp-sign-ins.json` next to the site list: the device code, never a token, private to the user. So `finish_add_site` still finishes it after the MCP server restarts.
- `npx @trokky/mcp login` uses the same polling, and now honours `slow_down`.
