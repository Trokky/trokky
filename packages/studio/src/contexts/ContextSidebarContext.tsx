import { createContext, useContext, useState, ReactNode, useMemo, useCallback } from 'react';

interface ContextSidebarState {
  isVisible: boolean;
  isCollapsed: boolean;
  width: number;
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
  
  // Content control
  setContent: (content: ReactNode) => void;
  clearContent: () => void;
  
  // State accessors
  isVisible: boolean;
  isCollapsed: boolean;
  width: number;
  content: ReactNode | null;
}

const ContextSidebarContext = createContext<ContextSidebarAPI | null>(null);

interface ContextSidebarProviderProps {
  children: ReactNode;
  defaultVisible?: boolean;
  defaultCollapsed?: boolean;
  defaultWidth?: number;
}

export function ContextSidebarProvider({
  children,
  defaultVisible = true,
  defaultCollapsed = false,
  defaultWidth = 256
}: ContextSidebarProviderProps) {
  // Load persisted state from localStorage
  const [state, setState] = useState<ContextSidebarState>(() => {
    try {
      const savedCollapsed = localStorage.getItem('trokky_context_sidebar_collapsed');
      const savedWidth = localStorage.getItem('trokky_context_sidebar_width');
      const savedVisible = localStorage.getItem('trokky_context_sidebar_visible');
      
      return {
        isVisible: savedVisible !== null ? savedVisible === 'true' : defaultVisible,
        isCollapsed: savedCollapsed !== null ? savedCollapsed === 'true' : defaultCollapsed,
        width: savedWidth ? parseInt(savedWidth, 10) : defaultWidth,
        content: null
      };
    } catch {
      return {
        isVisible: defaultVisible,
        isCollapsed: defaultCollapsed,
        width: defaultWidth,
        content: null
      };
    }
  });

  // Helper function to save to localStorage
  const saveToStorage = useCallback((key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.warn('Failed to save context sidebar state:', error);
    }
  }, []);

  // Memoize all the action functions with localStorage persistence
  const show = useCallback(() => {
    setState(prev => ({ ...prev, isVisible: true }));
    saveToStorage('trokky_context_sidebar_visible', 'true');
  }, [saveToStorage]);
  
  const hide = useCallback(() => {
    setState(prev => ({ ...prev, isVisible: false }));
    saveToStorage('trokky_context_sidebar_visible', 'false');
  }, [saveToStorage]);
  
  const toggle = useCallback(() => {
    setState(prev => {
      const newVisible = !prev.isVisible;
      saveToStorage('trokky_context_sidebar_visible', String(newVisible));
      return { ...prev, isVisible: newVisible };
    });
  }, [saveToStorage]);
  
  const collapse = useCallback(() => {
    setState(prev => ({ ...prev, isCollapsed: true }));
    saveToStorage('trokky_context_sidebar_collapsed', 'true');
  }, [saveToStorage]);
  
  const expand = useCallback(() => {
    setState(prev => ({ ...prev, isCollapsed: false }));
    saveToStorage('trokky_context_sidebar_collapsed', 'false');
  }, [saveToStorage]);
  
  const toggleCollapse = useCallback(() => {
    setState(prev => {
      const newCollapsed = !prev.isCollapsed;
      saveToStorage('trokky_context_sidebar_collapsed', String(newCollapsed));
      return { ...prev, isCollapsed: newCollapsed };
    });
  }, [saveToStorage]);
  
  const setWidth = useCallback((width: number) => {
    setState(prev => ({ ...prev, width }));
    saveToStorage('trokky_context_sidebar_width', String(width));
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
    
    // Content control (stable references)
    setContent,
    clearContent,
    
    // State accessors (updated with current state)
    isVisible: state.isVisible,
    isCollapsed: state.isCollapsed,
    width: state.width,
    content: state.content
  }), [
    show, hide, toggle,
    collapse, expand, toggleCollapse,
    setWidth, setContent, clearContent,
    state.isVisible, state.isCollapsed, state.width, state.content
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