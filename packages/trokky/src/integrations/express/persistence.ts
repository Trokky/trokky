/**
 * Whether the filesystem adapters' directories will survive a redeploy.
 *
 * In a container, anything written outside a mounted volume lives in the container's own
 * writable layer and is discarded when the next deploy replaces the container. Nothing fails
 * when that happens: the site starts empty. On Linux the mount table says where each directory
 * lives, so the check can name the directory and say whether it is on a volume.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

export interface MountEntry {
  mountPoint: string
  fsType: string
}

/** Filesystems a container's own root is built from: writes there do not outlive the container. */
const CONTAINER_LAYER_FS = new Set(['overlay', 'overlayfs', 'fuse.fuse-overlayfs', 'aufs', 'tmpfs'])

/** Filesystems held in memory: lost on restart wherever they are mounted. */
const MEMORY_FS = new Set(['tmpfs', 'ramfs'])

/**
 * Parse /proc/self/mountinfo. Field 5 is the mount point (octal-escaped: a space is \040), and
 * the filesystem type is the first field after the " - " separator.
 */
export function parseMountInfo(text: string): MountEntry[] {
  const entries: MountEntry[] = []
  for (const line of text.split('\n')) {
    const separator = line.indexOf(' - ')
    if (separator === -1) continue
    const fields = line.slice(0, separator).split(' ')
    const fsType = line.slice(separator + 3).split(' ')[0]
    if (fields.length < 5 || !fsType) continue
    const mountPoint = fields[4].replace(/\\([0-7]{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
    entries.push({ mountPoint, fsType })
  }
  return entries
}

/** The mount a path lives on: the longest mount point that contains it. */
export function mountFor(dir: string, mounts: MountEntry[]): MountEntry | undefined {
  let best: MountEntry | undefined
  for (const mount of mounts) {
    const inside =
      mount.mountPoint === '/' || dir === mount.mountPoint || dir.startsWith(mount.mountPoint.replace(/\/$/, '') + '/')
    if (inside && (!best || mount.mountPoint.length >= best.mountPoint.length)) best = mount
  }
  return best
}

/** True when the directory is written to the container's own layer, or to memory, rather than a volume. */
export function isOnContainerLayer(dir: string, mounts: MountEntry[]): boolean {
  const mount = mountFor(dir, mounts)
  if (!mount) return false
  return MEMORY_FS.has(mount.fsType) || (mount.mountPoint === '/' && CONTAINER_LAYER_FS.has(mount.fsType))
}

/**
 * The absolute path with symlinks resolved. A directory not created yet resolves through its
 * nearest existing ancestor, with the missing part appended, so it is placed on the right mount.
 */
async function realDirectory(dir: string): Promise<string> {
  const absolute = path.resolve(dir)
  let existing = absolute
  for (;;) {
    try {
      return path.join(await fs.realpath(existing), path.relative(existing, absolute))
    } catch {
      const parent = path.dirname(existing)
      if (parent === existing) return absolute
      existing = parent
    }
  }
}

/**
 * One warning per directory that will not survive a redeploy, naming it. Directories on a volume,
 * and systems without /proc (macOS, Windows), produce nothing: the check reports what it can see.
 * It cannot see every kind of throwaway disk: a container root on btrfs or zfs, a VM root on ext4,
 * or a Kubernetes emptyDir on disk look like any other persistent filesystem.
 */
export async function findEphemeralDirectories(
  dirs: Array<{ label: string; dir: string }>,
  readMountInfo: () => Promise<string> = () => fs.readFile('/proc/self/mountinfo', 'utf8')
): Promise<string[]> {
  let mounts: MountEntry[]
  try {
    mounts = parseMountInfo(await readMountInfo())
  } catch {
    return []
  }
  if (mounts.length === 0) return []

  const warnings: string[] = []
  for (const { label, dir } of dirs) {
    const real = await realDirectory(dir)
    if (isOnContainerLayer(real, mounts)) {
      warnings.push(
        `${label} are stored in ${path.resolve(dir)}, which is on the container's own filesystem, not a ` +
          'mounted volume: they will be lost when the container is replaced (the next deploy). Mount a ' +
          `persistent volume at ${path.resolve(dir)} or a parent directory.`
      )
    }
  }
  return warnings
}
