import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react';

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
  defaultWidth = 320
}: ContextSidebarProviderProps) {
  const [state, setState] = useState<ContextSidebarState>({
    isVisible: defaultVisible,
    isCollapsed: defaultCollapsed,
    width: defaultWidth,
    content: null
  });

  const api: ContextSidebarAPI = useMemo(() => ({
    // Visibility control
    show: () => setState(prev => ({ ...prev, isVisible: true })),
    hide: () => setState(prev => ({ ...prev, isVisible: false })),
    toggle: () => setState(prev => ({ ...prev, isVisible: !prev.isVisible })),
    
    // Collapse control
    collapse: () => setState(prev => ({ ...prev, isCollapsed: true })),
    expand: () => setState(prev => ({ ...prev, isCollapsed: false })),
    toggleCollapse: () => setState(prev => ({ ...prev, isCollapsed: !prev.isCollapsed })),
    
    // Width control
    setWidth: (width: number) => setState(prev => ({ ...prev, width })),
    
    // Content control
    setContent: (content: ReactNode) => setState(prev => ({ ...prev, content })),
    clearContent: () => setState(prev => ({ ...prev, content: null })),
    
    // State accessors (these need to be updated from current state)
    isVisible: state.isVisible,
    isCollapsed: state.isCollapsed,
    width: state.width,
    content: state.content
  }), [state]); // Re-create only when state changes

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