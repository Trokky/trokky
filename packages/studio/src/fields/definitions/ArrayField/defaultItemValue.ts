/**
 * The value a freshly added array item starts at, by item type. Object items
 * carry their `_type` and any per-field defaults; reference and media items
 * start as the empty shape their field understands.
 */
// Helper function to get default value for new items
export function getDefaultItemValue(itemDefinition: any): any {
  if (itemDefinition?.default !== undefined) {
    return itemDefinition.default;
  }

  switch (itemDefinition?.type) {
    case 'string':
      return '';
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'date':
      return new Date().toISOString();
    case 'array':
      return [];
    case 'object':
      // Include _type field for object items if specified
      const baseObject: any = {};
      if (itemDefinition.name) {
        baseObject._type = itemDefinition.name;
      }
      // Apply default values from nested fields
      if (itemDefinition.fields) {
        for (const [fieldName, fieldDef] of Object.entries(itemDefinition.fields)) {
          const def = fieldDef as any;
          if (def?.default !== undefined) {
            baseObject[fieldName] = def.default;
          }
        }
      }
      return baseObject;
    case 'reference':
      // Reference field expects { _type: 'reference' } for empty state
      return { _type: 'reference' };
    case 'media':
      // Media field expects { _type: 'media' } for empty state - MediaField handles this
      return { _type: 'media' };
    case 'image':
      // Image field (alias for media) expects same structure
      return { _type: 'media' };
    default:
      // Return empty object for unknown types to avoid null sanitization
      return {};
  }
}
