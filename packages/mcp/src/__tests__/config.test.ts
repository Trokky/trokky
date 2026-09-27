import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveApiUrl } from '../api.js'
import { readConfig } from '../config.js'

const TOKEN = 'a'.repeat(64)

describe('resolveApiUrl', () => {
  it('should add /api to a bare origin', () => {
    expect(resolveApiUrl('https://cms.example.com')).toBe('https://cms.example.com/api')
    expect(resolveApiUrl('https://cms.example.com/')).toBe('https://cms.example.com/api')
  })

  it('should keep an explicit path', () => {
    expect(resolveApiUrl('https://example.com/api')).toBe('https://example.com/api')
    expect(resolveApiUrl('https://example.com/cms-api/')).toBe('https://example.com/cms-api')
  })

  it('should drop a query string and fragment', () => {
    expect(resolveApiUrl('https://example.com/api?x=1#y')).toBe('https://example.com/api')
  })

  it('should reject credentials in the URL without echoing them', () => {
    let message = ''
    try {
      resolveApiUrl('https://admin:hunter2@cms.example.com')
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).toContain('must not contain a username or password')
    expect(message).not.toContain('hunter2')
  })

  it('should never echo the URL in any rejection', () => {
    for (const input of ['https://:hunter2@cms.example.com', 'ftp://admin:hunter2@x.dev', 'https://admin:hunter2@x dev']) {
      let message = ''
      try {
        resolveApiUrl(input)
      } catch (error) {
        message = (error as Error).message
      }
      expect(message).not.toBe('')
      expect(message).not.toContain('hunter2')
    }
  })

  it('should reject a non-URL and a non-http scheme', () => {
    expect(() => resolveApiUrl('cms.example.com')).toThrow('not a valid URL')
    expect(() => resolveApiUrl('file:///etc/passwd')).toThrow('http or https')
  })
})

describe('readConfig', () => {
  it('should pin one site only with both variables, and use the shared sites with neither', () => {
    expect(readConfig({}, '/work').apiUrl).toBeUndefined()
    expect(() => readConfig({ TROKKY_URL: 'https://x.dev' }, '/work')).toThrow('TROKKY_TOKEN is missing')
    expect(() => readConfig({ TROKKY_TOKEN: TOKEN }, '/work')).toThrow('TROKKY_URL is missing')
    expect(readConfig({ TROKKY_CONFIG: 'conf/sites.yaml' }, '/work').configPath).toBe(path.resolve('/work', 'conf/sites.yaml'))
  })

  it('should default to read-write with uploads disabled', () => {
    const config = readConfig({ TROKKY_URL: 'https://x.dev', TROKKY_TOKEN: TOKEN }, '/work')
    expect(config).toMatchObject({ apiUrl: 'https://x.dev/api', token: TOKEN, readOnly: false, uploadRoots: [] })
  })

  it('should read the read-only switch', () => {
    for (const value of ['1', 'true', 'YES', 'on']) {
      expect(readConfig({ TROKKY_URL: 'https://x.dev', TROKKY_TOKEN: TOKEN, TROKKY_READ_ONLY: value }, '/work').readOnly).toBe(true)
    }
    expect(readConfig({ TROKKY_URL: 'https://x.dev', TROKKY_TOKEN: TOKEN, TROKKY_READ_ONLY: '0' }, '/work').readOnly).toBe(false)
  })

  it('should resolve upload directories against the working directory', () => {
    const config = readConfig({
      TROKKY_URL: 'https://x.dev',
      TROKKY_TOKEN: TOKEN,
      TROKKY_UPLOAD_DIRS: ['images', '/abs/files'].join(path.delimiter)
    }, '/work')
    expect(config.uploadRoots).toEqual([path.resolve('/work', 'images'), path.resolve('/abs/files')])
  })

  it('should trim every value', () => {
    const config = readConfig({
      TROKKY_URL: '  https://x.dev  ',
      TROKKY_TOKEN: ` ${TOKEN}\n`,
      TROKKY_READ_ONLY: ' 1 ',
      TROKKY_UPLOAD_DIRS: [' images ', ' docs '].join(path.delimiter)
    }, '/work')
    expect(config).toMatchObject({
      apiUrl: 'https://x.dev/api',
      token: TOKEN,
      readOnly: true,
      uploadRoots: [path.resolve('/work', 'images'), path.resolve('/work', 'docs')]
    })
  })

  it('should validate the upload size limit', () => {
    const base = { TROKKY_URL: 'https://x.dev', TROKKY_TOKEN: TOKEN }
    expect(readConfig({ ...base, TROKKY_MAX_UPLOAD_MB: '2' }, '/work').maxUploadBytes).toBe(2 * 1024 * 1024)
    expect(() => readConfig({ ...base, TROKKY_MAX_UPLOAD_MB: 'lots' }, '/work')).toThrow('positive number')
    expect(() => readConfig({ ...base, TROKKY_MAX_UPLOAD_MB: '0' }, '/work')).toThrow('positive number')
    expect(() => readConfig({ ...base, TROKKY_MAX_UPLOAD_MB: '0.0000001' }, '/work')).toThrow('positive number')
    expect(readConfig({ ...base, TROKKY_MAX_UPLOAD_MB: '0.5' }, '/work').maxUploadBytes).toBe(524288)
    expect(readConfig({ ...base, TROKKY_MAX_UPLOAD_MB: '0.0000011' }, '/work').maxUploadBytes).toBe(1)
  })
})
