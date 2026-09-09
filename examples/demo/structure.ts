import { StructureBuilder } from '@trokky/trokky/structure'
import type { TrokkyStructure } from '@trokky/trokky/structure'
import { SchemaRegistry } from '@trokky/trokky'

import { schemas } from './schemas/index.js'

/**
 * Studio navigation for The Meridian Almanac.
 *
 * The structure is a plain `TrokkyStructure` object; `StructureBuilder` is the
 * thing that validates it against the registered schemas. Validating here means
 * a typo in a `schemaType` shows up as a console warning at boot rather than as
 * a dead navigation link in the Studio.
 */
export const structure: TrokkyStructure = {
  title: 'The Meridian Almanac',
  items: [
    {
      type: 'singleton',
      id: 'site-settings',
      title: 'Site Settings',
      icon: 'cog',
      // `schemaType` must name a schema that itself declares `singleton: true`,
      // otherwise the server refuses to boot.
      schemaType: 'siteSettings',
      documentId: 'site-settings',
      options: { autoCreate: true },
    },
    { type: 'divider', style: 'line' },
    {
      type: 'group',
      id: 'editorial',
      title: 'Editorial',
      icon: 'newspaper',
      collapsible: true,
      items: [
        {
          type: 'documentList',
          id: 'posts',
          title: 'Posts',
          icon: 'document-text',
          schemaType: 'posts',
          defaultOrdering: [{ field: 'publishedAt', direction: 'desc' }],
          options: {
            pageSize: 20,
            searchable: true,
            searchFields: ['title', 'excerpt'],
            sortable: true,
            sortFields: ['title', 'publishedAt', 'readingMinutes'],
          },
        },
        {
          type: 'documentList',
          id: 'featured-posts',
          title: 'Featured',
          icon: 'star',
          schemaType: 'posts',
          // Filters are MongoDB-style documents.
          filter: { featured: { $eq: true } },
          defaultOrdering: [{ field: 'publishedAt', direction: 'desc' }],
        },
      ],
    },
    {
      type: 'group',
      id: 'taxonomy',
      title: 'People & Sections',
      icon: 'users',
      collapsible: true,
      items: [
        {
          type: 'documentList',
          id: 'authors',
          title: 'Authors',
          icon: 'user',
          schemaType: 'authors',
          defaultOrdering: [{ field: 'name', direction: 'asc' }],
          options: { searchable: true, searchFields: ['name', 'bio'] },
        },
        {
          type: 'documentList',
          id: 'categories',
          title: 'Categories',
          icon: 'tag',
          schemaType: 'categories',
          defaultOrdering: [{ field: 'title', direction: 'asc' }],
        },
      ],
    },
  ],
  metadata: {
    version: '1.0.0',
    description: 'Navigation for the Almanac’s editorial team.',
  },
}

/**
 * Validate the structure above against the demo's schemas.
 *
 * Returns the same structure so it can be dropped straight into
 * `studio.structure`; problems are reported on stderr rather than thrown, so a
 * cosmetic navigation mistake never stops the demo from starting.
 */
export function validateStructure(): TrokkyStructure {
  const builder = new StructureBuilder(new SchemaRegistry(schemas))
  const result = builder.validate(structure)

  for (const error of result.errors) {
    console.warn(`[structure] ${error.path}: ${error.message}`)
  }
  for (const warning of result.warnings) {
    console.warn(`[structure] ${warning.path}: ${warning.message}`)
  }

  return structure
}
