import type { ContentSchema } from '@trokky/trokky'

/**
 * The standing sections each issue of the Almanac is organised into.
 */
export const categories: ContentSchema = {
  name: 'categories',
  type: 'document',
  title: 'Categories',
  description: 'Standing sections of the quarterly.',
  fields: {
    title: {
      type: 'string',
      required: true,
      description: 'Section name, e.g. "Deep Sky".',
    },
    slug: {
      type: 'slug',
      required: true,
      source: 'title',
      autoGenerate: true,
      unique: true,
      maxLength: 64,
      description: 'URL segment for the section index.',
    },
    description: {
      type: 'text',
      description: 'What belongs in this section.',
      validation: { maxLength: 400 },
    },
  },
}
