/**
 * Validation Schemas
 * Zod schemas for validating structure configurations
 */

import { z } from 'zod'

/**
 * Query filter schema
 */
export const QueryFilterSchema: z.ZodSchema = z.lazy(() =>
  z.record(
    z.union([
      z.any(), // Exact match
      z.object({
        $eq: z.any().optional(),
        $ne: z.any().optional(),
        $gt: z.any().optional(),
        $gte: z.any().optional(),
        $lt: z.any().optional(),
        $lte: z.any().optional(),
        $in: z.array(z.any()).optional(),
        $nin: z.array(z.any()).optional(),
        $exists: z.boolean().optional(),
        $regex: z.string().optional(),
        $contains: z.any().optional(),
        $startsWith: z.string().optional(),
        $endsWith: z.string().optional(),
        $size: z.number().optional(),
        $all: z.array(z.any()).optional(),
        $elemMatch: QueryFilterSchema.optional()
      }).optional(),
      z.object({
        $and: z.array(QueryFilterSchema).optional(),
        $or: z.array(QueryFilterSchema).optional(),
        $not: QueryFilterSchema.optional(),
        $nor: z.array(QueryFilterSchema).optional()
      }).optional()
    ])
  )
)

/**
 * Order clause schema
 */
export const OrderClauseSchema = z.object({
  field: z.string(),
  direction: z.enum(['asc', 'desc']),
  priority: z.number().optional()
})

/**
 * Permission rule schema
 */
export const PermissionRuleSchema: z.ZodSchema = z.union([
  z.boolean(),
  z.string(),
  z.array(z.string()),
  z.function(),
  z.object({
    condition: z.union([z.string(), z.function()]),
    allow: z.union([z.string(), z.array(z.string())]).optional(),
    deny: z.union([z.string(), z.array(z.string())]).optional(),
    fallback: z.lazy(() => PermissionRuleSchema).optional()
  })
])

/**
 * Permission config schema
 */
export const PermissionConfigSchema = z.object({
  read: PermissionRuleSchema.optional(),
  create: PermissionRuleSchema.optional(),
  update: PermissionRuleSchema.optional(),
  delete: PermissionRuleSchema.optional(),
  custom: z.record(PermissionRuleSchema).optional()
})

/**
 * Badge config schema
 */
export const BadgeConfigSchema = z.object({
  count: z.boolean().optional(),
  color: z.enum(['gray', 'red', 'yellow', 'green', 'blue', 'indigo', 'purple', 'pink']).optional(),
  text: z.string().optional(),
  field: z.string().optional(),
  position: z.enum(['inline', 'corner']).optional(),
  custom: z.function().optional()
})

/**
 * Bulk action config schema
 */
export const BulkActionConfigSchema = z.object({
  action: z.string(),
  title: z.string(),
  icon: z.string().optional(),
  confirm: z.string().optional(),
  permissions: PermissionConfigSchema.optional(),
  handler: z.function().optional()
})

/**
 * Filter config schema
 */
export const FilterConfigSchema = z.object({
  id: z.string(),
  label: z.string(),
  field: z.string(),
  type: z.enum(['text', 'select', 'date', 'number', 'boolean', 'range']),
  options: z.object({
    values: z.array(z.object({
      label: z.string(),
      value: z.any()
    })).optional(),
    placeholder: z.string().optional(),
    defaultValue: z.any().optional(),
    multiple: z.boolean().optional()
  }).optional()
})

/**
 * Column config schema
 */
export const ColumnConfigSchema = z.object({
  field: z.string(),
  title: z.string(),
  width: z.union([z.number(), z.string()]).optional(),
  sortable: z.boolean().optional(),
  filterable: z.boolean().optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  dataType: z.enum(['string', 'number', 'date', 'boolean', 'image', 'link']).optional(),
  formatter: z.function().optional(),
  component: z.string().optional(),
  visible: z.boolean().optional(),
  sticky: z.enum(['left', 'right']).optional()
})

/**
 * Action config schema
 */
export const ActionConfigSchema = z.object({
  id: z.string(),
  title: z.string(),
  icon: z.string().optional(),
  type: z.enum(['button', 'link', 'dropdown']).optional(),
  handler: z.function().optional(),
  permissions: PermissionConfigSchema.optional(),
  confirm: z.boolean().optional(),
  confirmMessage: z.string().optional(),
  style: z.enum(['default', 'primary', 'secondary', 'danger']).optional(),
  contextMenu: z.boolean().optional()
})

/**
 * View config schema
 */
export const ViewConfigSchema = z.object({
  type: z.string(),
  title: z.string().optional(),
  default: z.boolean().optional(),
  options: z.record(z.any()).optional(),
  permissions: PermissionConfigSchema.optional()
})

/**
 * List view config schema
 */
export const ListViewConfigSchema = ViewConfigSchema.extend({
  type: z.literal('list'),
  options: z.object({
    columns: z.array(ColumnConfigSchema).optional(),
    pageSize: z.number().optional(),
    sortable: z.boolean().optional(),
    filterable: z.boolean().optional(),
    selectable: z.union([z.boolean(), z.literal('single'), z.literal('multiple')]).optional(),
    rowActions: z.array(ActionConfigSchema).optional(),
    density: z.enum(['compact', 'comfortable', 'spacious']).optional(),
    showRowNumbers: z.boolean().optional(),
    stickyHeader: z.boolean().optional()
  }).optional()
})

/**
 * Grid view config schema
 */
export const GridViewConfigSchema = ViewConfigSchema.extend({
  type: z.literal('grid'),
  options: z.object({
    cardSize: z.enum(['small', 'medium', 'large', 'auto']).optional(),
    imageField: z.string().optional(),
    titleField: z.string().optional(),
    subtitleField: z.string().optional(),
    columnsPerRow: z.union([z.number(), z.literal('auto')]).optional(),
    cardLayout: z.enum(['vertical', 'horizontal']).optional(),
    aspectRatio: z.union([z.number(), z.literal('auto')]).optional(),
    hoverEffects: z.boolean().optional(),
    cardActions: z.array(ActionConfigSchema).optional()
  }).optional()
})

/**
 * Calendar view config schema
 */
export const CalendarViewConfigSchema = ViewConfigSchema.extend({
  type: z.literal('calendar'),
  options: z.object({
    dateField: z.string(),
    endDateField: z.string().optional(),
    titleField: z.string().optional(),
    colorField: z.string().optional(),
    views: z.array(z.enum(['month', 'week', 'day', 'agenda'])).optional(),
    defaultView: z.enum(['month', 'week', 'day', 'agenda']).optional(),
    timeSlots: z.object({
      start: z.string().optional(),
      end: z.string().optional(),
      step: z.number().optional()
    }).optional(),
    eventClick: z.enum(['edit', 'view', 'custom']).optional(),
    allowCreate: z.boolean().optional(),
    allowDrag: z.boolean().optional()
  }).optional()
})

/**
 * Kanban column config schema
 */
export const KanbanColumnConfigSchema = z.object({
  id: z.string(),
  title: z.string(),
  color: z.string().optional(),
  limit: z.number().optional(),
  order: z.number().optional(),
  collapsed: z.boolean().optional(),
  actions: z.array(ActionConfigSchema).optional()
})

/**
 * Kanban view config schema
 */
export const KanbanViewConfigSchema = ViewConfigSchema.extend({
  type: z.literal('kanban'),
  options: z.object({
    groupBy: z.string(),
    titleField: z.string().optional(),
    subtitleField: z.string().optional(),
    assigneeField: z.string().optional(),
    priorityField: z.string().optional(),
    colorField: z.string().optional(),
    dragAndDrop: z.boolean().optional(),
    columns: z.array(KanbanColumnConfigSchema).optional(),
    cardTemplate: z.enum(['default', 'compact', 'detailed']).optional(),
    showColumnCounts: z.boolean().optional(),
    allowColumnCreate: z.boolean().optional()
  }).optional()
})

/**
 * Map view config schema
 */
export const MapViewConfigSchema = ViewConfigSchema.extend({
  type: z.literal('map'),
  options: z.object({
    locationField: z.string(),
    titleField: z.string().optional(),
    descriptionField: z.string().optional(),
    provider: z.enum(['google', 'mapbox', 'openstreet']).optional(),
    defaultZoom: z.number().optional(),
    defaultCenter: z.object({
      lat: z.number(),
      lng: z.number()
    }).optional(),
    clustering: z.boolean().optional(),
    markerIcon: z.string().optional(),
    popupTemplate: z.enum(['default', 'minimal', 'detailed']).optional()
  }).optional()
})

/**
 * Base structure item schema
 */
export const BaseStructureItemSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  icon: z.string().optional(),
  permissions: PermissionConfigSchema.optional(),
  metadata: z.record(z.any()).optional()
})

/**
 * Document list item schema
 */
export const DocumentListItemSchema = BaseStructureItemSchema.extend({
  type: z.literal('documentList'),
  schemaType: z.string(),
  filter: QueryFilterSchema.optional(),
  defaultOrdering: z.array(OrderClauseSchema).optional(),
  views: z.array(ViewConfigSchema).optional(),
  defaultView: z.string().optional(),
  badge: BadgeConfigSchema.optional(),
  bulkActions: z.array(BulkActionConfigSchema).optional(),
  options: z.object({
    pageSize: z.number().optional(),
    searchable: z.boolean().optional(),
    searchFields: z.array(z.string()).optional(),
    filterable: z.boolean().optional(),
    filters: z.array(FilterConfigSchema).optional(),
    sortable: z.boolean().optional(),
    sortFields: z.array(z.string()).optional(),
    refreshInterval: z.number().optional()
  }).optional()
})

/**
 * Singleton item schema
 */
export const SingletonItemSchema = BaseStructureItemSchema.extend({
  type: z.literal('singleton'),
  schemaType: z.string(),
  documentId: z.string().optional(),
  layout: z.object({
    type: z.enum(['default', 'tabs', 'accordion', 'wizard']),
    sections: z.array(z.object({
      title: z.string(),
      fields: z.array(z.string()),
      collapsible: z.boolean().optional(),
      defaultCollapsed: z.boolean().optional()
    })).optional(),
    options: z.record(z.any()).optional()
  }).optional(),
  options: z.object({
    autoCreate: z.boolean().optional(),
    customFields: z.array(z.object({
      name: z.string(),
      component: z.string(),
      props: z.record(z.any()).optional()
    })).optional(),
    validation: z.object({
      required: z.array(z.string()).optional(),
      rules: z.record(z.object({
        type: z.enum(['regex', 'custom', 'length', 'range']),
        value: z.any(),
        message: z.string()
      })).optional()
    }).optional()
  }).optional()
})

/**
 * Group item schema
 */
export const GroupItemSchema = BaseStructureItemSchema.extend({
  type: z.literal('group'),
  items: z.array(z.lazy(() => StructureItemSchema)),
  collapsible: z.boolean().optional(),
  defaultCollapsed: z.boolean().optional(),
  options: z.object({
    layout: z.enum(['vertical', 'horizontal', 'grid']).optional(),
    maxItems: z.number().optional(),
    ordering: z.enum(['manual', 'alphabetical', 'type']).optional()
  }).optional()
})

/**
 * Divider item schema
 */
export const DividerItemSchema = z.object({
  type: z.literal('divider'),
  title: z.string().optional(),
  style: z.enum(['line', 'space', 'label']).optional()
})

/**
 * Custom view item schema
 */
export const CustomViewItemSchema = BaseStructureItemSchema.extend({
  type: z.literal('customView'),
  viewType: z.string(),
  config: z.record(z.any()),
  dataSource: z.object({
    schemaTypes: z.array(z.string()).optional(),
    query: QueryFilterSchema.optional(),
    refresh: z.enum(['manual', 'auto', 'realtime']).optional()
  }).optional()
})

/**
 * Structure item union schema
 */
export const StructureItemSchema: z.ZodSchema = z.union([
  DocumentListItemSchema,
  SingletonItemSchema,
  GroupItemSchema,
  DividerItemSchema,
  CustomViewItemSchema
])

/**
 * Theme config schema
 */
export const ThemeConfigSchema = z.object({
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  background: z.object({
    primary: z.string().optional(),
    secondary: z.string().optional(),
    tertiary: z.string().optional()
  }).optional(),
  text: z.object({
    primary: z.string().optional(),
    secondary: z.string().optional(),
    muted: z.string().optional()
  }).optional(),
  borderRadius: z.object({
    small: z.string().optional(),
    medium: z.string().optional(),
    large: z.string().optional()
  }).optional(),
  typography: z.object({
    fontFamily: z.string().optional(),
    headingFontFamily: z.string().optional(),
    fontSize: z.object({
      small: z.string().optional(),
      medium: z.string().optional(),
      large: z.string().optional()
    }).optional()
  }).optional(),
  spacing: z.object({
    small: z.string().optional(),
    medium: z.string().optional(),
    large: z.string().optional()
  }).optional(),
  shadows: z.object({
    small: z.string().optional(),
    medium: z.string().optional(),
    large: z.string().optional()
  }).optional()
})

/**
 * Plugin config schema
 */
export const PluginConfigSchema = z.object({
  name: z.string(),
  options: z.record(z.any()).optional(),
  enabled: z.boolean().optional()
})

/**
 * Main structure schema
 */
export const TrokkyStructureSchema = z.object({
  title: z.string(),
  items: z.array(StructureItemSchema),
  theme: ThemeConfigSchema.optional(),
  permissions: PermissionConfigSchema.optional(),
  plugins: z.array(PluginConfigSchema).optional(),
  customStyles: z.string().optional(),
  metadata: z.object({
    version: z.string().optional(),
    description: z.string().optional(),
    author: z.string().optional(),
    tags: z.array(z.string()).optional()
  }).optional()
})