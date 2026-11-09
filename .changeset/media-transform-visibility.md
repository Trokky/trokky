---
'@trokky/trokky': patch
---

Image transform parameters that the server does not apply are no longer silent. `GET /media/:id/file` serves the stored file as it is; the `?w=`, `h`, `fm`, `q`, `fit`, `blur`, `sharp` and `grayscale` parameters that `imageUrl()` emits only take effect where an image pipeline in front of the server (a CDN, a transforming object store) reads them. Without one, a request such as `?w=800&fm=webp` used to return the original file with a plain `200`, which looks like a resized image and is not.

Now such a response carries `X-Trokky-Origin-Ignored-Transforms: w,fm` naming the parameters the origin did not apply (exposed to cross-origin frontends through `Access-Control-Expose-Headers`), and the server logs one warning per process the first time it happens, pointing at `media.variants` for sizes generated at upload time.
