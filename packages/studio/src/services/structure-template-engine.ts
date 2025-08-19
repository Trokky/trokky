/**
 * Structure Template Engine
 * Converts callback functions to serializable templates
 */

import React from 'react'
import type { ContextSidebarRenderContext } from '@/types/structure'

interface TemplateContext extends ContextSidebarRenderContext {
  React: typeof React
}

/**
 * Template-based content definition (serializable)
 */
export interface TemplateContent {
  type: 'template'
  template: string  // JavaScript code as string
}

/**
 * Execute a template string with the provided context
 */
export function executeTemplate(template: string, context: TemplateContext): React.ReactNode {
  try {
    // Create a function from the template string
    const templateFunction = new Function(
      'ctx', 
      'React',
      `
        const { context, document, collection, user, permissions, studio, data, ui, api, utils } = ctx;
        return (${template});
      `
    )
    
    // Execute the template with context
    return templateFunction(context, React)
  } catch (error) {
    console.error('Template execution error:', error)
    return React.createElement('div', {
      className: 'p-4 text-red-600 text-sm'
    }, `Template Error: ${error.message}`)
  }
}

/**
 * Convert callback-based structure to template-based structure
 */
export function convertCallbacksToTemplates(structure: any): any {
  if (!structure) return structure
  
  const convertItem = (item: any): any => {
    if (!item) return item
    
    const converted = { ...item }
    
    // Convert contextSidebar callback to template
    if (item.contextSidebar?.content?.type === 'callback') {
      const callback = item.contextSidebar.content.render
      if (typeof callback === 'function') {
        // Convert function to string template
        const functionString = callback.toString()
        // Extract the function body (everything between the first { and last })
        const match = functionString.match(/^[^{]*\{([\s\S]*)\}[^}]*$/)
        if (match) {
          converted.contextSidebar = {
            ...item.contextSidebar,
            content: {
              type: 'template',
              template: match[1].trim()
            }
          }
        }
      }
    }
    
    // Recursively convert nested items
    if (item.items) {
      converted.items = item.items.map(convertItem)
    }
    
    return converted
  }
  
  return {
    ...structure,
    items: structure.items?.map(convertItem) || []
  }
}
