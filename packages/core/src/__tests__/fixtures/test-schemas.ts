import { ContentSchema } from '../../types/index.js'

export const blogPostSchema: ContentSchema = {
  name: 'posts',
  type: 'document',
  title: 'Blog Posts',
  description: 'Blog post content',
  fields: {
    title: {
      type: 'string',
      required: true,
      description: 'Post title'
    },
    content: {
      type: 'string',
      required: true,
      description: 'Post content'
    },
    author: {
      type: 'string',
      required: true,
      description: 'Author name'
    },
    publishedAt: {
      type: 'date',
      required: false,
      description: 'Publication date'
    },
    tags: {
      type: 'array',
      required: false,
      items: {
        type: 'string',
        required: true
      }
    },
    metadata: {
      type: 'object',
      required: false,
      properties: {
        excerpt: {
          type: 'string',
          required: false
        },
        readingTime: {
          type: 'number',
          required: false
        },
        featured: {
          type: 'boolean',
          required: false
        }
      }
    },
    featuredImage: {
      type: 'media',
      required: false,
      description: 'Featured image'
    }
  }
}

export const userSchema: ContentSchema = {
  name: 'users',
  type: 'document',
  title: 'Users',
  description: 'User profiles',
  fields: {
    email: {
      type: 'string',
      required: true,
      description: 'User email'
    },
    name: {
      type: 'string',
      required: true,
      description: 'Full name'
    },
    bio: {
      type: 'string',
      required: false,
      description: 'User biography'
    },
    avatar: {
      type: 'media',
      required: false,
      description: 'Profile picture'
    },
    active: {
      type: 'boolean',
      required: false,
      description: 'Account status'
    }
  }
}

export const settingsSchema: ContentSchema = {
  name: 'settings',
  type: 'singleton',
  title: 'Site Settings',
  description: 'Global site configuration',
  fields: {
    siteName: {
      type: 'string',
      required: true,
      description: 'Site name'
    },
    siteDescription: {
      type: 'string',
      required: false,
      description: 'Site description'
    },
    maintenanceMode: {
      type: 'boolean',
      required: false,
      description: 'Maintenance mode toggle'
    },
    socialLinks: {
      type: 'array',
      required: false,
      items: {
        type: 'object',
        required: true,
        properties: {
          platform: {
            type: 'string',
            required: true
          },
          url: {
            type: 'string',
            required: true
          }
        }
      }
    }
  }
}

export const testSchemas = [blogPostSchema, userSchema, settingsSchema]

// Sample data for testing
export const sampleBlogPost = {
  title: 'Test Blog Post',
  content: 'This is a test blog post content.',
  author: 'John Doe',
  publishedAt: new Date('2024-01-01'),
  tags: ['test', 'blog'],
  metadata: {
    excerpt: 'This is a test...',
    readingTime: 5,
    featured: true
  }
}

export const sampleUser = {
  email: 'john@example.com',
  name: 'John Doe',
  bio: 'A test user',
  active: true
}

export const invalidBlogPost = {
  // Missing required fields
  content: 'Missing title and author'
}

export const invalidUser = {
  email: 'invalid-email', // Invalid email format would be caught by custom validation
  // Missing required name field
}