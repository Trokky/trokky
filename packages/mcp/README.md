# @trokky/mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server for Trokky. It lets an AI agent
(Claude Code, Claude Desktop, Cursor, or any MCP client) read and edit the content of one or more
Trokky sites through their API. What the agent may do on each site is what you approve when you
sign it in.

It runs on your machine and talks to the sites over HTTPS. Nothing is installed on the server. It
needs Node.js 20 or later. Signing in needs sites on Trokky 3.5.2 or later with OAuth2 enabled
(`oauth2.enabled` in the site's config); an API token works with any 3.5 site.

## Setup

Add the server to your MCP client once. Pin the major version, so an update does not run with
your sign-ins until you choose it.

**Claude Code**

```bash
claude mcp add trokky -- npx -y @trokky/mcp@3
```

**Claude Desktop, Cursor and other clients** (`mcpServers` in the client's JSON config)

```json
{
  "mcpServers": {
    "trokky": { "command": "npx", "args": ["-y", "@trokky/mcp@3"] }
  }
}
```

On Windows, where `npx` is a batch file, use `"command": "cmd"` and
`"args": ["/c", "npx", "-y", "@trokky/mcp@3"]`.

## Adding sites

Ask the agent: "add my Trokky site https://cms.example.com". It calls `add_site`, which gives
you a link and a code. Open the link, sign in to Studio if asked, check the code, untick any
access you don't want to give, and approve. The site is saved the moment you approve: the
server watches for it in the background, and the agent's `finish_add_site` call returns as soon
as it happens, without the agent having to ask whether you're done. Add as many sites as you like; one is the default, and every tool takes an optional
`site`.

Or from a terminal:

```bash
npx -y @trokky/mcp@3 login https://cms.example.com --access edit   # read | edit | publish | full
npx -y @trokky/mcp@3 sites
```

Sites are saved in `~/.trokky/config.yaml`, shared with the [Trokky CLI](https://trokky.dev/operate/cli/):
a site you signed in to with `trokky login` is available to the agent, and the reverse. Sessions
renew themselves; a site you have not used for 30 days needs signing in again.

The consent screen names the requester "Trokky MCP (AI agent)", so you always know an agent is
asking. What you approve is the most it can do, and never more than your own account can.

### One site with an API token

For CI, a headless machine, or a site without OAuth2, pin one site with an API token (Studio >
**Users > API tokens**) instead:

```bash
claude mcp add trokky --env TROKKY_URL=https://cms.example.com --env TROKKY_TOKEN=<token> -- npx -y @trokky/mcp@3
```

## Configuration

| Variable | |
|---|---|
| `TROKKY_URL`, `TROKKY_TOKEN` | Pin one site with an API token. Both or neither. The URL is the site (`https://cms.example.com`, which means `/api`) or the API itself (`https://example.com/cms-api`). No credentials in the URL. |
| `TROKKY_CONFIG` | Where the site list lives. Default `~/.trokky/config.yaml` |
| `TROKKY_READ_ONLY` | `1` to offer only the reading tools, and ask only for read access when adding a site |
| `TROKKY_UPLOAD_DIRS` | Absolute paths of the directories `upload_media` may read from, separated by `:` (`;` on Windows). Unset: no `upload_media` tool |
| `TROKKY_MAX_UPLOAD_MB` | Largest file `upload_media` sends. Default 25 |

## Tools

| Tool | Does | Needs |
|---|---|---|
| `list_sites`, `set_default_site` | The sites, and which is the default | |
| `add_site`, `finish_add_site` | Sign in to a site through the browser | |
| `remove_site` | Forget a site on this machine (the CLI too) | |
| `list_collections` | Collections, their fields, and each singleton's document id | any valid token |
| `get_schema` | One collection's full schema | any valid token |
| `list_documents` | A page of documents, with exact-match `filter`, `sort`, `expand` | `content:read` |
| `get_document` | One document | `content:read` |
| `search` | Text search across the collections the token can read, and media names with `media:read` | any valid token |
| `list_media`, `get_media` | Media metadata and public URL | `media:read` |
| `create_document` | New document, draft by default | `content:write`, plus `content:publish` to create it published |
| `update_document` | Change some fields, keep the rest | `content:write` |
| `set_status` | Publish or unpublish | `content:publish` |
| `delete_document` | Permanent delete | `content:delete` |
| `upload_media` | Upload a local file | `media:upload`, and `TROKKY_UPLOAD_DIRS` |

A signed-in site holds the access you approved, capped by your own account: a user limited to some
collections keeps the agent to them too. With an API token, content permissions can be narrowed to
one collection (`posts:write` in place of `content:write`) through `POST /api/tokens` (see the
[authentication docs](https://trokky.dev/operate/auth/)).

## Safety

- **The token is the boundary.** The site checks what each token may do on every call. A signed-in
  agent can never manage accounts, users, API tokens, webhooks or settings, whatever it was granted. Read-only mode
  goes further and doesn't register the writing tools at all. One read still writes: reading a
  singleton that has never been saved creates it empty, which any reader of the site also does.
- Publishing, unpublishing, updating and deleting are marked destructive, so clients that honour
  tool annotations ask before running them.
- Uploaded media is served publicly. `upload_media` reads only from `TROKKY_UPLOAD_DIRS`, resolving
  symlinks, and only file types the server accepts, judged by the file on disk: a rename can't
  change the type. SVG is refused, because the server serves media inline and an SVG can carry
  script.
- Tool results contain site content written by the site's editors. The server tells the agent to
  treat instructions inside content as data, but that is advice to a model, not a guarantee. If
  untrusted people can edit the site, give the agent a read-only token or keep a human approving
  each write.
- Results are capped at 200,000 characters, with a note when something was cut.

## Programmatic use

```ts
import { createTrokkyMcpServer } from '@trokky/mcp'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

// One site with an API token, or leave apiUrl out to use the signed-in sites (new SiteStore())
const server = createTrokkyMcpServer({ apiUrl: 'https://cms.example.com/api', token, readOnly: true })
await server.connect(new StdioServerTransport())
```

`createTrokkyMcpServer` returns an `McpServer` from the official SDK, so any of the SDK's
transports can serve it.
