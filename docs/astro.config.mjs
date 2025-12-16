import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Trokky',
      description: 'Modern, composable CMS for developers',
      logo: {
        src: './src/assets/logo.svg',
        replacesTitle: false,
      },
      favicon: '/favicon.svg',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/Trokky/trokky' },
      ],
      editLink: {
        baseUrl: 'https://github.com/Trokky/trokky/edit/main/docs/',
      },
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', slug: 'getting-started/introduction' },
            { label: 'Installation', slug: 'getting-started/installation' },
            { label: 'Quick Start', slug: 'getting-started/quick-start' },
            { label: 'Core Concepts', slug: 'getting-started/concepts' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Defining Schemas', slug: 'guides/schemas' },
            { label: 'Storage Adapters', slug: 'guides/storage-adapters' },
            { label: 'Authentication', slug: 'guides/authentication' },
            { label: 'Media Handling', slug: 'guides/media' },
            { label: 'Studio Customization', slug: 'guides/studio' },
            { label: 'Deployment', slug: 'guides/deployment' },
          ],
        },
        {
          label: 'Packages',
          items: [
            { label: 'Overview', slug: 'packages/overview' },
            { label: '@trokky/core', slug: 'packages/core' },
            { label: '@trokky/routes', slug: 'packages/routes' },
            { label: '@trokky/studio', slug: 'packages/studio' },
            { label: '@trokky/client', slug: 'packages/client' },
            { label: '@trokky/express', slug: 'packages/express' },
            { label: '@trokky/nextjs', slug: 'packages/nextjs' },
            {
              label: 'Storage Adapters',
              items: [
                { label: 'Filesystem', slug: 'packages/adapters/filesystem' },
                { label: 'Cloudflare', slug: 'packages/adapters/cloudflare' },
                { label: 'S3', slug: 'packages/adapters/s3' },
              ],
            },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Configuration', slug: 'reference/configuration' },
            { label: 'Schema Types', slug: 'reference/schema-types' },
            { label: 'Field Types', slug: 'reference/field-types' },
            { label: 'Features', slug: 'reference/features' },
            { label: 'HTTP API', slug: 'reference/http-api' },
          ],
        },
        {
          label: 'Recipes',
          items: [
            { label: 'Blog CMS', slug: 'recipes/blog-cms' },
            { label: 'Next.js App Router', slug: 'recipes/nextjs-app-router' },
            { label: 'Custom Fields', slug: 'recipes/custom-fields' },
          ],
        },
      ],
    }),
  ],
});
