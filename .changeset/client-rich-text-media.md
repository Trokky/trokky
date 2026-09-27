---
'@trokky/client': patch
---

Security: the media proxy forwards only media paths. `createMediaProxy`, `createAstroMediaProxy`, `createNextMediaProxy` and `createExpressMediaProxy` fetched `${apiUrl}/media/${path}` for any path, with the site's API token attached. A request for `/media/..%2Fusers` reached `/users` and was answered with a one-year public cache header. They now forward only `<id>/file` and `<id>/variants/<name>`, and answer 404 to anything else. Every site serving media through one of them should update.

Images inside rich text can follow a media proxy or a moved API without rewriting stored content.

- **`mediaBaseUrl`** client option: where browsers load media from, either a proxy path (`/media`) or a public URL. `imageUrl()`, `createImageUrlBuilder()` and `resolveContent()` all build on it. Variants keep their real `/variants/<name>` URLs, unlike the builder's older `proxyPath` option, which is unchanged.
- **With `mediaBaseUrl`, `resolveContent()` rebuilds every image from its media id**: `data-trokky-id` in HTML, and the `/media/<id>/…` path in Markdown. The path or host the content was saved with stops mattering, and images from elsewhere and Markdown inside code are left alone. Without `mediaBaseUrl`, stored images are left exactly as before.
- **Placeholders always become URLs**: `[trokky-image:<id>]` in a ProseMirror document, and the `[trokky-image …]` placeholders earlier Studio versions wrote, on `mediaBaseUrl` or else `${baseUrl}/media`.
- `resolveContent()` accepts a ProseMirror document and returns one. It accepts `string | null | undefined` and returns a string, `''` for empty content.
- `rebaseStoredMediaUrls`, `resolveProseMirrorShortcodes` and the `RichTextNode` and `RichTextValue` types are exported.
