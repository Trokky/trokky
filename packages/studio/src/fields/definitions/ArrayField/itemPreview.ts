/**
 * The title and subtitle an object item shows in the collapsed list: the
 * explicit preview config if the schema has one, otherwise the first common
 * title field the item happens to have.
 */
export function getItemPreview(item: any, itemDef: any): { title?: string; subtitle?: string } {
  if (!item || typeof item !== 'object') {
    return {};
  }

  // If explicit preview config exists, use it
  if (itemDef?.preview) {
    const preview = itemDef.preview;
    const title = preview.title && item[preview.title] ? String(item[preview.title]) : undefined;
    const subtitle = preview.subtitle && item[preview.subtitle] ? String(item[preview.subtitle]) : undefined;
    if (title) {
      return { title, subtitle };
    }
  }

  // Auto-detect: try common field names for object items
  if (itemDef?.type === 'object') {
    const commonTitleFields = ['title', 'name', 'label', 'heading'];
    for (const field of commonTitleFields) {
      if (item[field]) {
        return { title: String(item[field]) };
      }
    }
  }

  return {};
}
