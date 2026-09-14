---
"@trokky/trokky": patch
---

Bundle for Cloudflare Workers without the caller aliasing optional Node dependencies.

`sharp`, `pg` and `bcrypt` never execute on Workers, and the code loading them already sat behind a dynamic `import()` for that reason. That is not enough: a bundler resolves a literal dynamic import whether or not the branch runs, and the surviving reference broke the Worker at startup with `Unable to resolve ... dependency "sharp": no matching module rules`. sharp pulls in `detect-libc`, which wants `fs` and `child_process`.

Hiding the specifier behind a variable is not a fix either — workerd rejects a non-literal dynamic specifier at parse time, executed or not. So `sharp` is now loaded through `require`, which no bundler follows and workerd never parses, matching how `bcrypt` was already loaded. Node behaviour is unchanged; sharp is CommonJS anyway.

A Worker build needs no `alias` entries now. `nodejs_compat` is still required, for `crypto`, `events` and `module`.

Guarded by a test that bundles the edge entry points for a workerd target and asserts nothing external survives but Node built-ins, and that no Trokky source reaching the bundle uses a non-literal dynamic specifier. Both halves were confirmed to fail before the fix.
