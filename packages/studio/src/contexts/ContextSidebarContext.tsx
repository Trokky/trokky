import { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { storageService, STORAGE_KEYS } from '@/utils/storage';

interface ContextSidebarPageConfig {
  page: string;
  title?: string;
  defaultVisible?: boolean;
  defaultCollapsed?: boolean;
  defaultWidth?: number;
  defaultPosition?: 'left' | 'right';
}

interface ContextSidebarState {
  currentPage: string;
  title: string;
  isVisible: boolean;
  isCollapsed: boolean;
  width: number;
  position: 'left' | 'right';
  content: ReactNode | null;
}

interface ContextSidebarAPI {
  // Page configuration (declarative)
  configure: (config: ContextSidebarPageConfig) => void;
  
  // Collapse control (user-controllable)
  collapse: () => void;
  expand: () => void;
  toggleCollapse: () => void;
  
  // Width control (user-controllable)
  setWidth: (width: number) => void;
  
  // Position control (user-controllable)
  setPosition: (position: 'left' | 'right') => void;
  
  // Content control (programmatic)
  setContent: (content: ReactNode) => void;
  clearContent: () => void;
  
  // Title control (programmatic)
  setTitle: (title: string) => void;
  
  // State accessors (read-only)
  currentPage: string;
  title: string;
  isVisible: boolean;  // Read-only - controlled by page configuration
  isCollapsed: boolean;
  width: number;
  position: 'left' | 'right';
  content: ReactNode | null;
}

const ContextSidebarContext = createContext<ContextSidebarAPI | null>(null);

interface ContextSidebarProviderProps {
  children: ReactNode;
}

export function ContextSidebarProvider({
  children
}: ContextSidebarProviderProps) {
  // Initialize with default state - will be configured by pages
  const [state, setState] = useState<ContextSidebarState>(() => {
    return {
      currentPage: 'default',
      title: 'Context',
      isVisible: true,
      isCollapsed: false,
      width: 256,
      position: 'left',
      content: null
    };
  });

  // Helper function to save to page-specific storage
  const saveToPageStorage = useCallback((page: string, setting: string, value: any) => {
    const key = setting === 'visible' ? STORAGE_KEYS.CONTEXT_SIDEBAR_VISIBLE(page) :
                setting === 'collapsed' ? STORAGE_KEYS.CONTEXT_SIDEBAR_COLLAPSED(page) :
                setting === 'width' ? STORAGE_KEYS.CONTEXT_SIDEBAR_WIDTH(page) :
                setting === 'position' ? STORAGE_KEYS.CONTEXT_SIDEBAR_POSITION(page) : '';
    
    if (key) {
      storageService.set(key, value);
    }
  }, []);

  // Configure sidebar for a specific page
  const configure = useCallback((config: ContextSidebarPageConfig) => {
    const page = config.page;
    
    setState(prev => {
      // Prevent unnecessary re-configuration if already configured for this page with same settings
      if (prev.currentPage === page && 
          prev.title === (config.title ?? 'Context') &&
          prev.isVisible === (config.defaultVisible ?? true)) {
        return prev; // No change needed
      }
      
      // Load existing user preferences for this page (only for user-controllable settings)
      const savedCollapsed = storageService.get(STORAGE_KEYS.CONTEXT_SIDEBAR_COLLAPSED(page));
      const savedWidth = storageService.get(STORAGE_KEYS.CONTEXT_SIDEBAR_WIDTH(page));
      const savedPosition = storageService.get(STORAGE_KEYS.CONTEXT_SIDEBAR_POSITION(page));
      
      // Visibility is controlled by page configuration only (not user preference)
      const isVisible = config.defaultVisible ?? true;
      
      // Other settings use saved preferences with fallbacks
      const isCollapsed = savedCollapsed !== null ? savedCollapsed : (config.defaultCollapsed ?? false);
      const width = savedWidth !== null ? savedWidth : (config.defaultWidth ?? 256);
      const position = savedPosition !== null ? savedPosition : (config.defaultPosition ?? 'left');
      
      const isPageChange = prev.currentPage !== page;
      
      return {
        ...prev,
        currentPage: page,
        title: config.title ?? 'Context',
        isVisible,
        isCollapsed,
        width,
        position,
        // Auto-clear content when switching to a different page
        content: isPageChange ? null : prev.content
      };
    });
  }, []);

  // Remove show/hide/toggle methods - visibility is controlled by page configuration only
  // Users can only control collapse/expand
  
  const collapse = useCallback(() => {
    setState(prev => {
      saveToPageStorage(prev.currentPage, 'collapsed', true);
      return { ...prev, isCollapsed: true };
    });
  }, [saveToPageStorage]);
  
  const expand = useCallback(() => {
    setState(prev => {
      saveToPageStorage(prev.currentPage, 'collapsed', false);
      return { ...prev, isCollapsed: false };
    });
  }, [saveToPageStorage]);
  
  const toggleCollapse = useCallback(() => {
    setState(prev => {
      const newCollapsed = !prev.isCollapsed;
      saveToPageStorage(prev.currentPage, 'collapsed', newCollapsed);
      return { ...prev, isCollapsed: newCollapsed };
    });
  }, [saveToPageStorage]);
  
  const setWidth = useCallback((width: number) => {
    setState(prev => {
      saveToPageStorage(prev.currentPage, 'width', width);
      return { ...prev, width };
    });
  }, [saveToPageStorage]);
  
  const setPosition = useCallback((position: 'left' | 'right') => {
    setState(prev => {
      saveToPageStorage(prev.currentPage, 'position', position);
      return { ...prev, position };
    });
  }, [saveToPageStorage]);
  
  const setContent = useCallback((content: ReactNode) => setState(prev => ({ ...prev, content })), []);
  const clearContent = useCallback(() => setState(prev => ({ ...prev, content: null })), []);
  const setTitle = useCallback((title: string) => setState(prev => ({ ...prev, title })), []);

  // Create the API object with stable function references and current state values
  const api: ContextSidebarAPI = useMemo(() => ({
    // Page configuration (stable reference)
    configure,
    
    // Collapse control (stable references) - user-controllable
    collapse,
    expand,
    toggleCollapse,
    
    // Width control (stable reference) - user-controllable
    setWidth,
    
    // Position control (stable reference) - user-controllable
    setPosition,
    
    // Content control (stable references) - programmatic
    setContent,
    clearContent,
    
    // Title control (stable reference) - programmatic
    setTitle,
    
    // State accessors (updated with current state) - read-only
    currentPage: state.currentPage,
    title: state.title,
    isVisible: state.isVisible,  // Read-only - controlled by page configuration
    isCollapsed: state.isCollapsed,
    width: state.width,
    position: state.position,
    content: state.content
  }), [
    configure,
    collapse, expand, toggleCollapse,
    setWidth, setPosition, setContent, clearContent, setTitle,
    state.currentPage, state.title, state.isVisible, state.isCollapsed, state.width, state.position, state.content
  ]);

  return (
    <ContextSidebarContext.Provider value={api}>
      {children}
    </ContextSidebarContext.Provider>
  );
}

/**
 * Hook to declaratively configure and control the context sidebar from any page
 * 
 * @param config - Page-specific configuration for the sidebar. If provided, 
 *                 automatically configures the sidebar for this page with user preferences.
 * 
 * @example
 * ```tsx
 * function DashboardPage() {
 *   // Declarative configuration - sidebar will be positioned right with user preferences
 *   const contextSidebar = useContextSidebar({
 *     page: 'dashboard',
 *     title: 'Recent Activity',
 *     defaultPosition: 'right',
 *     defaultVisible: true,
 *     defaultWidth: 320
 *   });
 *   
 *   useEffect(() => {
 *     // Set custom content for this page
 *     contextSidebar.setContent(<DashboardSidebar />);
 *     return () => contextSidebar.clearContent();
 *   }, []);
 *   
 *   return <div>Dashboard content...</div>;
 * }
 * ```
 */
export function useContextSidebar(config?: ContextSidebarPageConfig): ContextSidebarAPI {
  const context = useContext(ContextSidebarContext);
  
  if (!context) {
    throw new Error('useContextSidebar must be used within a ContextSidebarProvider');
  }
  
  // Configure the sidebar for this page if config is provided
  const { configure } = context;
  
  useEffect(() => {
    if (config) {
      configure(config);
    }
  }, [
    config?.page,
    config?.title, 
    config?.defaultVisible,
    config?.defaultCollapsed,
    config?.defaultWidth,
    config?.defaultPosition,
    configure
  ]);
  
  return context;
}