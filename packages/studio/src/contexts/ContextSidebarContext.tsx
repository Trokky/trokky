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
  
  // Visibility control
  show: () => void;
  hide: () => void;
  toggle: () => void;
  
  // Collapse control
  collapse: () => void;
  expand: () => void;
  toggleCollapse: () => void;
  
  // Width control
  setWidth: (width: number) => void;
  
  // Position control
  setPosition: (position: 'left' | 'right') => void;
  
  // Content control
  setContent: (content: ReactNode) => void;
  clearContent: () => void;
  
  // Title control
  setTitle: (title: string) => void;
  
  // State accessors
  currentPage: string;
  title: string;
  isVisible: boolean;
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
    
    // Load existing user preferences for this page, or use defaults
    const savedVisible = storageService.get(STORAGE_KEYS.CONTEXT_SIDEBAR_VISIBLE(page), config.defaultVisible ?? true);
    const savedCollapsed = storageService.get(STORAGE_KEYS.CONTEXT_SIDEBAR_COLLAPSED(page), config.defaultCollapsed ?? false);
    const savedWidth = storageService.get(STORAGE_KEYS.CONTEXT_SIDEBAR_WIDTH(page), config.defaultWidth ?? 256);
    const savedPosition = storageService.get(STORAGE_KEYS.CONTEXT_SIDEBAR_POSITION(page), config.defaultPosition ?? 'left');
    
    setState(prev => {
      const isPageChange = prev.currentPage !== page;
      
      return {
        ...prev,
        currentPage: page,
        title: config.title ?? 'Context',
        isVisible: savedVisible,
        isCollapsed: savedCollapsed,
        width: savedWidth,
        position: savedPosition,
        // Auto-clear content when switching to a different page
        content: isPageChange ? null : prev.content
      };
    });
  }, []);

  // Memoize all the action functions with page-specific storage persistence
  const show = useCallback(() => {
    setState(prev => {
      saveToPageStorage(prev.currentPage, 'visible', true);
      return { ...prev, isVisible: true };
    });
  }, [saveToPageStorage]);
  
  const hide = useCallback(() => {
    setState(prev => {
      saveToPageStorage(prev.currentPage, 'visible', false);
      return { ...prev, isVisible: false };
    });
  }, [saveToPageStorage]);
  
  const toggle = useCallback(() => {
    setState(prev => {
      const newVisible = !prev.isVisible;
      saveToPageStorage(prev.currentPage, 'visible', newVisible);
      return { ...prev, isVisible: newVisible };
    });
  }, [saveToPageStorage]);
  
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
    
    // Visibility control (stable references)
    show,
    hide,
    toggle,
    
    // Collapse control (stable references)
    collapse,
    expand,
    toggleCollapse,
    
    // Width control (stable reference)
    setWidth,
    
    // Position control (stable reference)
    setPosition,
    
    // Content control (stable references)
    setContent,
    clearContent,
    
    // Title control (stable reference)
    setTitle,
    
    // State accessors (updated with current state)
    currentPage: state.currentPage,
    title: state.title,
    isVisible: state.isVisible,
    isCollapsed: state.isCollapsed,
    width: state.width,
    position: state.position,
    content: state.content
  }), [
    configure, show, hide, toggle,
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