# @trokky/mcp

## 3.5.4

### Patch Changes

- 433cef3: Adding a site no longer needs the agent to ask "have you approved?".

  - `add_site` starts polling the site in the background as soon as it has a sign-in code, at the site's interval (backing off on `slow_down`), and saves the site the moment the user approves.
  - Its result carries a line for the agent to copy into its reply: `Open <link> and check the code <code>.`
  - `finish_add_site` now waits up to about 90 seconds for that background sign-in, and never more than 100. It returns `added` (with the site's name, URL and granted access), `waiting` (with the seconds left before the code expires; call it again), `denied` or `expired`. Denied and expired used to be errors; they are now results that say `add_site` starts a fresh sign-in.
  - A sign-in in progress is kept in `mcp-sign-ins.json` next to the site list: the device code, never a token, private to the user. So `finish_add_site` still finishes it after the MCP server restarts.
  - `npx @trokky/mcp login` uses the same polling, and now honours `slow_down`.

- 467b4b9: `remove_site` points to the right place when it cannot revoke a sign-in: Studio's Preferences > Connected applications, not "Account > Connected applications", which does not exist.

## 3.5.3

## 3.5.2

### Patch Changes

- ae1f176: `@trokky/mcp` works on several sites, signed in through the browser instead of with a
  hand-made token.

  Ask the agent to add a site (`add_site` with its URL) or run
  `npx @trokky/mcp login <url>`: open the link, check the code, untick any access you don't
  want to give, and approve. Every content tool takes an optional `site`; `list_sites`,
  `set_default_site` and `remove_site` manage them. Sessions renew themselves.

  Sites live in `~/.trokky/config.yaml`, the Trokky CLI's file, so a site signed in with either
  tool works in both. The two follow one lock-and-rename protocol, so neither loses the other's
  writes or token renewals. `TROKKY_URL` with `TROKKY_TOKEN` still pins one site with an API
  token.

  Trokky gains a built-in OAuth2 client, `trokky-mcp`, so the consent screen names the
  requester "Trokky MCP (AI agent)". Like the CLI's, it cannot be made trusted.

  A sign-in tells the site who is asking: `trokky-mcp/3.5.2 (claude-code; macOS; laptop-name)`
  (or `trokky-cli/...` from the CLI) appears under Connected applications, so two machines or
  two agents can be told apart before revoking one. The machine name is sent only with the
  sign-in, not with every request.

## 3.5.1

### Patch Changes

- 2ed3023: New package: `@trokky/mcp`, a Model Context Protocol server for Trokky. Point Claude Code, Claude
  Desktop, Cursor or any MCP client at a site with an API token, and an agent can read the content
  model, list, search, create, update, publish and delete documents, and read and upload media.

      claude mcp add trokky --env TROKKY_URL=https://cms.example.com --env TROKKY_TOKEN=<token> -- npx -y @trokky/mcp

  It runs locally over stdio and talks to the site's existing API, so the site needs no change. The
  token's permissions are the boundary. `TROKKY_READ_ONLY=1` offers only the reading tools. Uploads
  are off unless `TROKKY_UPLOAD_DIRS` names the directories they may read from, because uploaded
  media is public.
