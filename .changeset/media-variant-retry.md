---
"@trokky/trokky": minor
---

Retry transient media processing failures, and stop swallowing the ones that remain.

Remote image processing is not reliable enough to call once. Measured against Cloudflare's real Images service, roughly **one call in fifteen** of a 6MB JPEG fails transiently — `Network connection lost`, `internal error; reference = ...`. `MediaService` used to catch those, log a warning and carry on, so the upload returned looking complete with no thumbnail attached. That is the same shape as the `autoThumbnail` write drop that cost 97 of 124 articles their images.

Three steps now retry with exponential backoff and jitter — processing the image, writing each variant, and persisting the variant metadata. Jitter matters because variants are generated in a loop: a batch that fails together would otherwise retry together, in step, against the same overloaded backend. Input nothing can fix (`unsupported format`, `too large`) is not retried, so a permanent failure still fails fast.

What survives the retries is **reported, not swallowed**. The media record gains an `imageProcessing` field:

```jsonc
{
  "status": "partial",          // or "failed"
  "failures": [{ "stage": "save-variant", "variant": "thumbnail", "error": "Network connection lost." }],
  "failedAt": "2026-09-14T22:41:07.000Z"
}
```

Its absence means every variant was generated and stored, so a clean upload is unmarked and nothing downstream changes. Failures now log at `error` rather than `warn`.

Uploads still do not throw when variants fail: the original file is stored and is what the user actually sent, so failing would send them to re-upload something already safe. The difference is that the record now says it is incomplete instead of looking finished.

Upload and `regenerateMediaVariants` share one generation path, so their retry and reporting behaviour cannot drift apart.

`withRetry` is exported from `@trokky/trokky` for adapters and custom processors that face the same problem.
