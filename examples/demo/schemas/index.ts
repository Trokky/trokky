import type { ContentSchema } from '@trokky/trokky'

import { posts } from './posts.js'
import { authors } from './authors.js'
import { categories } from './categories.js'
import { siteSettings } from './site-settings.js'

export { posts, authors, categories, siteSettings }

/** Every schema the demo registers, in the order the Studio should learn them. */
export const schemas: ContentSchema[] = [posts, authors, categories, siteSettings]
