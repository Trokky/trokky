/**
 * Widget Renderer for Context Sidebar
 * Renders predefined widgets based on configuration
 */

import React from 'react'
import { useT } from '@trokky/trokky/i18n'
import type { ContextSidebarRenderContext } from '@/types/structure'
import { RecentDocumentsWidget, type RecentDocumentsWidgetConfig } from './widgets/RecentDocumentsWidget'

// Union type of all widget configs
export type WidgetConfig = RecentDocumentsWidgetConfig

// Widget content definition (serializable)
export interface WidgetContent {
  type: 'widgets'
  widgets: WidgetConfig[]
}

/**
 * Render a single widget based on its configuration
 */
export function renderWidget(config: WidgetConfig, context: ContextSidebarRenderContext, t: (key: string, options?: any) => string): React.ReactNode {
  switch (config.type) {
    case 'recentDocuments':
      return <RecentDocumentsWidget key="recentDocuments" config={config} context={context} />

    default:
      return (
        <div key="unknown" className="border rounded-lg p-4 bg-red-50 dark:bg-red-900/20">
          <div className="text-sm text-red-600 dark:text-red-400">{t('contextSidebar.widgets.unknownType', { type: (config as any).type })}</div>
        </div>
      )
  }
}

/**
 * Render multiple widgets
 */
export function WidgetRenderer({
  content,
  context
}: {
  content: WidgetContent
  context: ContextSidebarRenderContext
}) {
  const { t } = useT('studio')

  return (
    <div className="space-y-4">
      {content.widgets.map(widget =>
        renderWidget({ ...widget }, context, t)
      )}
    </div>
  )
}
