# @trokky/mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server for Trokky. It lets an AI agent
(Claude Code, Claude Desktop, Cursor, or any MCP client) read and edit a Trokky site's content
through the site's API, with an API token that decides what the agent may do.

It runs on your machine and talks to the site over HTTPS. Nothing is installed on the server. It
needs Node.js 20 or later, and a site on Trokky 3.5.1 or later for the permission checks described
below.

## Setup

1. In Studio, open **Users > API tokens** and create a token for the agent. Give it only what the
   agent needs, and set an expiry. For an agent that drafts articles with images: view, edit
   content; view, upload media. Leave out publish and delete, and the agent can prepare work but
   not put it live or remove it.
2. Add the server to your MCP client. Pin the major version, so an update does not run with your
   token until you choose it.

**Claude Code**

```bash
claude mcp add trokky \
  --env TROKKY_URL=https://cms.example.com \
  --env TROKKY_TOKEN=<token> \
  -- npx -y @trokky/mcp@3
```

**Claude Desktop, Cursor and other clients** (`mcpServers` in the client's JSON config)

```json
{
  "mcpServers": {
    "trokky": {
      "command": "npx",
      "args": ["-y", "@trokky/mcp@3"],
      "env": {
        "TROKKY_URL": "https://cms.example.com",
        "TROKKY_TOKEN": "<token>"
      }
    }
  }
}
```

On Windows, where `npx` is a batch file, use `"command": "cmd"` and
`"args": ["/c", "npx", "-y", "@trokky/mcp@3"]`.

## Configuration

| Variable | Required | |
|---|---|---|
| `TROKKY_URL` | yes | The site (`https://cms.example.com`, which means `/api`) or the API itself (`https://example.com/cms-api`). No credentials in the URL. |
| `TROKKY_TOKEN` | yes | An API token |
| `TROKKY_READ_ONLY` | no | `1` to offer only the reading tools |
| `TROKKY_UPLOAD_DIRS` | no | Absolute paths of the directories `upload_media` may read from, separated by `:` (`;` on Windows). Unset: no `upload_media` tool |
| `TROKKY_MAX_UPLOAD_MB` | no | Largest file `upload_media` sends. Default 25 |

## Tools

| Tool | Does | Token needs |
|---|---|---|
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

The content permissions can be narrowed to one collection (`posts:write` in place of
`content:write`), and `content:*` or `posts:*` grant every action. Studio's token dialog offers the
site-wide permissions only; create a per-collection token through `POST /api/tokens` (see the
[authentication docs](https://trokky.dev/operate/auth/)).

## Safety

- **The token is the boundary.** The server checks its permissions on every call. Read-only mode
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

const server = createTrokkyMcpServer({ apiUrl: 'https://cms.example.com/api', token, readOnly: true })
await server.connect(new StdioServerTransport())
```

`createTrokkyMcpServer` returns an `McpServer` from the official SDK, so any of the SDK's
transports can serve it.
