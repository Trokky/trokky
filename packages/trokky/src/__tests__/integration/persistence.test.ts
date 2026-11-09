/**
 * The filesystem adapters' directories are checked against the mount table, so a deployed site
 * hears at startup that its content is on the container's own layer and will not survive the
 * next deploy.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  parseMountInfo,
  mountFor,
  isOnContainerLayer,
  findEphemeralDirectories,
} from '../../integrations/express/persistence.js'

// Trimmed from a real container: overlay root, a named volume at /app/data, /proc, a tmpfs
const MOUNTINFO = [
  '1180 1060 0:345 / / rw,relatime master:1 - overlay overlay rw,lowerdir=/x,upperdir=/y,workdir=/z',
  '1181 1180 0:348 / /proc rw,nosuid,nodev,noexec,relatime - proc proc rw',
  '1190 1180 8:1 /var/lib/docker/volumes/site_data/_data /app/data rw,relatime - ext4 /dev/sda1 rw',
  '1191 1180 8:1 /srv/uploads /app/my\\040uploads rw,relatime - ext4 /dev/sda1 rw',
  '1192 1180 0:50 / /dev/shm rw - tmpfs shm rw',
].join('\n')

describe('parseMountInfo', () => {
  it('should read mount points and filesystem types, unescaping spaces', () => {
    expect(parseMountInfo(MOUNTINFO)).toEqual([
      { mountPoint: '/', fsType: 'overlay' },
      { mountPoint: '/proc', fsType: 'proc' },
      { mountPoint: '/app/data', fsType: 'ext4' },
      { mountPoint: '/app/my uploads', fsType: 'ext4' },
      { mountPoint: '/dev/shm', fsType: 'tmpfs' },
    ])
  })

  it('should skip lines it cannot read', () => {
    expect(parseMountInfo('garbage\n\n')).toEqual([])
  })
})

describe('mountFor and isOnContainerLayer', () => {
  const mounts = parseMountInfo(MOUNTINFO)

  it.each([
    ['/app/data/media', '/app/data', false],
    ['/app/data', '/app/data', false],
    ['/app/my uploads/x', '/app/my uploads', false],
    ['/app/media', '/', true],
    ['/app/database', '/', true], // shares a prefix with /app/data, but is not inside it
    ['/dev/shm/media', '/dev/shm', true], // tmpfs: in memory, gone on restart
  ])('%s is on %s (container layer: %s)', (dir, mountPoint, ephemeral) => {
    expect(mountFor(dir, mounts)?.mountPoint).toBe(mountPoint)
    expect(isOnContainerLayer(dir, mounts)).toBe(ephemeral)
  })

  it('should not call a non-container root ephemeral', () => {
    const host = parseMountInfo('1 0 8:1 / / rw - ext4 /dev/sda1 rw')
    expect(isOnContainerLayer('/srv/site/media', host)).toBe(false)
  })
})

describe('findEphemeralDirectories', () => {
  const read = async () => MOUNTINFO

  it('should warn for each directory outside a volume, naming it', async () => {
    const warnings = await findEphemeralDirectories(
      [
        { label: 'Media files', dir: '/app/media' },
        { label: 'Documents', dir: '/app/data/content' },
      ],
      read
    )
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('Media files are stored in /app/media')
    expect(warnings[0]).toContain('Mount a persistent volume at /app/media')
  })

  it('should say nothing when the mount table cannot be read', async () => {
    const warnings = await findEphemeralDirectories([{ label: 'Media files', dir: '/app/media' }], async () => {
      throw new Error('ENOENT')
    })
    expect(warnings).toEqual([])
  })
})

describe('findEphemeralDirectories with symlinks', () => {
  it('should follow a symlink to the volume it points into', async () => {
    const base = await fs.promises.realpath(await fs.promises.mkdtemp(path.join(os.tmpdir(), 'trokky-mount-')))
    try {
      await fs.promises.mkdir(path.join(base, 'volume'))
      await fs.promises.symlink(path.join(base, 'volume'), path.join(base, 'link'))
      const mounts = async () => `1 0 0:1 / / rw - overlay overlay rw\n2 1 8:1 / ${base}/volume rw - ext4 /dev/sda1 rw`
      // Through the link the path looks like it is on the overlay root; resolved, it is on the volume
      expect(await findEphemeralDirectories([{ label: 'Media files', dir: path.join(base, 'link', 'media') }], mounts)).toEqual([])
      expect(await findEphemeralDirectories([{ label: 'Media files', dir: path.join(base, 'media') }], mounts)).toHaveLength(1)
    } finally {
      await fs.promises.rm(base, { recursive: true, force: true })
    }
  })
})
