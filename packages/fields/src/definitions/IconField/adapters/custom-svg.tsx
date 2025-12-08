/**
 * Custom SVG Icon Library Adapter
 * Allows users to input custom SVG path data
 */

import React from 'react';
import type { IconLibraryAdapter, IconMeta } from '../definition.js';

// Some example custom icons to demonstrate the feature
const exampleCustomIcons: IconMeta[] = [
  {
    name: 'gavel',
    label: 'Gavel',
    category: 'legal',
    tags: ['law', 'judge', 'court', 'audit'],
    style: 'stroke',
  },
  {
    name: 'audit-report',
    label: 'Audit Report',
    category: 'legal',
    tags: ['document', 'check', 'verify'],
    style: 'stroke',
  },
  {
    name: 'finance-growth',
    label: 'Finance Growth',
    category: 'business',
    tags: ['chart', 'growth', 'money'],
    style: 'stroke',
  },
];

// SVG paths for example icons
const customIconPaths: Record<string, { path: string; style: 'stroke' | 'fill'; viewBox?: string }> = {
  'gavel': {
    path: 'M12 3l1.5 1.5L9 9l1.5 1.5 4.5-4.5L16.5 7.5l-6 6L9 12l-1.5 1.5L6 12l6-9zm-6 15h12v2H6v-2z',
    style: 'stroke',
  },
  'audit-report': {
    path: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0zM9 5h6M9 8h6',
    style: 'stroke',
  },
  'finance-growth': {
    path: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
    style: 'stroke',
  },
};

// Render SVG from path data
function renderSvgPath(pathData: string, size: number = 16, style: 'stroke' | 'fill' = 'stroke', viewBox: string = '0 0 24 24'): React.ReactNode {
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
    let icons = [...exampleCustomIcons];

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
    exampleCustomIcons.forEach(icon => {
      if (icon.category) {
        categories.add(icon.category);
      }
    });
    return Array.from(categories).sort();
  },

  getStyles(): string[] {
    return ['stroke', 'fill'];
  },

  renderIcon(icon: IconMeta, size: number = 16): React.ReactNode {
    const iconData = customIconPaths[icon.name];
    if (iconData) {
      return renderSvgPath(iconData.path, size, iconData.style, iconData.viewBox);
    }
    // Fallback: render a question mark icon
    return renderSvgPath('M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z', size);
  },

  searchIcons(query: string, options?: { style?: string; category?: string }): IconMeta[] {
    const normalizedQuery = query.toLowerCase().trim();
    let icons = this.getIcons(options);

    return icons.filter(icon => {
      const nameMatch = icon.name.toLowerCase().includes(normalizedQuery);
      const labelMatch = icon.label?.toLowerCase().includes(normalizedQuery);
      const tagMatch = icon.tags?.some(tag => tag.toLowerCase().includes(normalizedQuery));
      return nameMatch || labelMatch || tagMatch;
    });
  },
};

// Helper function to register additional custom icons
export function registerCustomIcon(
  name: string,
  path: string,
  options: {
    label?: string;
    category?: string;
    tags?: string[];
    style?: 'stroke' | 'fill';
    viewBox?: string;
  } = {}
): void {
  const { label, category = 'custom', tags = [], style = 'stroke', viewBox } = options;

  // Add to icons list
  exampleCustomIcons.push({
    name,
    label: label || name,
    category,
    tags,
    style,
  });

  // Add path data
  customIconPaths[name] = { path, style, viewBox };
}

// Export render function for use in other components
export { renderSvgPath };
