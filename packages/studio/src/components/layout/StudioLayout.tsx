import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { MainSidebar } from './MainSidebar';
import { ContextSidebar } from './ContextSidebar';
import { ContextSidebarProvider, useContextSidebar } from '@/contexts/ContextSidebarContext';
import { useT } from '@trokky/trokky/i18n';

interface StudioLayoutProps {
  showSearch?: boolean;
  showMedia?: boolean;
  showUserMenu?: boolean;
}

function StudioLayoutInner({
  showSearch = true,
  showMedia = true,
  showUserMenu = true
}: StudioLayoutProps) {
  const { t } = useT('studio');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const contextSidebar = useContextSidebar();

  const handleOpenMobileMenu = () => {
    setMobileMenuOpen(true);
  };

  const handleCloseMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  // const handleOpenSearch = () => {
  //   setSearchOpen(true);
  // };

  const handleCloseSearch = () => {
    setSearchOpen(false);
  };

  return (
    <div className="h-dvh flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <Header
        onOpenMobileMenu={handleOpenMobileMenu}
        showSearch={showSearch}
        showMedia={showMedia}
        showUserMenu={showUserMenu}
      />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main sidebar - hidden on mobile */}
        <div className="hidden lg:flex">
          <MainSidebar />
        </div>

        {/* Context sidebar - left position */}
        {contextSidebar.position === 'left' && (
          <div className="flex">
            <ContextSidebar position="left" />
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-auto bg-white dark:bg-gray-800">
          <Outlet />
        </main>

        {/* Context sidebar - right position */}
        {contextSidebar.position === 'right' && (
          <div className="flex">
            <ContextSidebar position="right" />
          </div>
        )}
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={handleCloseMobileMenu}
          />
          
          {/* Sidebar */}
          <div className="fixed inset-y-0 left-0 w-64 flex flex-col bg-white dark:bg-gray-800 shadow-lg transform transition-transform duration-300 ease-in-out">
            <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('sidebar.navigation')}
              </h2>
              <button
                onClick={handleCloseMobileMenu}
                className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <MainSidebar isMobile onItemClick={handleCloseMobileMenu} />
            </div>
          </div>
        </div>
      )}

      {/* Search modal placeholder */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4">
            <div 
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={handleCloseSearch}
            />
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {t('layout.globalSearch')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {t('layout.searchPlaceholder')}
              </p>
              <button
                onClick={handleCloseSearch}
                className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
  );
}

export function StudioLayout(props: StudioLayoutProps) {
  return (
    <ContextSidebarProvider>
      <StudioLayoutInner {...props} />
    </ContextSidebarProvider>
  );
}