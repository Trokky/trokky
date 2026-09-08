/**
 * FontAwesome Free Icon Library Adapter
 * Uses official FontAwesome metadata for complete icon coverage
 */

import React from 'react';
import type { IconLibraryAdapter, IconMeta } from '../definition.js';

// Import FontAwesome metadata
// @ts-ignore - JSON import
import iconFamilies from '@fortawesome/fontawesome-free/metadata/icon-families.json';

// Type for the icon families data
interface IconFamilyData {
  label: string;
  search: {
    terms: string[];
  };
  familyStylesByLicense: {
    free: Array<{
      family: string;
      style: string;
    }>;
  };
  svgs?: {
    classic?: {
      solid?: { path: string };
      regular?: { path: string };
    };
    brands?: {
      solid?: { path: string };
    };
  };
}

// Category mapping for common icons (simplified categorization)
const categoryMapping: Record<string, string> = {
  // Users
  'user': 'users', 'users': 'users', 'user-plus': 'users', 'user-minus': 'users',
  'user-check': 'users', 'user-circle': 'users', 'user-tie': 'users', 'user-shield': 'users',
  'people-group': 'users', 'person': 'users', 'child': 'users', 'baby': 'users',

  // Communication
  'envelope': 'communication', 'phone': 'communication', 'comment': 'communication',
  'comments': 'communication', 'message': 'communication', 'bell': 'communication',
  'paper-plane': 'communication', 'at': 'communication', 'inbox': 'communication',

  // Arrows
  'arrow-right': 'arrows', 'arrow-left': 'arrows', 'arrow-up': 'arrows', 'arrow-down': 'arrows',
  'chevron-right': 'arrows', 'chevron-left': 'arrows', 'chevron-up': 'arrows', 'chevron-down': 'arrows',
  'angles-right': 'arrows', 'angles-left': 'arrows', 'caret-right': 'arrows', 'caret-left': 'arrows',

  // Business
  'building': 'business', 'briefcase': 'business', 'chart-line': 'business', 'chart-bar': 'business',
  'chart-pie': 'business', 'dollar-sign': 'business', 'euro-sign': 'business', 'coins': 'business',
  'wallet': 'business', 'credit-card': 'business', 'piggy-bank': 'business', 'landmark': 'business',
  'handshake': 'business', 'suitcase': 'business', 'receipt': 'business',

  // Media
  'image': 'media', 'images': 'media', 'camera': 'media', 'video': 'media', 'music': 'media',
  'play': 'media', 'pause': 'media', 'stop': 'media', 'film': 'media', 'podcast': 'media',

  // Files
  'file': 'files', 'folder': 'files', 'file-pdf': 'files', 'file-word': 'files',
  'file-excel': 'files', 'file-image': 'files', 'file-code': 'files', 'file-zipper': 'files',

  // Interface
  'gear': 'interface', 'cog': 'interface', 'sliders': 'interface', 'bars': 'interface',
  'ellipsis': 'interface', 'grip': 'interface', 'toggle-on': 'interface', 'toggle-off': 'interface',
  'circle-info': 'interface', 'circle-question': 'interface', 'circle-check': 'interface',
  'circle-xmark': 'interface', 'eye': 'interface', 'eye-slash': 'interface',
  'lock': 'interface', 'unlock': 'interface', 'key': 'interface',

  // Social
  'heart': 'social', 'star': 'social', 'thumbs-up': 'social', 'thumbs-down': 'social',
  'share': 'social', 'bookmark': 'social', 'flag': 'social', 'trophy': 'social',

  // Location
  'location-dot': 'location', 'map': 'location', 'map-pin': 'location', 'compass': 'location',
  'globe': 'location', 'earth-americas': 'location', 'earth-europe': 'location',
  'map-marker': 'location', 'map-marker-alt': 'location',

  // Time
  'clock': 'time', 'calendar': 'time', 'calendar-days': 'time', 'calendar-check': 'time',
  'hourglass': 'time', 'stopwatch': 'time', 'history': 'time',

  // Technology
  'laptop': 'technology', 'desktop': 'technology', 'mobile': 'technology', 'tablet': 'technology',
  'wifi': 'technology', 'signal': 'technology', 'database': 'technology', 'server': 'technology',
  'code': 'technology', 'terminal': 'technology', 'microchip': 'technology', 'robot': 'technology',

  // Weather
  'sun': 'weather', 'moon': 'weather', 'cloud': 'weather', 'cloud-rain': 'weather',
  'cloud-sun': 'weather', 'snowflake': 'weather', 'bolt': 'weather', 'temperature-high': 'weather',

  // Shopping
  'cart-shopping': 'shopping', 'bag-shopping': 'shopping', 'basket-shopping': 'shopping',
  'store': 'shopping', 'shop': 'shopping', 'tags': 'shopping', 'tag': 'shopping',
  'barcode': 'shopping', 'qrcode': 'shopping',

  // Education
  'graduation-cap': 'education', 'book': 'education', 'book-open': 'education',
  'pen': 'education', 'pencil': 'education', 'ruler': 'education', 'school': 'education',
  'chalkboard': 'education', 'apple-whole': 'education',

  // Health
  'heart-pulse': 'health', 'stethoscope': 'health', 'syringe': 'health', 'pills': 'health',
  'hospital': 'health', 'ambulance': 'health', 'kit-medical': 'health', 'virus': 'health',

  // Transportation
  'car': 'transportation', 'bus': 'transportation', 'truck': 'transportation', 'plane': 'transportation',
  'train': 'transportation', 'ship': 'transportation', 'bicycle': 'transportation', 'motorcycle': 'transportation',

  // Food
  'utensils': 'food', 'burger': 'food', 'pizza-slice': 'food', 'ice-cream': 'food',
  'mug-hot': 'food', 'wine-glass': 'food', 'beer-mug-empty': 'food',

  // Sports
  'futbol': 'sports', 'basketball': 'sports', 'baseball': 'sports', 'football': 'sports',
  'golf-ball-tee': 'sports', 'table-tennis-paddle-ball': 'sports', 'dumbbell': 'sports',

  // Animals
  'dog': 'animals', 'cat': 'animals', 'fish': 'animals', 'bird': 'animals',
  'horse': 'animals', 'spider': 'animals', 'bug': 'animals', 'paw': 'animals',

  // Brands (common ones)
  'facebook': 'brands', 'twitter': 'brands', 'instagram': 'brands', 'linkedin': 'brands',
  'youtube': 'brands', 'github': 'brands', 'google': 'brands', 'apple': 'brands',
  'amazon': 'brands', 'microsoft': 'brands', 'whatsapp': 'brands', 'tiktok': 'brands',
};

// Build icons from metadata
function buildIconsFromMetadata(): { solid: IconMeta[], regular: IconMeta[], brands: IconMeta[] } {
  const solid: IconMeta[] = [];
  const regular: IconMeta[] = [];
  const brands: IconMeta[] = [];

  const families = iconFamilies as Record<string, IconFamilyData>;

  for (const [iconName, iconData] of Object.entries(families)) {
    const freeStyles = iconData.familyStylesByLicense?.free || [];

    for (const styleInfo of freeStyles) {
      const { family, style } = styleInfo;

      const iconMeta: IconMeta = {
        name: `fa-${iconName}`,
        label: iconData.label || iconName,
        category: categoryMapping[iconName] || 'other',
        tags: iconData.search?.terms || [],
        style: style,
      };

      if (family === 'classic' && style === 'solid') {
        solid.push(iconMeta);
      } else if (family === 'classic' && style === 'regular') {
        regular.push(iconMeta);
      } else if (family === 'classic' && style === 'brands') {
        brands.push({ ...iconMeta, category: 'brands' });
      }
    }
  }

  // Sort alphabetically by label
  solid.sort((a, b) => (a.label || '').localeCompare(b.label || ''));
  regular.sort((a, b) => (a.label || '').localeCompare(b.label || ''));
  brands.sort((a, b) => (a.label || '').localeCompare(b.label || ''));

  return { solid, regular, brands };
}

// Build the icon lists
const { solid: solidIcons, regular: regularIcons, brands: brandIcons } = buildIconsFromMetadata();

// Get all unique categories
function getCategories(): string[] {
  const allIcons = [...solidIcons, ...regularIcons, ...brandIcons];
  const categories = new Set(allIcons.map(icon => icon.category || 'other'));
  return Array.from(categories).sort();
}

// Get icons by style
function getIconsByStyle(style: string): IconMeta[] {
  switch (style) {
    case 'solid':
      return solidIcons;
    case 'regular':
      return regularIcons;
    case 'brands':
      return brandIcons;
    default:
      return solidIcons;
  }
}

// Search icons
function searchIcons(query: string, options?: { style?: string; category?: string }): IconMeta[] {
  const style = options?.style || 'solid';
  const icons = getIconsByStyle(style);
  const searchTerm = query.toLowerCase().trim();

  if (!searchTerm) {
    if (options?.category) {
      return icons.filter(icon => icon.category === options.category);
    }
    return icons;
  }

  return icons.filter(icon => {
    // Filter by category first if specified
    if (options?.category && icon.category !== options.category) {
      return false;
    }

    // Search in name, label, and tags
    const nameMatch = icon.name.toLowerCase().includes(searchTerm);
    const labelMatch = (icon.label || '').toLowerCase().includes(searchTerm);
    const tagMatch = icon.tags?.some(tag => tag.toLowerCase().includes(searchTerm));

    return nameMatch || labelMatch || tagMatch;
  });
}

// Render icon
function renderIcon(icon: IconMeta, size: number = 24): React.ReactNode {
  const stylePrefix = icon.style === 'brands' ? 'fab' :
                      icon.style === 'regular' ? 'far' : 'fas';

  return (
    <i
      className={`${stylePrefix} ${icon.name}`}
      style={{ fontSize: size }}
    />
  );
}

export const fontawesomeAdapter: IconLibraryAdapter = {
  name: 'fontawesome',
  displayName: 'Font Awesome',
  version: '6.7.2',

  getIcons: (options) => {
    const style = options?.style || 'solid';
    let icons = getIconsByStyle(style);

    if (options?.category) {
      icons = icons.filter(icon => icon.category === options.category);
    }

    return icons;
  },

  getCategories,

  getStyles: () => ['solid', 'regular', 'brands'],

  renderIcon,

  searchIcons,
};

export default fontawesomeAdapter;
