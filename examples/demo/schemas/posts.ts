import type { ContentSchema } from '@trokky/trokky'

/**
 * An article in The Meridian Almanac — an observing guide, a field report, or
 * one of the quarterly's short essays on the night sky.
 */
export const posts: ContentSchema = {
  name: 'posts',
  type: 'document',
  title: 'Posts',
  description: 'Observing guides, field reports and essays from the Almanac.',
  fields: {
    title: {
      type: 'string',
      required: true,
      description: 'Headline as it appears on the issue contents page.',
    },
    slug: {
      type: 'slug',
      required: true,
      source: 'title',
      autoGenerate: true,
      unique: true,
      maxLength: 96,
      description: 'URL segment, generated from the title.',
    },
    excerpt: {
      type: 'text',
      description: 'One or two sentences used in listings and the newsletter.',
      validation: { maxLength: 280 },
    },
    body: {
      type: 'richtext',
      required: true,
      description: 'The article itself.',
    },
    coverImage: {
      type: 'media',
      description: 'Lead image — a plate, a chart, or an astrophotograph.',
      options: { accept: 'image/*' },
    },
    author: {
      type: 'reference',
      to: 'authors',
      collection: 'authors',
      required: true,
      description: 'Who wrote it.',
    },
    categories: {
      type: 'array',
      description: 'Sections of the Almanac this article belongs to.',
      of: {
        type: 'reference',
        to: 'categories',
        collection: 'categories',
      },
    },
    seo: {
      type: 'object',
      description: 'Overrides for search engines and social cards.',
      fields: {
        metaTitle: { type: 'string', description: 'Defaults to the title when empty.' },
        metaDescription: { type: 'text', description: 'Defaults to the excerpt when empty.' },
        canonicalUrl: { type: 'string', description: 'Set when the piece first appeared elsewhere.' },
        noIndex: { type: 'boolean', description: 'Keep this article out of search results.' },
      },
    },
    featured: {
      type: 'boolean',
      description: 'Pin to the top of the issue front page.',
    },
    publishedAt: {
      type: 'date',
      description: 'Publication date. Articles dated in the future read as scheduled.',
    },
    readingMinutes: {
      type: 'number',
      description: 'Estimated reading time in minutes.',
      validation: { min: 1, max: 120 },
    },
  },
}
