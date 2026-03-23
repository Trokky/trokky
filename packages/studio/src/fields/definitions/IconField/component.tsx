/**
 * Icon Field Component
 * Visual icon picker with grid view, search, and filtering
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useT } from 'trokky/i18n';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { IconFieldDefinition, IconValue, IconMeta, IconLibraryAdapter, CustomIconDefinition } from './definition.js';
import { fontawesomeAdapter } from './adapters/fontawesome.js';
import { heroiconsAdapter } from './adapters/heroicons.js';
import { customSvgAdapter, setCustomIcons, getCustomIcons } from './adapters/custom-svg.js';

// Icon library registry
const iconLibraries: Record<string, IconLibraryAdapter> = {
  fontawesome: fontawesomeAdapter,
  heroicons: heroiconsAdapter,
  custom: customSvgAdapter,
};

// Register additional libraries
export function registerIconLibrary(adapter: IconLibraryAdapter) {
  iconLibraries[adapter.name] = adapter;
}

// Load FontAwesome CSS dynamically
function useFontAwesome() {
  useEffect(() => {
    const FA_CDN_URL = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
    const existingLink = document.querySelector(`link[href="${FA_CDN_URL}"]`);

    if (!existingLink) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = FA_CDN_URL;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    }
  }, []);
}

// Simple icons
const SearchIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const XMarkIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

// Icon picker modal
interface IconPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (icon: IconMeta, library: string) => void;
  availableLibraries: string[];
  currentValue?: IconValue;
  options: IconFieldDefinition['options'];
  t: (key: string, options?: Record<string, any>) => string;
  customIcons?: Record<string, CustomIconDefinition>;
}

function IconPickerModal({ isOpen, onClose, onSelect, availableLibraries, currentValue, options, t, customIcons }: IconPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLibrary, setSelectedLibrary] = useState<string>(
    currentValue?.library || availableLibraries[0] || 'fontawesome'
  );
  const [selectedStyle, setSelectedStyle] = useState<string>(() => {
    // Get default style based on library
    if (selectedLibrary === 'heroicons') {
      return options?.heroiconsStyle || 'outline';
    }
    return options?.style || 'solid';
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [page, setPage] = useState(0);

  // Custom SVG input state (for ad-hoc paste)
  const [customSvgPath, setCustomSvgPath] = useState<string>(
    currentValue?.library === 'custom' && currentValue?.svg ? currentValue.svg : ''
  );
  const [customSvgStyle, setCustomSvgStyle] = useState<'stroke' | 'fill'>('stroke');
  const [customSvgName, setCustomSvgName] = useState<string>(
    currentValue?.library === 'custom' ? currentValue?.name || 'custom-icon' : 'custom-icon'
  );
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Load custom icons into adapter when modal opens
  useEffect(() => {
    if (isOpen && customIcons) {
      setCustomIcons(customIcons);
    }
  }, [isOpen, customIcons]);

  // Check if there are user-provided custom icons
  const hasCustomIconLibrary = customIcons && Object.keys(customIcons).length > 0;

  const pageSize = options?.pageSize || 50;

  // Get current adapter
  const adapter = iconLibraries[selectedLibrary];

  // Get available styles and categories for current library
  const styles = adapter?.getStyles?.() || [];
  const categories = adapter?.getCategories() || [];

  // Update style when library changes
  useEffect(() => {
    if (selectedLibrary === 'heroicons') {
      setSelectedStyle(options?.heroiconsStyle || 'outline');
    } else if (selectedLibrary === 'fontawesome') {
      setSelectedStyle(options?.style || 'solid');
    } else if (styles.length > 0) {
      setSelectedStyle(styles[0]);
    }
    setSelectedCategory('');
    setPage(0);
  }, [selectedLibrary]);

  // Filter icons
  const filteredIcons = useMemo(() => {
    if (!adapter) return [];

    const filterOptions = {
      style: selectedStyle,
      category: selectedCategory || undefined,
    };

    if (searchQuery) {
      return adapter.searchIcons(searchQuery, filterOptions);
    }

    return adapter.getIcons(filterOptions);
  }, [adapter, searchQuery, selectedStyle, selectedCategory]);

  // Paginate
  const paginatedIcons = useMemo(() => {
    const start = page * pageSize;
    return filteredIcons.slice(start, start + pageSize);
  }, [filteredIcons, page, pageSize]);

  const totalPages = Math.ceil(filteredIcons.length / pageSize);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [searchQuery, selectedStyle, selectedCategory]);

  if (!isOpen) return null;
  if (!adapter) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4"
      style={{ margin: 0, boxSizing: 'border-box' }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal - full screen on mobile, constrained on larger screens */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-lg sm:max-w-2xl flex flex-col h-full sm:h-auto" style={{ maxHeight: '100vh', ['--sm-max-height' as string]: '600px' }}>
        <style>{`@media (min-width: 640px) { [style*="--sm-max-height"] { max-height: var(--sm-max-height) !important; } }`}</style>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('types.icon.selectIcon')}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Library selector - only show if multiple libraries available */}
        {availableLibraries.length > 1 && (
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            {availableLibraries.map((lib) => {
              const libAdapter = iconLibraries[lib];
              return (
                <button
                  key={lib}
                  onClick={() => setSelectedLibrary(lib)}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    selectedLibrary === lib
                      ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  {libAdapter?.displayName || lib}
                  {libAdapter?.version && (
                    <span className="ml-1 text-[10px] opacity-60">v{libAdapter.version}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Filters */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
          {/* Search */}
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('types.icon.searchIcons')}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Style and Category filters */}
          <div className="flex flex-wrap gap-3">
            {/* Style selector */}
            {styles.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('types.icon.style')}</span>
                <div className="flex gap-1">
                  {styles.map((style) => (
                    <button
                      key={style}
                      onClick={() => setSelectedStyle(style)}
                      className={`px-2 py-1 text-xs rounded ${
                        selectedStyle === style
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Category selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('types.icon.category')}</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <option value="">{t('types.icon.allCategories')}</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            {/* Results count */}
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
              {t('types.icon.iconCount', { count: filteredIcons.length })}
            </span>
          </div>
        </div>

        {/* Icons grid or Custom SVG input */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 bg-gray-50 dark:bg-gray-900/50">
          {selectedLibrary === 'custom' ? (
            // Custom SVG mode - show grid if icons available, or paste input
            <div className="h-full flex flex-col">
              {/* Toggle between grid and paste input */}
              {hasCustomIconLibrary && (
                <div className="flex items-center justify-between px-2 py-2 border-b border-gray-200 dark:border-gray-700 mb-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {showCustomInput ? 'Paste custom SVG path' : `${filteredIcons.length} custom icons`}
                  </span>
                  <button
                    onClick={() => setShowCustomInput(!showCustomInput)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    {showCustomInput ? 'Show icon library' : 'Paste new SVG'}
                  </button>
                </div>
              )}

              {/* Show paste input if no custom icons OR if toggled to paste mode */}
              {(!hasCustomIconLibrary || showCustomInput) ? (
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      SVG Path Data
                    </label>
                    <textarea
                      value={customSvgPath}
                      onChange={(e) => setCustomSvgPath(e.target.value)}
                      placeholder="M12 2L2 7l10 5 10-5-10-5z..."
                      className="w-full h-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Paste the &quot;d&quot; attribute from an SVG path element (viewBox: 0 0 24 24)
                    </p>
                  </div>

                  <div className="flex gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Style
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setCustomSvgStyle('stroke')}
                          className={`px-3 py-1.5 text-sm rounded ${
                            customSvgStyle === 'stroke'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          Stroke (outline)
                        </button>
                        <button
                          onClick={() => setCustomSvgStyle('fill')}
                          className={`px-3 py-1.5 text-sm rounded ${
                            customSvgStyle === 'fill'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          Fill (solid)
                        </button>
                      </div>
                    </div>

                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Name (optional)
                      </label>
                      <input
                        type="text"
                        value={customSvgName}
                        onChange={(e) => setCustomSvgName(e.target.value)}
                        placeholder="my-custom-icon"
                        className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Preview */}
                  {customSvgPath && (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Preview
                      </label>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-12 h-12 rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                          {customSvgStyle === 'fill' ? (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              width={24}
                              height={24}
                              className="text-gray-700 dark:text-gray-300"
                            >
                              <path d={customSvgPath} />
                            </svg>
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1.5}
                              stroke="currentColor"
                              width={24}
                              height={24}
                              className="text-gray-700 dark:text-gray-300"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d={customSvgPath} />
                            </svg>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {customSvgName || 'custom-icon'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Use button */}
                  <button
                    onClick={() => {
                      if (customSvgPath) {
                        const iconMeta: IconMeta & { svg?: string } = {
                          name: customSvgName || 'custom-icon',
                          style: customSvgStyle,
                        };
                        iconMeta.svg = customSvgPath;
                        onSelect(iconMeta, 'custom');
                        onClose();
                      }
                    }}
                    disabled={!customSvgPath}
                    className="w-full py-2 px-4 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Use Custom Icon
                  </button>
                </div>
              ) : (
                // Show custom icons grid
                <div className="flex-1">
                  {paginatedIcons.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <p className="text-sm">No custom icons found</p>
                      <p className="text-xs mt-1">Try a different search term or paste a new SVG</p>
                    </div>
                  ) : (
                    <div className="grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
                      {paginatedIcons.map((icon: any) => {
                        const isSelected = currentValue?.name === icon.name;
                        return (
                          <button
                            key={icon.name}
                            onClick={() => {
                              // For custom icons from library, include the path
                              const iconWithPath: IconMeta & { svg?: string } = {
                                name: icon.name,
                                style: icon.style,
                                label: icon.label,
                              };
                              if (icon.path) {
                                iconWithPath.svg = icon.path;
                              }
                              onSelect(iconWithPath, 'custom');
                              onClose();
                            }}
                            title={icon.label || icon.name}
                            className={`flex flex-col items-center justify-center p-2 rounded border transition-all ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            <div className="text-gray-700 dark:text-gray-300" style={{ fontSize: '18px' }}>
                              {adapter.renderIcon(icon, 18)}
                            </div>
                            <span className="text-gray-400 dark:text-gray-500 truncate w-full text-center" style={{ fontSize: '7px', lineHeight: '1.2', marginTop: '2px' }}>
                              {icon.label || icon.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : paginatedIcons.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p className="text-sm">{t('types.icon.noIconsFound')}</p>
              <p className="text-xs mt-1">{t('types.icon.tryDifferentSearch')}</p>
            </div>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
              {paginatedIcons.map((icon) => {
                const isSelected = currentValue?.name === icon.name && currentValue?.style === icon.style;
                return (
                  <button
                    key={`${icon.style}-${icon.name}`}
                    onClick={() => {
                      onSelect(icon, selectedLibrary);
                      onClose();
                    }}
                    title={icon.label || icon.name}
                    className={`flex flex-col items-center justify-center p-2 rounded border transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="text-gray-700 dark:text-gray-300" style={{ fontSize: '18px' }}>
                      {adapter.renderIcon(icon, 18)}
                    </div>
                    <span className="text-gray-400 dark:text-gray-500 truncate w-full text-center" style={{ fontSize: '7px', lineHeight: '1.2', marginTop: '2px' }}>
                      {icon.name.replace('fa-', '')}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {t('types.icon.previous')}
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t('types.icon.pageOf', { page: page + 1, total: totalPages })}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {t('types.icon.next')}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// Main component
export function IconFieldComponent(props: FieldComponentProps) {
  const { definition, value, onChange, hasError, isDisabled, isReadonly } = props;
  const { t } = useT('fields');
  const iconDefinition = definition as IconFieldDefinition;
  const options = iconDefinition.options || {};

  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load FontAwesome CSS
  useFontAwesome();

  // Determine available libraries
  const availableLibraries = useMemo(() => {
    // If specific libraries are defined, use those
    if (options.libraries && options.libraries.length > 0) {
      return options.libraries.filter(lib => iconLibraries[lib]);
    }
    // If single library is defined, use only that
    if (options.library) {
      return [options.library].filter(lib => iconLibraries[lib]);
    }
    // Default: all registered libraries
    return Object.keys(iconLibraries);
  }, [options.library, options.libraries]);

  // Get the default library adapter (for preview)
  const defaultLibraryName = availableLibraries[0] || 'fontawesome';
  const defaultAdapter = iconLibraries[defaultLibraryName];

  // Parse value - handle legacy string values like "fas fa-user" or "fab fa-github"
  const iconValue: IconValue | null = useMemo(() => {
    if (!value) return null;

    // Already an object
    if (typeof value === 'object') return value as IconValue;

    // Try to parse as JSON first
    if (typeof value === 'string') {
      // Check if it's a legacy FontAwesome class string (e.g., "fas fa-user", "fab fa-github")
      const faMatch = value.match(/^(fas|far|fab|fal|fad)\s+(fa-[\w-]+)$/);
      if (faMatch) {
        const styleMap: Record<string, string> = {
          'fas': 'solid',
          'far': 'regular',
          'fab': 'brands',
          'fal': 'light',
          'fad': 'duotone'
        };
        return {
          library: 'fontawesome' as const,
          name: faMatch[2],
          style: styleMap[faMatch[1]] || 'solid'
        };
      }

      // Try JSON parse
      try {
        return JSON.parse(value);
      } catch {
        // If all else fails, return null
        return null;
      }
    }

    return null;
  }, [value]);

  // Handle icon selection
  const handleSelect = useCallback((icon: IconMeta & { svg?: string }, library: string) => {
    const newValue: IconValue = {
      library: library as any,
      name: icon.name,
      style: icon.style,
    };
    // For custom SVG, store the path data
    if (library === 'custom' && icon.svg) {
      newValue.svg = icon.svg;
    }
    onChange(newValue);
  }, [onChange]);

  // Handle clear
  const handleClear = useCallback(() => {
    onChange(null);
  }, [onChange]);

  // Get the adapter for the current value (for rendering preview)
  const valueAdapter = iconValue?.library ? iconLibraries[iconValue.library] : defaultAdapter;

  if (!defaultAdapter) {
    return (
      <div className="p-3 border border-red-200 dark:border-red-700 rounded bg-red-50 dark:bg-red-900/20">
        <span className="text-red-700 dark:text-red-400 text-sm">
          {t('types.icon.noLibrariesAvailable')}
        </span>
      </div>
    );
  }

  // Read-only mode
  if (isReadonly && !isDisabled) {
    if (!iconValue) {
      return (
        <div className="text-gray-400 dark:text-gray-500 italic text-sm py-2">
          {t('types.icon.noIconSelected')}
        </div>
      );
    }

    const iconMeta: IconMeta = {
      name: iconValue.name,
      style: iconValue.style,
    };

    return (
      <div className="flex items-center gap-2 py-2">
        <span className="text-xl text-gray-700 dark:text-gray-300">
          {valueAdapter?.renderIcon(iconMeta, 20)}
        </span>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {iconValue.name}
        </span>
      </div>
    );
  }

  return (
    <>
      <div
        className={`flex items-center gap-3 p-3 border rounded-md transition-colors ${
          hasError
            ? 'border-red-300 dark:border-red-600'
            : 'border-gray-300 dark:border-gray-600'
        } ${
          isDisabled
            ? 'bg-gray-100 dark:bg-gray-800 opacity-50 cursor-not-allowed'
            : 'bg-white dark:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
        }`}
      >
        {/* Icon preview */}
        <button
          type="button"
          onClick={() => !isDisabled && setIsModalOpen(true)}
          disabled={isDisabled}
          className={`flex items-center justify-center w-10 h-10 rounded border border-gray-200 dark:border-gray-600 ${
            isDisabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600'
          }`}
        >
          {iconValue ? (
            <span className="text-xl text-gray-700 dark:text-gray-300">
              {iconValue.library === 'custom' && iconValue.svg ? (
                // Render custom SVG directly from stored path
                iconValue.style === 'fill' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width={20} height={20}>
                    <path d={iconValue.svg} />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={20} height={20}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={iconValue.svg} />
                  </svg>
                )
              ) : valueAdapter ? (
                valueAdapter.renderIcon({ name: iconValue.name, style: iconValue.style }, 20)
              ) : null}
            </span>
          ) : (
            <span className="text-gray-400 dark:text-gray-500 text-sm">?</span>
          )}
        </button>

        {/* Icon info and select button */}
        <div className="flex-1 min-w-0">
          {iconValue ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-900 dark:text-white truncate">
                {iconValue.name}
              </span>
              {iconValue.style && (
                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-600 px-1.5 py-0.5 rounded">
                  {iconValue.style}
                </span>
              )}
            </div>
          ) : (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {t('types.icon.noIconSelected')}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            disabled={isDisabled}
            className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {iconValue ? t('types.icon.change') : t('types.icon.select')}
          </button>

          {iconValue && !isDisabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
              title={t('types.icon.clearIcon')}
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Icon picker modal */}
      <IconPickerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={handleSelect}
        availableLibraries={availableLibraries}
        currentValue={iconValue || undefined}
        options={options}
        t={t}
        customIcons={options?.customIcons}
      />
    </>
  );
}
