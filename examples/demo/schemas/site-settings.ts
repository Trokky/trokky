import type { ContentSchema } from '@trokky/trokky'

/**
 * Masthead and global settings for the Almanac.
 *
 * `singleton: true` is what makes this collection hold exactly one document. The
 * schema is the source of truth for that invariant — the `type: 'singleton'`
 * entry in `structure.ts` only says which document the navigation opens. Drop
 * the flag here and the server refuses to boot, because a `trokky restore`
 * would regenerate this document's id and leave the navigation pointing at a
 * document that no longer exists. See
 * `packages/trokky/src/core/schema/singleton.ts`.
 */
export const siteSettings: ContentSchema = {
  name: 'siteSettings',
  type: 'singleton',
  singleton: true,
  title: 'Site Settings',
  description: 'Masthead, contact details and the current issue banner.',
  fields: {
    siteTitle: {
      type: 'string',
      required: true,
      description: 'Name of the publication.',
    },
    tagline: {
      type: 'string',
      description: 'One line under the masthead.',
    },
    about: {
      type: 'richtext',
      description: 'The "about the Almanac" text used on the colophon page.',
    },
    logo: {
      type: 'media',
      description: 'Masthead mark.',
      options: { accept: 'image/*' },
    },
    contact: {
      type: 'object',
      description: 'How readers reach the editors.',
      fields: {
        email: { type: 'string', description: 'Editorial inbox.' },
        postalAddress: { type: 'text', description: 'Address printed in the colophon.' },
        acceptsSubmissions: { type: 'boolean', description: 'Show the submissions call-out.' },
      },
    },
    socialLinks: {
      type: 'array',
      description: 'Where the Almanac posts between issues.',
      of: {
        type: 'object',
        fields: {
          platform: { type: 'string', required: true, description: 'Name of the network.' },
          url: { type: 'string', required: true, description: 'Full profile URL.' },
          handle: { type: 'string', description: 'Displayed handle.' },
        },
      },
    },
    issueNumber: {
      type: 'number',
      description: 'Number of the issue currently on the front page.',
      validation: { min: 1 },
    },
    showIssueBanner: {
      type: 'boolean',
      description: 'Show the "new issue out now" banner across the site.',
    },
    lastUpdated: {
      type: 'date',
      description: 'When these settings were last revised.',
    },
  },
}
