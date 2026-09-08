import { describe, it, expect } from 'vitest'
import { FastHasher, StableHasher } from '../../structure/utils/hash.js'

describe('Structure', () => {
  describe('StructureBuilder', () => {
    it('should be importable', async () => {
      const mod = await import('../../structure/index.js')
      expect(mod.StructureBuilder).toBeDefined()
    })

    it('should be instantiable', async () => {
      const { StructureBuilder } = await import('../../structure/index.js')
      const builder = new StructureBuilder()
      expect(builder).toBeDefined()
    })

    it('should export PermissionChecker', async () => {
      const mod = await import('../../structure/index.js')
      expect(mod.PermissionChecker).toBeDefined()
    })

    it('should export QueryBuilder', async () => {
      const mod = await import('../../structure/index.js')
      expect(mod.QueryBuilder).toBeDefined()
    })

    it('should export StructureMerger', async () => {
      const mod = await import('../../structure/index.js')
      expect(mod.StructureMerger).toBeDefined()
    })

    it('should export TrokkyStructureSchema', async () => {
      const mod = await import('../../structure/index.js')
      expect(mod.TrokkyStructureSchema).toBeDefined()
    })
  })

  describe('Hash utilities', () => {
    it('should generate consistent fast hashes', () => {
      const hash1 = FastHasher.hash('test-input')
      const hash2 = FastHasher.hash('test-input')
      expect(hash1).toBe(hash2)
    })

    it('should generate different hashes for different input', () => {
      const hash1 = FastHasher.hash('input-a')
      const hash2 = FastHasher.hash('input-b')
      expect(hash1).not.toBe(hash2)
    })

    it('should handle empty strings', () => {
      const hash = FastHasher.hash('')
      expect(typeof hash).toBe('string')
    })

    it('should generate stable hashes (key-order independent)', () => {
      const hash1 = StableHasher.hash({ key: 'value', num: 42 })
      const hash2 = StableHasher.hash({ num: 42, key: 'value' })
      expect(hash1).toBe(hash2)
    })

    it('should generate different stable hashes for different objects', () => {
      const hash1 = StableHasher.hash({ a: 1 })
      const hash2 = StableHasher.hash({ a: 2 })
      expect(hash1).not.toBe(hash2)
    })
  })
})
