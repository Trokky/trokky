import { createContext, useContext, useState, ReactNode, useMemo, useCallback } from 'react';
import { storageService, STORAGE_KEYS } from '@/utils/storage';

interface ContextSidebarState {
  isVisible: boolean;
  isCollapsed: boolean;
  width: number;
  position: 'left' | 'right';
  content: ReactNode | null;
}

interface ContextSidebarAPI {
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
  
  // State accessors
  isVisible: boolean;
  isCollapsed: boolean;
  width: number;
  position: 'left' | 'right';
  content: ReactNode | null;
}

const ContextSidebarContext = createContext<ContextSidebarAPI | null>(null);

interface ContextSidebarProviderProps {
  children: ReactNode;
  defaultVisible?: boolean;
  defaultCollapsed?: boolean;
  defaultWidth?: number;
  defaultPosition?: 'left' | 'right';
}

export function ContextSidebarProvider({
  children,
  defaultVisible = true,
  defaultCollapsed = false,
  defaultWidth = 256,
  defaultPosition = 'left'
}: ContextSidebarProviderProps) {
  // Load persisted state from storage service
  const [state, setState] = useState<ContextSidebarState>(() => {
    return {
      isVisible: storageService.get('trokky_context_sidebar_visible', defaultVisible),
      isCollapsed: storageService.get(STORAGE_KEYS.CONTEXT_SIDEBAR_COLLAPSED, defaultCollapsed),
      width: storageService.get(STORAGE_KEYS.CONTEXT_SIDEBAR_WIDTH, defaultWidth),
      position: storageService.get(STORAGE_KEYS.CONTEXT_SIDEBAR_POSITION, defaultPosition),
      content: null
    };
  });

  // Helper function to save to storage service
  const saveToStorage = useCallback((key: string, value: any) => {
    storageService.set(key, value);
  }, []);

  // Memoize all the action functions with storage persistence
  const show = useCallback(() => {
    setState(prev => ({ ...prev, isVisible: true }));
    saveToStorage('trokky_context_sidebar_visible', true);
  }, [saveToStorage]);
  
  const hide = useCallback(() => {
    setState(prev => ({ ...prev, isVisible: false }));
    saveToStorage('trokky_context_sidebar_visible', false);
  }, [saveToStorage]);
  
  const toggle = useCallback(() => {
    setState(prev => {
      const newVisible = !prev.isVisible;
      saveToStorage('trokky_context_sidebar_visible', newVisible);
      return { ...prev, isVisible: newVisible };
    });
  }, [saveToStorage]);
  
  const collapse = useCallback(() => {
    setState(prev => ({ ...prev, isCollapsed: true }));
    saveToStorage(STORAGE_KEYS.CONTEXT_SIDEBAR_COLLAPSED, true);
  }, [saveToStorage]);
  
  const expand = useCallback(() => {
    setState(prev => ({ ...prev, isCollapsed: false }));
    saveToStorage(STORAGE_KEYS.CONTEXT_SIDEBAR_COLLAPSED, false);
  }, [saveToStorage]);
  
  const toggleCollapse = useCallback(() => {
    setState(prev => {
      const newCollapsed = !prev.isCollapsed;
      saveToStorage(STORAGE_KEYS.CONTEXT_SIDEBAR_COLLAPSED, newCollapsed);
      return { ...prev, isCollapsed: newCollapsed };
    });
  }, [saveToStorage]);
  
  const setWidth = useCallback((width: number) => {
    setState(prev => ({ ...prev, width }));
    saveToStorage(STORAGE_KEYS.CONTEXT_SIDEBAR_WIDTH, width);
  }, [saveToStorage]);
  
  const setPosition = useCallback((position: 'left' | 'right') => {
    setState(prev => ({ ...prev, position }));
    saveToStorage(STORAGE_KEYS.CONTEXT_SIDEBAR_POSITION, position);
  }, [saveToStorage]);
  
  const setContent = useCallback((content: ReactNode) => setState(prev => ({ ...prev, content })), []);
  const clearContent = useCallback(() => setState(prev => ({ ...prev, content: null })), []);

  // Create the API object with stable function references and current state values
  const api: ContextSidebarAPI = useMemo(() => ({
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
    
    // State accessors (updated with current state)
    isVisible: state.isVisible,
    isCollapsed: state.isCollapsed,
    width: state.width,
    position: state.position,
    content: state.content
  }), [
    show, hide, toggle,
    collapse, expand, toggleCollapse,
    setWidth, setPosition, setContent, clearContent,
    state.isVisible, state.isCollapsed, state.width, state.position, state.content
  ]);

  return (
    <ContextSidebarContext.Provider value={api}>
      {children}
    </ContextSidebarContext.Provider>
  );
}

/**
 * Hook to control the context sidebar from any page
 * 
 * @example
 * ```tsx
 * function MyPage() {
 *   const contextSidebar = useContextSidebar();
 *   
 *   useEffect(() => {
 *     // Show custom content
 *     contextSidebar.setContent(<MyCustomSidebar />);
 *     contextSidebar.show();
 *     
 *     // Cleanup on unmount
 *     return () => contextSidebar.clearContent();
 *   }, []);
 *   
 *   return (
 *     <div>
 *       <button onClick={contextSidebar.toggle}>
 *         Toggle Sidebar
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useContextSidebar(): ContextSidebarAPI {
  const context = useContext(ContextSidebarContext);
  
  if (!context) {
    throw new Error('useContextSidebar must be used within a ContextSidebarProvider');
  }
  
  return context;
}