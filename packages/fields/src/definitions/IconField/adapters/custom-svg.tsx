/**
 * Custom SVG Icon Library Adapter
 * Allows users to use their own custom SVG icons
 */

import React from 'react';
import type { IconLibraryAdapter, IconMeta, CustomIconDefinition } from '../definition.js';

// Store for user-provided custom icons (set via setCustomIcons)
let customIconsStore: Record<string, CustomIconDefinition> = {};

/**
 * Set the custom icons for this adapter
 * Called by IconFieldComponent when customIcons option is provided
 */
export function setCustomIcons(icons: Record<string, CustomIconDefinition>): void {
  customIconsStore = icons;
}

/**
 * Get the current custom icons
 */
export function getCustomIcons(): Record<string, CustomIconDefinition> {
  return customIconsStore;
}

/**
 * Clear custom icons
 */
export function clearCustomIcons(): void {
  customIconsStore = {};
}

// Convert custom icon definitions to IconMeta array
function getIconMetaList(): (IconMeta & { path: string; viewBox?: string })[] {
  return Object.entries(customIconsStore).map(([name, def]) => ({
    name,
    label: def.label || name,
    category: def.category || 'custom',
    tags: def.tags || [],
    style: def.style || 'stroke',
    path: def.path,
    viewBox: def.viewBox,
  }));
}

// Render SVG from path data
export function renderSvgPath(
  pathData: string,
  size: number = 16,
  style: 'stroke' | 'fill' = 'stroke',
  viewBox: string = '0 0 24 24'
): React.ReactNode {
  if (style === 'fill') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={viewBox}
        fill="currentColor"
        width={size}
        height={size}
      >
        <path d={pathData} />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox={viewBox}
      strokeWidth={1.5}
      stroke="currentColor"
      width={size}
      height={size}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={pathData} />
    </svg>
  );
}

export const customSvgAdapter: IconLibraryAdapter = {
  name: 'custom',
  displayName: 'Custom SVG',
  version: '1.0',

  getIcons(options?: { style?: string; category?: string }): IconMeta[] {
    let icons = getIconMetaList();

    if (options?.category) {
      icons = icons.filter(icon => icon.category === options.category);
    }

    if (options?.style) {
      icons = icons.filter(icon => icon.style === options.style);
    }

    return icons;
  },

  getCategories(): string[] {
    const categories = new Set<string>();
    getIconMetaList().forEach(icon => {
      if (icon.category) {
        categories.add(icon.category);
      }
    });
    return Array.from(categories).sort();
  },

  getStyles(): string[] {
    return ['stroke', 'fill'];
  },

  renderIcon(icon: IconMeta & { path?: string; viewBox?: string }, size: number = 16): React.ReactNode {
    // If icon has path directly (from customIcons), use it
    if (icon.path) {
      return renderSvgPath(icon.path, size, icon.style as 'stroke' | 'fill', icon.viewBox);
    }

    // Otherwise, look up in store
    const iconDef = customIconsStore[icon.name];
    if (iconDef) {
      return renderSvgPath(iconDef.path, size, iconDef.style || 'stroke', iconDef.viewBox);
    }

    // Fallback: render a question mark
    return renderSvgPath(
      'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z',
      size
    );
  },

  searchIcons(query: string, options?: { style?: string; category?: string }): IconMeta[] {
    const normalizedQuery = query.toLowerCase().trim();
    let icons = this.getIcons(options) as (IconMeta & { path: string })[];

    return icons.filter(icon => {
      const nameMatch = icon.name.toLowerCase().includes(normalizedQuery);
      const labelMatch = icon.label?.toLowerCase().includes(normalizedQuery);
      const tagMatch = icon.tags?.some(tag => tag.toLowerCase().includes(normalizedQuery));
      return nameMatch || labelMatch || tagMatch;
    });
  },
};
