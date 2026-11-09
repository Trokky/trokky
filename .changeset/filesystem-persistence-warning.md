---
'@trokky/trokky': patch
---

A production site on the filesystem adapters now hears at startup when its content will not survive the next deploy. In a container, anything written outside a mounted volume lives in the container's own layer and is discarded when the container is replaced; nothing fails, the site simply starts empty.

At startup in production, the Express integration looks up every directory the filesystem adapters write to (content, users, API tokens, settings, webhooks, sign-in flow state, audit logs, media) in the Linux mount table (`/proc/self/mountinfo`) and logs a warning for each one that is on the container's own filesystem (overlay) or in memory (tmpfs), naming the directory and where to mount a volume:

```
Media files are stored in /app/media, which is on the container's own filesystem, not a mounted volume: they will be lost when the container is replaced (the next deploy). Mount a persistent volume at /app/media or a parent directory.
```

Directories on a volume produce nothing, and neither do systems without a mount table (macOS, Windows). The check only reports what it can see: it recognises a container root on overlay (including rootless Podman's fuse-overlayfs) or aufs, and memory filesystems anywhere. A container root on btrfs or zfs, a VM whose root is ext4, or a Kubernetes `emptyDir` on disk look like persistent storage to it and are not reported.
