# Migration from Sanity to Trokky v2

## 🎯 Migration Overview

This guide provides a comprehensive strategy for migrating from Sanity to Trokky v2. The migration process is designed to be as smooth as possible, with automated tools and clear manual steps to ensure no data or functionality is lost.

## 🚀 Quick Migration (Automated)

For most projects, the automated migration tool will handle the majority of the work:

```bash
# Install migration tool
npm install -g @trokky/migrate

# Run migration
npx trokky migrate \
  --from sanity \
  --project-id your-sanity-project-id \
  --dataset production \
  --token your-sanity-token \
  --output ./my-trokky-project
```

## 📋 Migration Checklist

### Pre-Migration Assessment

- [ ] **Export Sanity data** - Use Sanity's export tools as backup
- [ ] **Document custom components** - List any custom Sanity Studio components
- [ ] **Identify GROQ queries** - Document all GROQ queries used in your frontend
- [ ] **Review schema structure** - Note any complex schema relationships
- [ ] **Check media usage** - Document image transformations and CDN usage

### Data Migration

- [ ] **Schema migration** - Convert Sanity schemas to Trokky format
- [ ] **Document migration** - Transfer all content documents
- [ ] **Media migration** - Download and organize media files
- [ ] **Reference resolution** - Ensure all document references work
- [ ] **Validation** - Verify all data migrated correctly

### Code Migration

- [ ] **Frontend queries** - Replace GROQ with REST/GraphQL
- [ ] **Image handling** - Update image URLs and transformations
- [ ] **Studio customizations** - Recreate custom Studio components
- [ ] **Deployment** - Set up new hosting and deployment pipeline

## 🔄 Schema Migration

### Sanity Schema → Trokky Schema

**Sanity Schema Example:**
```javascript
// schemas/blogPost.js
export default {
  name: 'blogPost',
  title: 'Blog Post',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: Rule => Rule.required().min(10).max(80)
    },
    {
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96
      }
    },
    {
      name: 'author',
      title: 'Author',
      type: 'reference',
      to: {type: 'author'}
    },
    {
      name: 'mainImage',
      title: 'Main image',
      type: 'image',
      options: {
        hotspot: true
      }
    },
    {
      name: 'categories',
      title: 'Categories',
      type: 'array',
      of: [{type: 'reference', to: {type: 'category'}}]
    },
    {
      name: 'body',
      title: 'Body',
      type: 'blockContent'
    }
  ]
}
```

**Equivalent Trokky Schema:**
```typescript
// schemas/blog-post.ts
import { defineSchema } from '@trokky/core'

export default defineSchema({
  name: 'blog-post',
  title: 'Blog Post',
  type: 'collection',
  fields: {
    title: {
      type: 'string',
      title: 'Title',
      required: true,
      validation: {
        minLength: 10,
        maxLength: 80
      }
    },
    slug: {
      type: 'slug',
      title: 'Slug',
      source: 'title',
      required: true,
      validation: {
        maxLength: 96
      }
    },
    author: {
      type: 'reference',
      title: 'Author',
      collection: 'authors',
      required: true
    },
    mainImage: {
      type: 'image',
      title: 'Main Image',
      options: {
        hotspot: true
      }
    },
    categories: {
      type: 'array',
      title: 'Categories',
      items: {
        type: 'reference',
        collection: 'categories'
      }
    },
    body: {
      type: 'richText',
      title: 'Body'
    }
  }
})
```

### Field Type Mapping

| Sanity Type | Trokky Type | Notes |
|-------------|-------------|-------|
| `string` | `string` | Direct mapping |
| `text` | `textarea` | Direct mapping |
| `number` | `number` | Direct mapping |
| `boolean` | `boolean` | Direct mapping |
| `date` | `date` | Direct mapping |
| `datetime` | `datetime` | Direct mapping |
| `slug` | `slug` | Direct mapping |
| `image` | `image` | Hotspot support included |
| `file` | `file` | Direct mapping |
| `array` | `array` | Direct mapping |
| `object` | `object` | Direct mapping |
| `reference` | `reference` | Use `collection` instead of `to` |
| `blockContent` | `richText` | Portable Text → Rich Text |
| `geopoint` | `geopoint` | Direct mapping |

## 📊 Data Migration Process

### Automated Migration Steps

1. **Schema Analysis**
   - Parse Sanity schema files
   - Generate equivalent Trokky schemas
   - Create migration mapping file

2. **Document Export**
   - Use Sanity's export API to download all documents
   - Convert Sanity document format to Trokky format
   - Resolve all references and maintain relationships

3. **Media Download**
   - Download all media assets from Sanity CDN
   - Organize files in Trokky media structure
   - Update document references to new media URLs

4. **Validation**
   - Validate all migrated documents against new schemas
   - Generate migration report with any issues
   - Provide manual fix suggestions for complex cases

### Manual Migration Steps

For complex schemas or custom requirements:

#### 1. Export Sanity Data
```bash
# Export all data from Sanity
sanity dataset export production backup.tar.gz
```

#### 2. Convert Document Format
```typescript
// Migration script example
import { SanityDocument, TrokkyDocument } from '@trokky/migrate'

function convertDocument(sanityDoc: SanityDocument): TrokkyDocument {
  return {
    id: sanityDoc._id,
    ...sanityDoc,
    _collection: sanityDoc._type,
    _createdAt: sanityDoc._createdAt,
    _updatedAt: sanityDoc._updatedAt,
    _status: sanityDoc._id.startsWith('drafts.') ? 'draft' : 'published'
  }
}
```

#### 3. Resolve References
```typescript
function resolveReferences(doc: any, documents: Map<string, any>) {
  // Convert Sanity references to Trokky format
  if (doc._ref) {
    return {
      _type: 'reference',
      _collection: documents.get(doc._ref)?._type,
      _id: doc._ref
    }
  }
  return doc
}
```

## 💻 Frontend Code Migration

### Query Migration

**GROQ → GraphQL:**
```javascript
// Before (Sanity GROQ)
const query = `*[_type == "blogPost" && publishedAt < now()] | order(publishedAt desc) {
  title,
  slug,
  author->{name, image},
  mainImage,
  categories[]->{title}
}`

const posts = await client.fetch(query)
```

```typescript
// After (Trokky GraphQL)
const query = `
  query GetBlogPosts {
    blogPosts(
      filter: { _status: published }
      sort: { field: publishedAt, direction: DESC }
    ) {
      nodes {
        title
        slug
        author {
          name
          image { url }
        }
        mainImage { url }
        categories {
          title
        }
      }
    }
  }
`

const { data } = await trokky.query(query)
const posts = data.blogPosts.nodes
```

**GROQ → REST API:**
```typescript
// After (Trokky REST)
const posts = await trokky.documents.list('blog-posts', {
  filter: { _status: 'published' },
  sort: 'publishedAt_DESC',
  populate: ['author', 'categories']
})
```

### Image Handling Migration

**Sanity Image URLs:**
```javascript
// Before
import imageUrlBuilder from '@sanity/image-url'
const builder = imageUrlBuilder(client)

function urlFor(source) {
  return builder.image(source)
}

// Usage
<img src={urlFor(post.mainImage).width(300).height(200).url()} />
```

**Trokky Image URLs:**
```typescript
// After
import { TrokkyImage } from '@trokky/client'

// Usage
<TrokkyImage 
  src={post.mainImage} 
  width={300} 
  height={200}
  alt={post.mainImage.alt}
/>
```

## 🎨 Studio Migration

### Sanity Studio → Trokky Studio

**Structure Configuration:**
```typescript
// Sanity deskTool structure
export default () =>
  S.list()
    .title('Content')
    .items([
      S.listItem()
        .title('Blog Posts')
        .child(S.documentTypeList('blogPost').title('Blog Posts')),
      S.listItem()
        .title('Authors')
        .child(S.documentTypeList('author').title('Authors'))
    ])
```

```typescript
// Trokky studio structure
export default defineStudioStructure({
  title: 'Content',
  items: [
    {
      type: 'collection',
      collection: 'blog-posts',
      title: 'Blog Posts',
      icon: 'DocumentText'
    },
    {
      type: 'collection', 
      collection: 'authors',
      title: 'Authors',
      icon: 'Users'
    }
  ]
})
```

### Custom Components Migration

**Sanity Custom Input:**
```javascript
// Before (Sanity)
import React from 'react'
import { PatchEvent, set } from 'part:@sanity/form-builder/patch-event'

const CustomStringInput = React.forwardRef((props, ref) => {
  const { type, value, onChange } = props
  
  return (
    <input
      ref={ref}
      value={value || ''}
      onChange={e => onChange(PatchEvent.from(set(e.target.value)))}
    />
  )
})

export default CustomStringInput
```

**Trokky Custom Field:**
```typescript
// After (Trokky)
import { defineFieldComponent } from '@trokky/studio'

export default defineFieldComponent({
  name: 'customString',
  component: ({ value, onChange, ...props }) => {
    return (
      <input
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        {...props}
      />
    )
  }
})
```

## 🚀 Deployment Migration

### Hosting Migration

**From Sanity Studio Hosting:**
```bash
# Before
sanity deploy
```

**To Trokky Deployment:**
```bash
# Vercel
vercel --build-env TROKKY_API_TOKEN=your-token

# Netlify  
netlify deploy --build

# Cloudflare Pages
wrangler pages publish dist
```

### Environment Variables

```bash
# Replace Sanity env vars
- SANITY_PROJECT_ID=abc123
- SANITY_DATASET=production  
- SANITY_TOKEN=sk_token

# With Trokky env vars
+ TROKKY_API_URL=https://your-api.com
+ TROKKY_API_TOKEN=your-token
+ TROKKY_STUDIO_URL=https://your-studio.com
```

## 🛠️ Migration Tools

### CLI Migration Command

```bash
npx @trokky/migrate \
  --from sanity \
  --project-id abc123 \
  --dataset production \
  --token your-token \
  --output ./migrated-project \
  --include-media \
  --format typescript
```

### Migration Options

- `--dry-run` - Preview migration without making changes
- `--include-media` - Download and migrate media files  
- `--format` - Output format (typescript/javascript)
- `--batch-size` - Number of documents per batch
- `--validate` - Validate schemas before migration

### Post-Migration Validation

```bash
# Validate migrated data
npx trokky validate --config ./trokky.config.ts

# Generate type definitions
npx trokky generate-types

# Test API endpoints
npx trokky test-api
```

## 📊 Migration Timeline

### Typical Project Timeline

**Small Project (< 1000 documents):**
- Schema migration: 2-4 hours
- Data migration: 1-2 hours  
- Frontend migration: 4-8 hours
- **Total: 1-2 days**

**Medium Project (1000-10000 documents):**
- Schema migration: 4-8 hours
- Data migration: 2-4 hours
- Frontend migration: 8-16 hours
- **Total: 2-4 days**

**Large Project (> 10000 documents):**
- Schema migration: 8-16 hours
- Data migration: 4-8 hours
- Frontend migration: 16-32 hours
- **Total: 4-7 days**

## 🆘 Common Migration Issues

### Issue: Complex Schema Relationships
**Solution:** Use manual migration for complex nested references

### Issue: Custom Sanity Plugins
**Solution:** Recreate as Trokky custom fields or request feature

### Issue: Portable Text Complexity
**Solution:** Use Rich Text migration tool with custom block handlers

### Issue: Large Media Libraries
**Solution:** Use batch migration with CDN migration tools

## 🎯 Post-Migration Optimization

### Performance Improvements
- Set up proper caching for API responses
- Optimize image delivery with CDN
- Implement proper database indexing

### SEO Considerations
- Ensure all URLs remain consistent
- Set up proper redirects for changed paths
- Verify structured data migration

### Monitoring Setup
- Configure error tracking
- Set up performance monitoring  
- Implement content backup strategies

---

This migration guide ensures a smooth transition from Sanity to Trokky v2, preserving all your content and functionality while unlocking the benefits of local-first development and framework freedom.