import { describe, it, expect } from 'vitest'
import {
  collectValidationErrors,
  createInitialState,
  deepEqual,
  documentReducer,
  formatPath,
  getDirtyPaths,
  getValueAtPath,
  isDirty,
  setValueAtPath,
} from '../components/document/documentStore'
import {
  ITEM_KEY,
  buildSavePayload,
  ensureItemKeys,
  getItemKey,
  stripItemKeys,
} from '../components/document/savePayload'

const schema = {
  name: 'article',
  fields: {
    title: { type: 'string', title: 'Title', required: true },
    rank: { type: 'number', title: 'Rank', required: true },
    featured: { type: 'boolean', title: 'Featured', required: true },
    seo: {
      type: 'object',
      title: 'SEO',
      fields: {
        metaTitle: { type: 'string', title: 'Meta title', required: true },
      },
    },
    sections: {
      type: 'array',
      title: 'Sections',
      of: {
        type: 'object',
        title: 'Section',
        fields: {
          heading: { type: 'string', title: 'Heading', required: true },
          body: { type: 'string', title: 'Body' },
        },
      },
    },
  },
}

function load(document: any) {
  return documentReducer(createInitialState(null), { type: 'load', document })
}

describe('deepEqual', () => {
  it('should ignore key order', () => {
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
  })

  it('should treat keys holding undefined as absent', () => {
    expect(deepEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true)
  })

  it('should compare nested structures', () => {
    expect(deepEqual({ a: [{ b: 1 }] }, { a: [{ b: 1 }] })).toBe(true)
    expect(deepEqual({ a: [{ b: 1 }] }, { a: [{ b: 2 }] })).toBe(false)
    expect(deepEqual([1, 2], [2, 1])).toBe(false)
  })

  it('should compare dates by value', () => {
    expect(deepEqual(new Date('2024-01-01'), new Date('2024-01-01'))).toBe(true)
    expect(deepEqual(new Date('2024-01-01'), new Date('2024-01-02'))).toBe(false)
  })

  it('should skip ignored keys', () => {
    expect(deepEqual({ a: 1, _key: 'x' }, { a: 1, _key: 'y' }, new Set(['_key']))).toBe(true)
    expect(deepEqual({ a: 1, _key: 'x' }, { a: 1, _key: 'y' })).toBe(false)
  })
})

describe('path helpers', () => {
  it('should format nested paths', () => {
    expect(formatPath(['sections', 0, 'heading'])).toBe('sections[0].heading')
  })

  it('should read and write at depth without rebuilding siblings', () => {
    const document = { seo: { metaTitle: 'a' }, sections: [{ heading: 'one' }] }
    const next = setValueAtPath(document, ['sections', 0, 'heading'], 'two')

    expect(getValueAtPath(next, ['sections', 0, 'heading'])).toBe('two')
    expect(document.sections[0].heading).toBe('one')
    expect(next.seo).toBe(document.seo)
  })

  it('should refuse prototype-polluting paths', () => {
    const document = { a: 1 }
    expect(setValueAtPath(document, ['__proto__', 'polluted'], true)).toBe(document)
    expect(({} as any).polluted).toBeUndefined()
  })
})

describe('documentReducer', () => {
  it('should set a value at depth', () => {
    const state = documentReducer(load({ seo: { metaTitle: 'a' } }), {
      type: 'setValue',
      path: ['seo', 'metaTitle'],
      value: 'b',
    })

    expect(state.current.seo.metaTitle).toBe('b')
    expect(state.initial.seo.metaTitle).toBe('a')
  })

  it('should create missing containers along the path', () => {
    const state = documentReducer(load({}), {
      type: 'setValue',
      path: ['sections', 0, 'heading'],
      value: 'one',
    })

    expect(state.current.sections[0].heading).toBe('one')
  })

  it('should clear the error of the field being edited', () => {
    let state = load({ title: '' })
    state = documentReducer(state, {
      type: 'setErrors',
      errors: { title: 'Title is required', rank: 'Rank is required' },
    })
    state = documentReducer(state, { type: 'setValue', path: ['title'], value: 'x' })

    expect(state.errors).toEqual({ rank: 'Rank is required' })
  })

  it('should reset every edit', () => {
    let state = load({ title: 'a', sections: [{ heading: 'one' }] })
    state = documentReducer(state, { type: 'setValue', path: ['title'], value: 'b' })
    state = documentReducer(state, { type: 'reset' })

    expect(state.current).toBe(state.initial)
    expect(isDirty(state)).toBe(false)
  })

  it('should reset a single field and leave the others edited', () => {
    let state = load({ title: 'a', rank: 1 })
    state = documentReducer(state, { type: 'setValue', path: ['title'], value: 'b' })
    state = documentReducer(state, { type: 'setValue', path: ['rank'], value: 2 })
    state = documentReducer(state, { type: 'resetField', path: ['title'] })

    expect(state.current.title).toBe('a')
    expect(state.current.rank).toBe(2)
    expect(isDirty(state)).toBe(true)
  })

  it('should adopt the saved document as the new baseline', () => {
    let state = load({ title: 'a' })
    state = documentReducer(state, { type: 'setValue', path: ['title'], value: 'b' })
    state = documentReducer(state, {
      type: 'markSaved',
      document: { title: 'b', _revision: 2 },
    })

    expect(state.status).toBe('saved')
    expect(state.current._revision).toBe(2)
    expect(isDirty(state)).toBe(false)
  })

  it('should track the save status', () => {
    const state = documentReducer(load({}), { type: 'setStatus', status: 'saving' })
    expect(state.status).toBe('saving')
  })
})

describe('isDirty', () => {
  it('should be false right after loading', () => {
    expect(isDirty(load({ title: 'a', sections: [{ heading: 'one' }] }))).toBe(false)
  })

  it('should be true after an edit and false again after reverting it by hand', () => {
    let state = load({ title: 'Original', sections: [{ heading: 'one' }] })
    expect(isDirty(state)).toBe(false)

    state = documentReducer(state, { type: 'setValue', path: ['title'], value: 'Originalx' })
    expect(isDirty(state)).toBe(true)

    state = documentReducer(state, { type: 'setValue', path: ['title'], value: 'Original' })
    expect(isDirty(state)).toBe(false)
  })

  it('should be false again after reverting a nested edit', () => {
    let state = load({ sections: [{ heading: 'one' }, { heading: 'two' }] })
    state = documentReducer(state, {
      type: 'setValue',
      path: ['sections', 1, 'heading'],
      value: 'edited',
    })
    expect(isDirty(state)).toBe(true)

    state = documentReducer(state, {
      type: 'setValue',
      path: ['sections', 1, 'heading'],
      value: 'two',
    })
    expect(isDirty(state)).toBe(false)
  })

  it('should list the top-level fields that changed', () => {
    let state = load({ title: 'a', rank: 1 })
    state = documentReducer(state, { type: 'setValue', path: ['rank'], value: 2 })

    expect(getDirtyPaths(state)).toEqual(['rank'])
  })
})

describe('stable array item keys', () => {
  it('should attach a key to every object in an array', () => {
    const state = load({ sections: [{ heading: 'one' }, { heading: 'two' }] })
    const keys = state.current.sections.map((item: any) => item[ITEM_KEY])

    expect(keys.every((key: string) => typeof key === 'string' && key.length > 0)).toBe(true)
    expect(new Set(keys).size).toBe(2)
  })

  it('should key nested arrays too', () => {
    const state = load({ seo: { links: [{ href: '/a' }] } })
    expect(state.current.seo.links[0][ITEM_KEY]).toBeTruthy()
  })

  it('should keep keys stable across a reorder', () => {
    let state = load({ sections: [{ heading: 'one' }, { heading: 'two' }] })
    const [first, second] = state.current.sections

    state = documentReducer(state, {
      type: 'setValue',
      path: ['sections'],
      value: [second, first],
    })

    expect(state.current.sections[0][ITEM_KEY]).toBe(second[ITEM_KEY])
    expect(state.current.sections[1][ITEM_KEY]).toBe(first[ITEM_KEY])
    expect(getItemKey(state.current.sections[0], 0)).toBe(second[ITEM_KEY])
  })

  it('should give a newly added item its own key', () => {
    let state = load({ sections: [{ heading: 'one' }] })
    const existing = state.current.sections[0]

    state = documentReducer(state, {
      type: 'setValue',
      path: ['sections'],
      value: [...state.current.sections, { heading: 'new' }],
    })

    expect(state.current.sections[0][ITEM_KEY]).toBe(existing[ITEM_KEY])
    expect(state.current.sections[1][ITEM_KEY]).toBeTruthy()
    expect(state.current.sections[1][ITEM_KEY]).not.toBe(existing[ITEM_KEY])
  })

  it('should fall back to the position for primitive items', () => {
    expect(getItemKey('tag', 3)).toBe('idx-3')
  })

  it('should not report a reorder-free edit as dirty because of the keys', () => {
    const raw = { sections: [{ heading: 'one' }] }
    const state = load(raw)
    expect(isDirty(state)).toBe(false)
  })

  it('should strip keys from a value', () => {
    const keyed = ensureItemKeys({ sections: [{ heading: 'one' }] })
    expect(stripItemKeys(keyed)).toEqual({ sections: [{ heading: 'one' }] })
  })
})

describe('store to buildSavePayload round trip', () => {
  it('should round trip an array of objects in order and without editor keys', () => {
    let state = load({
      title: 'a',
      sections: [{ heading: 'one', body: 'first' }, { heading: 'two', body: 'second' }],
    })

    // reorder, then edit the item that moved
    const [first, second] = state.current.sections
    state = documentReducer(state, {
      type: 'setValue',
      path: ['sections'],
      value: [second, first],
    })
    state = documentReducer(state, {
      type: 'setValue',
      path: ['sections', 0, 'body'],
      value: 'edited',
    })

    const payload = buildSavePayload(state.current, schema, 'draft')

    expect(payload.sections).toEqual([
      { heading: 'two', body: 'edited' },
      { heading: 'one', body: 'first' },
    ])
    expect(JSON.stringify(payload)).not.toContain(ITEM_KEY)
    expect(payload._status).toBe('draft')
    expect(payload._type).toBe('article')
  })

  it('should drop prototype-polluting keys from nested values', () => {
    const document = JSON.parse(
      '{"seo": {"metaTitle": "a", "__proto__": {"polluted": true}}}'
    )
    const payload = buildSavePayload(document, schema, 'draft')

    expect(payload.seo).toEqual({ metaTitle: 'a' })
    expect(({} as any).polluted).toBeUndefined()
  })
})

describe('collectValidationErrors', () => {
  const options = {
    getPlugin: (type: string) =>
      type === 'string'
        ? {
            validate: (value: any, definition: any) => {
              const max = definition?.validation?.maxLength
              if (max && String(value).length > max) {
                return { isValid: false, errors: [`${definition.title} is too long`] }
              }
              return { isValid: true, errors: [] }
            },
          }
        : undefined,
  }

  it('should collect nested errors keyed by path', () => {
    const errors = collectValidationErrors(
      {
        title: 'a',
        rank: 1,
        featured: false,
        seo: { metaTitle: '' },
        sections: [{ heading: 'ok' }, { heading: '' }],
      },
      schema,
      options
    )

    expect(errors['seo.metaTitle']).toBe('Meta title is required')
    expect(errors['sections[1].heading']).toBe('Heading is required')
    expect(errors['sections[0].heading']).toBeUndefined()
  })

  it('should not report a required boolean false or number 0 as missing', () => {
    const errors = collectValidationErrors(
      {
        title: 'a',
        rank: 0,
        featured: false,
        seo: { metaTitle: 'm' },
        sections: [],
      },
      schema,
      options
    )

    expect(errors).toEqual({})
  })

  it('should report missing required top-level fields', () => {
    const errors = collectValidationErrors({ rank: 0, featured: false }, schema, options)

    expect(errors.title).toBe('Title is required')
    expect(errors['seo.metaTitle']).toBeUndefined()
  })

  it('should delegate to the field plugin for non-empty values', () => {
    const errors = collectValidationErrors(
      { title: 'far too long', rank: 0, featured: false },
      { name: 'article', fields: { title: { type: 'string', title: 'Title', validation: { maxLength: 3 } } } },
      options
    )

    expect(errors.title).toBe('Title is too long')
  })

  it('should skip fields hidden by conditional visibility', () => {
    const conditionalSchema = {
      name: 'article',
      fields: {
        mode: { type: 'string', title: 'Mode' },
        legacyId: { type: 'string', title: 'Legacy id', required: true, hidden: true },
      },
    }

    const errors = collectValidationErrors({ mode: 'a' }, conditionalSchema, {
      ...options,
      isVisible: (definition: any) => definition.hidden !== true,
    })

    expect(errors).toEqual({})
  })

  it('should restrict the result to one field subtree when a rootPath is given', () => {
    const errors = collectValidationErrors({}, schema, {
      ...options,
      rootPath: ['title'],
    })

    expect(errors).toEqual({ title: 'Title is required' })
  })

  it('should survive a plugin that throws', () => {
    const errors = collectValidationErrors(
      { title: 'a' },
      { name: 'article', fields: { title: { type: 'string', title: 'Title' } } },
      {
        getPlugin: () => ({
          validate: () => {
            throw new Error('boom')
          },
        }),
      }
    )

    expect(errors).toEqual({})
  })
})
