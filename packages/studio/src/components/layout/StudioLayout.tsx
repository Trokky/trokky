import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { MainSidebar } from './MainSidebar';
import { ContextSidebar } from './ContextSidebar';
import { ContextSidebarProvider, useContextSidebar } from '@/contexts/ContextSidebarContext';
import { Dialog } from '@/components/ui/Dialog.js';
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
  const contextSidebar = useContextSidebar();

  const handleOpenMobileMenu = () => {
    setMobileMenuOpen(true);
  };

  const handleCloseMobileMenu = () => {
    setMobileMenuOpen(false);
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

      {/* Mobile navigation drawer */}
      <Dialog
        open={mobileMenuOpen}
        onClose={handleCloseMobileMenu}
        variant="drawer-left"
        size="sm"
        wrapperClassName="lg:hidden"
        title={t('sidebar.navigation')}
      >
        <Dialog.Body padded={false}>
          <MainSidebar isMobile onItemClick={handleCloseMobileMenu} />
        </Dialog.Body>
      </Dialog>

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