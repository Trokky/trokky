import { describe, it, expect } from 'vitest'
import {
  isSingletonSchema,
  collectStructureSingletons,
  findSingletonConsistencyIssues,
  assertSingletonConsistency,
} from '../../core/schema/singleton.js'

const schema = (name: string, extra: Record<string, unknown> = {}) =>
  ({ name, type: 'document', fields: {}, ...extra }) as any

describe('isSingletonSchema', () => {
  it('should accept the singleton flag', () => {
    expect(isSingletonSchema(schema('settings', { singleton: true }))).toBe(true)
  })

  it('should accept the singleton schema type', () => {
    expect(isSingletonSchema(schema('settings', { type: 'singleton' }))).toBe(true)
  })

  it('should reject an ordinary document schema', () => {
    expect(isSingletonSchema(schema('article'))).toBe(false)
  })

  it('should reject an explicit singleton: false', () => {
    expect(isSingletonSchema(schema('settings', { singleton: false }))).toBe(false)
  })

  it('should treat a schema typed singleton as one even if it also sets singleton: false', () => {
    // Self-contradictory, but either declaration alone means singleton, so the type wins.
    expect(isSingletonSchema(schema('settings', { type: 'singleton', singleton: false }))).toBe(true)
  })

  it('should ignore isSingleton, which is a structure key and not a schema key', () => {
    expect(isSingletonSchema(schema('documents-page', { isSingleton: true }))).toBe(false)
  })

  it('should handle a missing schema', () => {
    expect(isSingletonSchema(null)).toBe(false)
    expect(isSingletonSchema(undefined)).toBe(false)
  })
})

describe('collectStructureSingletons', () => {
  it('should find singletons nested under groups', () => {
    const structure = {
      items: [
        {
          type: 'group',
          items: [
            { type: 'singleton', schemaType: 'homepage', documentId: 'home' },
            { type: 'documentList', schemaType: 'article' },
          ],
        },
      ],
    }

    expect(collectStructureSingletons(structure)).toEqual([
      { collection: 'homepage', documentId: 'home', autoCreate: true },
    ])
  })

  it('should default documentId to the collection name', () => {
    const structure = { items: [{ type: 'singleton', schemaType: 'actualites' }] }
    expect(collectStructureSingletons(structure)[0].documentId).toBe('actualites')
  })

  it('should read options.autoCreate, defaulting to true', () => {
    const structure = {
      items: [
        { type: 'singleton', schemaType: 'a', options: { autoCreate: false } },
        { type: 'singleton', schemaType: 'b', options: {} },
        { type: 'singleton', schemaType: 'c' },
      ],
    }

    expect(collectStructureSingletons(structure).map(s => s.autoCreate)).toEqual([false, true, true])
  })

  it('should return nothing for an empty or malformed structure', () => {
    expect(collectStructureSingletons(undefined)).toEqual([])
    expect(collectStructureSingletons({})).toEqual([])
    expect(collectStructureSingletons({ items: 'nope' })).toEqual([])
  })

  it('should not loop forever on a self-referential structure', () => {
    const group: any = { type: 'group', items: [] }
    group.items.push(group, { type: 'singleton', schemaType: 'settings' })

    expect(collectStructureSingletons({ items: [group] })).toEqual([
      { collection: 'settings', documentId: 'settings', autoCreate: true },
    ])
  })
})

describe('findSingletonConsistencyIssues', () => {
  it('should report a structure singleton whose schema does not declare it', () => {
    const structure = { items: [{ type: 'singleton', schemaType: 'actualites', documentId: 'actualites' }] }
    const issues = findSingletonConsistencyIssues(structure, [schema('actualites')])

    expect(issues).toEqual([
      { collection: 'actualites', documentId: 'actualites', reason: 'schema-not-singleton' },
    ])
  })

  it('should report a structure singleton with no registered schema', () => {
    const structure = { items: [{ type: 'singleton', schemaType: 'ghost' }] }
    const issues = findSingletonConsistencyIssues(structure, [schema('article')])

    expect(issues[0].reason).toBe('schema-missing')
  })

  it('should accept a structure singleton backed by a flagged schema', () => {
    const structure = { items: [{ type: 'singleton', schemaType: 'homepage', documentId: 'home' }] }
    expect(findSingletonConsistencyIssues(structure, [schema('homepage', { singleton: true })])).toEqual([])
  })

  it('should allow a singleton schema that has no structure entry', () => {
    const structure = { items: [{ type: 'documentList', schemaType: 'article' }] }
    expect(
      findSingletonConsistencyIssues(structure, [schema('settings', { singleton: true }), schema('article')])
    ).toEqual([])
  })
})

describe('assertSingletonConsistency', () => {
  it('should not throw when structure and schemas agree', () => {
    const structure = { items: [{ type: 'singleton', schemaType: 'settings' }] }
    expect(() => assertSingletonConsistency(structure, [schema('settings', { singleton: true })])).not.toThrow()
  })

  it('should warn rather than throw for a structure singleton with no registered schema', () => {
    // A missing schema costs a broken nav link, not documents, and a project may register a
    // schema conditionally while leaving its nav entry in place.
    const structure = { items: [{ type: 'singleton', schemaType: 'ghost' }] }
    const warnings: string[] = []

    expect(() =>
      assertSingletonConsistency(structure, [schema('article')], message => warnings.push(message))
    ).not.toThrow()
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('ghost')
  })

  it('should still throw for a contradicting schema even alongside a missing one', () => {
    const structure = {
      items: [
        { type: 'singleton', schemaType: 'ghost' },
        { type: 'singleton', schemaType: 'actualites' },
      ],
    }

    expect(() => assertSingletonConsistency(structure, [schema('actualites')])).toThrow(/actualites/)
  })

  it('should not require a warning callback', () => {
    const structure = { items: [{ type: 'singleton', schemaType: 'ghost' }] }
    expect(() => assertSingletonConsistency(structure, [])).not.toThrow()
  })

  it('should throw naming every divergent collection', () => {
    const structure = {
      items: [
        { type: 'singleton', schemaType: 'actualites' },
        { type: 'singleton', schemaType: 'documentation' },
        { type: 'singleton', schemaType: 'settings' },
      ],
    }
    const schemas = [schema('actualites'), schema('documentation'), schema('settings', { singleton: true })]

    expect(() => assertSingletonConsistency(structure, schemas)).toThrow(/actualites/)
    expect(() => assertSingletonConsistency(structure, schemas)).toThrow(/documentation/)
    expect(() => assertSingletonConsistency(structure, schemas)).not.toThrow(/'settings'/)
  })
})
