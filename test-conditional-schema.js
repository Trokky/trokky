// Test schema for conditional field visibility in DocumentForm
export const testConditionalSchema = {
  name: 'testPage',
  title: 'Test Page',
  type: 'document',
  fields: {
    layout: {
      type: 'string',
      title: 'Layout',
      options: {
        list: [
          { title: 'Simple', value: 'simple' },
          { title: 'With Sidebar', value: 'sidebar' }
        ]
      },
      default: 'simple'
    },

    // Test function-based hidden
    sidebarTitle: {
      type: 'string',
      title: 'Sidebar Title',
      hidden: (doc) => doc.layout !== 'sidebar'
    },

    // Test boolean hidden
    internalField: {
      type: 'string',
      title: 'Internal Field',
      hidden: true
    },

    // Test conditional
    publishDate: {
      type: 'date',
      title: 'Publish Date',
      conditional: {
        field: 'layout',
        value: 'simple',
        operator: 'equals'
      }
    },

    // Test multiple conditions
    advancedSettings: {
      type: 'object',
      title: 'Advanced Settings',
      conditional: {
        conditions: [
          { field: 'layout', value: 'sidebar', operator: 'equals' },
          { field: 'sidebarTitle', operator: 'exists' }
        ],
        logic: 'and'
      },
      fields: {
        customCss: {
          type: 'text',
          title: 'Custom CSS'
        }
      }
    }
  }
};

// Expected behavior:
// 1. Initial load: Only 'layout' field visible (default: 'simple')
// 2. When layout = 'simple': 'publishDate' should appear
// 3. When layout = 'sidebar': 'sidebarTitle' should appear, 'publishDate' should disappear
// 4. When layout = 'sidebar' AND sidebarTitle has value: 'advancedSettings' should appear
// 5. 'internalField' should never appear (hidden: true)
