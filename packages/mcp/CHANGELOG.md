# @trokky/mcp

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
