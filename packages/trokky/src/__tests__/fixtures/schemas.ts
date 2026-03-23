/**
 * Test fixture schemas
 */

export const articleSchema = {
  name: 'article',
  title: 'Article',
  fields: [
    { name: 'title', type: 'string', required: true },
    { name: 'slug', type: 'slug', options: { source: 'title' } },
    { name: 'body', type: 'string' },
    { name: 'published', type: 'boolean' },
    { name: 'publishedAt', type: 'date' },
  ],
}

export const categorySchema = {
  name: 'category',
  title: 'Category',
  fields: [
    { name: 'title', type: 'string', required: true },
    { name: 'description', type: 'string' },
  ],
}

export const settingsSchema = {
  name: 'settings',
  title: 'Settings',
  singleton: true,
  fields: [
    { name: 'siteName', type: 'string', required: true },
    { name: 'siteUrl', type: 'string' },
  ],
}

export const testSchemas = [articleSchema, categorySchema, settingsSchema]
