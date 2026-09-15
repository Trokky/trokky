---
"@trokky/trokky": minor
---

Image variants on Workers: the `cloudflare-images` processor, backed by the Images binding.

```ts
media: {
  imageProcessor: 'cloudflare-images',
  imageProcessorOptions: { images: env.IMAGES },
}
```

Variants are made once, at upload, through `env.IMAGES` on the raw bytes, and stored in R2 through the existing `saveVariantFile` pipeline. That shape is deliberate: the binding never needs the bucket to be public, and because a binding call bills every time while URL transformations bill once per unique transformation per month, doing it once at upload is a one-time cost rather than a recurring one. Every variant is retried — the real service fails roughly one call in fifteen transiently — and a failure that survives the retries is reported on the media record, not swallowed.

Requires an `images` binding in `wrangler.jsonc`. `fit: 'fill'` and `'outside'` map to Cloudflare's nearest crop behaviour, since it has no stretch.
