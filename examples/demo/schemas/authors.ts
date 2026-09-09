import type { ContentSchema } from '@trokky/trokky'

/**
 * Contributors to the Almanac. Every author here is invented.
 */
export const authors: ContentSchema = {
  name: 'authors',
  type: 'document',
  title: 'Authors',
  description: 'People who write for The Meridian Almanac.',
  fields: {
    name: {
      type: 'string',
      required: true,
      description: 'Byline, as it should be printed.',
    },
    slug: {
      type: 'slug',
      required: true,
      source: 'name',
      autoGenerate: true,
      unique: true,
      maxLength: 64,
      description: 'URL segment for the contributor page.',
    },
    bio: {
      type: 'text',
      description: 'Short biography shown under the byline.',
      validation: { maxLength: 600 },
    },
    avatar: {
      type: 'media',
      description: 'Portrait or observatory snapshot.',
      options: { accept: 'image/*' },
    },
    links: {
      type: 'array',
      description: 'Places to find this contributor elsewhere.',
      of: {
        type: 'object',
        fields: {
          label: { type: 'string', required: true, description: 'e.g. "Field notebook".' },
          url: { type: 'string', required: true, description: 'Full URL, including the scheme.' },
          primary: { type: 'boolean', description: 'Show this link first.' },
        },
      },
    },
  },
}
