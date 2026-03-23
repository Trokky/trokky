/**
 * Type Exports
 * All structure system types
 */

// Structure types
export type {
  TrokkyStructure,
  StructureItem,
  BaseStructureItem,
  DocumentListItem,
  SingletonItem,
  GroupItem,
  DividerItem,
  CustomViewItem,
  BadgeConfig,
  BulkActionConfig,
  FilterConfig,
  ThemeConfig,
  PluginConfig,
  FormLayoutConfig,
  FormSectionConfig,
  CustomFieldConfig,
  ValidationConfig,
  ValidationRule
} from './structure.js'

// Filter types
export type {
  QueryFilter,
  OrderClause,
  QueryContext,
  ResolvedQuery,
  QueryBuilderOptions,
  QueryComplexity
} from './filters.js'

export { QueryOperators } from './filters.js'

// View types
export type {
  ViewConfig,
  ListViewConfig,
  GridViewConfig,
  CalendarViewConfig,
  KanbanViewConfig,
  MapViewConfig,
  ColumnConfig,
  ActionConfig,
  KanbanColumnConfig,
  ViewPlugin,
  BulkActionPlugin
} from './views.js'

// Permission types
export type {
  PermissionConfig,
  PermissionRule,
  PermissionCondition,
  PermissionFunction,
  PermissionContext,
  PermissionResult,
  PermissionSummary,
  PermissionValidatorConfig,
  PermissionInheritance
} from './permissions.js'

export { PermissionPatterns } from './permissions.js'