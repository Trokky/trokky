/**
 * Variant generation must survive a flaky remote processor, and must never report success when
 * it did not.
 *
 * Cloudflare's Images service fails a measurable share of calls transiently — about one in
 * fifteen for a 6MB JPEG. MediaService used to catch those, log a warning and carry on, so the
 * upload came back looking complete with no thumbnail attached. That is the same shape as the
 * autoThumbnail drop that cost 97 of 124 articles their images, and it is what these tests pin
 * shut: transient failures are retried, and a failure that survives the retries is recorded on
 * the media record rather than swallowed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MediaService, type MediaServiceDependencies } from '../../core/services/media-service.js'
import type { ImageProcessor } from '../../core/media/image-processor.js'

const PROCESSED = {
  original: { width: 4032, height: 3024, format: 'jpeg', size: 1000 },
  variants: {
    thumbnail: { width: 150, height: 113, format: 'webp', size: 100, buffer: Buffer.from('thumb') },
    large: { width: 1600, height: 1200, format: 'webp', size: 400, buffer: Buffer.from('large') }
  }
}

function makeService(overrides: {
  processImage?: ImageProcessor['processImage']
  saveVariantFile?: MediaServiceDependencies['mediaStorage']['saveVariantFile']
  updateFile?: MediaServiceDependencies['mediaStorage']['updateFile']
} = {}) {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }

  const uploaded = {
    id: 'media_1', filename: 'photo.jpg', contentType: 'image/jpeg', size: 1000,
    metadata: { extension: 'jpg' }, _createdAt: new Date()
  }

  const mediaStorage = {
    uploadFile: vi.fn().mockResolvedValue(uploaded),
    getFile: vi.fn().mockResolvedValue(uploaded),
    updateFile: overrides.updateFile ?? vi.fn().mockImplementation(async (_id, meta) => ({ ...uploaded, metadata: meta })),
    getFileContent: vi.fn(),
    listMedia: vi.fn(),
    deleteFile: vi.fn(),
    saveVariantFile: overrides.saveVariantFile ?? vi.fn().mockResolvedValue('variants/media_1/thumbnail'),
    getVariantContent: vi.fn(),
    deleteVariantFiles: vi.fn().mockResolvedValue(undefined),
    healthCheck: vi.fn().mockResolvedValue(true)
  } as unknown as MediaServiceDependencies['mediaStorage']

  const processor = {
    processImage: overrides.processImage ?? vi.fn().mockResolvedValue(PROCESSED)
  } as unknown as ImageProcessor

  const service = new MediaService({
    config: {} as never,
    logger: logger as never,
    mediaStorage,
    idGenerator: { generate: () => 'media_1' } as never,
    securityEnabled: false,
    eventBus: { emitEvent: vi.fn().mockResolvedValue(undefined) } as never,
    eventsEnabled: false,
    getImageProcessor: () => processor
  })

  return { service, mediaStorage, processor, logger }
}

const anImage = () => new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' })

describe('MediaService variant resilience', () => {
  beforeEach(() => {
    // Retries are real; keep the suite from actually waiting out the backoff.
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void) => {
      fn()
      return 0 as unknown as ReturnType<typeof setTimeout>
    }) as typeof setTimeout)
  })

  it('retries a transient processor failure and still produces every variant', async () => {
    const processImage = vi.fn()
      .mockRejectedValueOnce(new Error('internal error; reference = 6arkkj179cqqihl8phi6v7d7'))
      .mockResolvedValue(PROCESSED)
    const { service } = makeService({ processImage: processImage as never })

    const result = await service.uploadMedia(anImage())

    expect(processImage).toHaveBeenCalledTimes(2)
    expect(Object.keys(result.metadata?.imageVariants as object)).toEqual(['thumbnail', 'large'])
    // A recovered failure is not a failure: nothing to report on the record.
    expect(result.metadata?.imageProcessing).toBeUndefined()
  })

  it('retries a transient variant write and still stores it', async () => {
    const saveVariantFile = vi.fn()
      .mockRejectedValueOnce(new Error('Network connection lost.'))
      .mockResolvedValue('variants/media_1/thumbnail')
    const { service } = makeService({ saveVariantFile: saveVariantFile as never })

    const result = await service.uploadMedia(anImage())

    expect(saveVariantFile).toHaveBeenCalledTimes(3) // one failure, its retry, then the second variant
    expect(Object.keys(result.metadata?.imageVariants as object)).toEqual(['thumbnail', 'large'])
    expect(result.metadata?.imageProcessing).toBeUndefined()
  })

  it('records a variant that fails every attempt instead of swallowing it', async () => {
    const saveVariantFile = vi.fn()
      .mockRejectedValueOnce(new Error('Network connection lost.'))
      .mockRejectedValueOnce(new Error('Network connection lost.'))
      .mockRejectedValueOnce(new Error('Network connection lost.'))
      .mockResolvedValue('variants/media_1/large')
    const { service, logger } = makeService({ saveVariantFile: saveVariantFile as never })

    const result = await service.uploadMedia(anImage())

    // The upload still succeeds — the original is stored and is what the user sent.
    expect(result.id).toBe('media_1')
    // But the record says so, which is the whole point.
    const report = result.metadata?.imageProcessing as { status: string; failures: unknown[] }
    expect(report.status).toBe('partial')
    expect(report.failures).toEqual([
      { stage: 'save-variant', variant: 'thumbnail', error: 'Network connection lost.' }
    ])
    // And the surviving variant is still there, so one bad variant does not lose the rest.
    expect(Object.keys(result.metadata?.imageVariants as object)).toEqual(['large'])
    expect(logger.error).toHaveBeenCalled()
  })

  it('records a processor that fails every attempt, and keeps the upload', async () => {
    const processImage = vi.fn().mockRejectedValue(new Error('Network connection lost.'))
    const { service, logger } = makeService({ processImage: processImage as never })

    const result = await service.uploadMedia(anImage())

    expect(processImage).toHaveBeenCalledTimes(3)
    expect(result.id).toBe('media_1')
    const report = result.metadata?.imageProcessing as { status: string; failures: { stage: string }[] }
    expect(report.status).toBe('failed')
    expect(report.failures[0].stage).toBe('process')
    expect(logger.error).toHaveBeenCalled()
  })

  it('fails fast on input no retry can fix', async () => {
    const processImage = vi.fn().mockRejectedValue(new Error('unsupported format: image/tiff'))
    const { service } = makeService({ processImage: processImage as never })

    const result = await service.uploadMedia(anImage())

    // One attempt, not three: waiting to retry an unsupported format helps nobody.
    expect(processImage).toHaveBeenCalledTimes(1)
    expect((result.metadata?.imageProcessing as { status: string }).status).toBe('failed')
  })

  it('reports metadata that could not be persisted, the failure that hides variants', async () => {
    // Variants land in storage but nothing references them — invisible without this report.
    const updateFile = vi.fn().mockRejectedValue(new Error('D1_ERROR: database is locked'))
    const { service, logger } = makeService({ updateFile: updateFile as never })

    const result = await service.uploadMedia(anImage())

    expect(updateFile).toHaveBeenCalledTimes(3)
    const report = result.metadata?.imageProcessing as { status: string; failures: { stage: string }[] }
    expect(report.status).toBe('failed')
    expect(report.failures.some(failure => failure.stage === 'persist-metadata')).toBe(true)
    expect(logger.error).toHaveBeenCalled()
  })

  it('leaves a clean upload completely unmarked', async () => {
    const { service, logger } = makeService()

    const result = await service.uploadMedia(anImage())

    expect(result.metadata?.imageProcessing).toBeUndefined()
    expect(Object.keys(result.metadata?.imageVariants as object)).toEqual(['thumbnail', 'large'])
    expect(logger.error).not.toHaveBeenCalled()
  })
})
