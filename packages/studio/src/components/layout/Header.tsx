import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { useT } from '@trokky/trokky/i18n';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  Cog6ToothIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  Bars3Icon,
  PhotoIcon,
  UsersIcon,
  ChevronDownIcon,
  KeyIcon,
  ClockIcon,
  UserCircleIcon
} from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePermissions } from '@/hooks/usePermissions';
import { MEDIA_PERMISSIONS, SETTINGS_PERMISSIONS, USER_PERMISSIONS, TOKEN_PERMISSIONS, WEBHOOK_PERMISSIONS, SETTINGS_MENU_PERMISSIONS } from '@/constants/permissions';
import { useStudioContext } from '@/contexts/StudioContext';
import { useDocumentTypes } from '@/hooks/useStructure';
import { isSingletonStructureItem } from '@/utils/singleton';
import { useGlobalSearch } from '@/hooks/useSearch';
import { SimpleSearchModal } from '@/components/SimpleSearchModal';
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal';

interface HeaderProps {
  onOpenMobileMenu?: () => void;
  showSearch?: boolean;
  showMedia?: boolean;
  showUserMenu?: boolean;
}

/**
 * The Trokky mark, shown when an instance has not set `branding.logo`. Inline rather than an
 * <img> because Studio is mounted at an arbitrary path and serves no image of its own; the
 * colours are the brand's, not the theme's, so they stay put when an instance retints primary.
 */
function TrokkyMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="63.7897 30.7614 369.3923 419.7933" role="img" aria-label="Trokky">
      <g transform="matrix(0.72264,0,0,0.72264,-121.878,-125.706)">
        <path
          fill="#183d92"
          d="M 465.11 638.46 L 465.10 772.87 Q 319.91 688.48 280.90 666.09 C 269.69 659.66 261.96 653.65 258.16 642.03 Q 256.90 638.20 256.93 623.35 Q 257.09 519.51 256.95 386.11 Q 256.94 374.37 258.39 370.03 C 261.72 360.07 269.43 352.88 278.44 347.67 Q 313.18 327.57 489.91 224.70 Q 500.73 218.40 505.80 217.27 Q 517.46 214.65 528.80 221.20 Q 573.35 246.94 681.69 309.30 Q 686.56 312.11 687.20 313.41 C 689.18 317.48 685.55 322.00 681.99 324.25 Q 655.76 340.80 615.21 365.45 Q 565.32 395.77 474.31 450.77 Q 465.13 456.32 465.14 468.00 Q 465.25 552.67 465.11 638.46 Z"
        />
        <path
          fill="#1c8bca"
          d="M 465.10 772.87 L 465.11 638.46 Q 506.89 612.92 547.91 587.16 C 558.95 580.23 558.21 573.32 558.19 560.03 Q 558.06 479.81 558.19 449.52 Q 558.22 443.61 562.04 438.58 Q 563.76 436.32 571.57 431.68 Q 596.28 417.02 707.80 350.08 Q 719.63 342.98 722.63 342.26 Q 730.46 340.38 738.94 344.55 Q 745.45 347.75 749.33 350.11 Q 764.09 359.12 767.43 374.48 Q 768.20 378.03 768.08 397.09 Q 767.98 413.29 768.10 630.37 Q 768.11 648.99 754.19 659.73 C 748.29 664.28 736.84 670.51 731.18 673.88 Q 665.86 712.80 537.35 789.32 Q 527.34 795.27 522.25 796.52 Q 511.06 799.28 500.51 793.74 Q 492.13 789.34 465.10 772.87 Z"
        />
      </g>
    </svg>
  )
}

export function Header({
  onOpenMobileMenu,
  showSearch = true,
  showMedia = true,
  showUserMenu = true
}: HeaderProps) {
  const { t } = useT('studio');
  const { logout } = useAuth();
  const { user, loading: userLoading } = useCurrentUser();
  const { hasPermission, hasAnyPermission } = usePermissions();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

  // Get available document types for create dropdown (excluding singletons)
  const { documentTypes, loading: typesLoading } = useDocumentTypes();

  // A custom structure may list a singleton schema; the server marks those and still enforces
  // one document, so they must not appear as something to create.
  const creatableTypes = documentTypes.filter(docType => !isSingletonStructureItem(docType));


  // Get branding from StudioContext
  const studioContext = useStudioContext();
  const branding = studioContext?.branding || { title: 'Trokky Studio' };

  // Global search functionality
  const { isOpen: searchOpen, openSearch, closeSearch } = useGlobalSearch();

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openSearch();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [openSearch]);

  const handleCreateDocument = (schemaName: string) => {
    setCreateMenuOpen(false);
    // Only allow creation of regular documents, not singletons
    navigate(`/content/${schemaName}/new`);
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    
    if (newTheme === 'system') {
      document.documentElement.classList.remove('light', 'dark');
    } else {
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(newTheme);
    }
    
    // Save to localStorage
    localStorage.setItem('trokky_theme', newTheme);
  };

  const themeOptions = [
    { key: 'light' as const, label: t('theme.light'), icon: SunIcon },
    { key: 'dark' as const, label: t('theme.dark'), icon: MoonIcon },
    { key: 'system' as const, label: t('theme.system'), icon: ComputerDesktopIcon }
  ];

  return (
    <header className="sticky top-0 z-sticky bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6">
        {/* Left section */}
        <div className="flex items-center space-x-4">
          {/* Mobile menu button */}
          <button
            onClick={onOpenMobileMenu}
            className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 lg:hidden"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>

          {/* Logo and title */}
          <Link to="/" className="flex items-center space-x-3">
            {branding.logo ? (
              <img 
                src={branding.logo} 
                alt="Logo" 
                className="h-8 w-8 rounded-lg object-cover"
              />
            ) : (
              <TrokkyMark className="h-8 w-8" />
            )}
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                {branding.organizationName || branding.title}
              </h1>
            </div>
          </Link>
        </div>

        {/* Center section - Search */}
        {showSearch && (
          <div className="hidden lg:block flex-1 max-w-sm mx-4">
            <button
              onClick={openSearch}
              className="w-full flex items-center px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-left text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
            >
              <MagnifyingGlassIcon className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="flex-1 truncate">{t('nav.searchPlaceholder')}</span>
              <kbd className="hidden xl:inline-flex px-1.5 py-0.5 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">
                ⌘K
              </kbd>
            </button>
          </div>
        )}

        {/* Right section */}
        <div className="flex items-center space-x-2">
          {/* Mobile search button */}
          {showSearch && (
            <button
              onClick={openSearch}
              className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 md:hidden"
            >
              <MagnifyingGlassIcon className="h-5 w-5" />
            </button>
          )}

          {/* Create dropdown - only for regular documents, not singletons */}
          <div className="hidden sm:block relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCreateMenuOpen(!createMenuOpen)}
              className="inline-flex items-center"
              disabled={typesLoading}
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              {t('header.create')}
              <ChevronDownIcon className="h-3 w-3 ml-1" />
            </Button>

            {createMenuOpen && !typesLoading && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                {/* Regular document types only */}
                {creatableTypes.length > 0 ? (
                  <div className="px-3 py-2">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      {t('header.createNewDocument')}
                    </div>
                    {creatableTypes.map((docType) => (
                      <button
                        key={docType.schemaType || docType.id}
                        onClick={() => handleCreateDocument(docType.schemaType)}
                        className="flex items-center w-full px-2 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      >
                        <PlusIcon className="h-4 w-4 mr-2 text-gray-400" />
                        <div className="flex-1 text-left">
                          <div className="font-medium">{docType.schemaTitle || docType.title}</div>
                          {docType.description && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">{docType.description}</div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                    {t('header.noDocumentTypes')}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Media button */}
          {showMedia && hasPermission(MEDIA_PERMISSIONS.READ) && (
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
              <Link to="/media">
                <PhotoIcon className="h-4 w-4 mr-1" />
                {t('nav.media')}
              </Link>
            </Button>
          )}

          {/* Settings dropdown - only show if user has access to any settings features */}
          {hasAnyPermission([...SETTINGS_MENU_PERMISSIONS]) && (
            <div className="hidden sm:block relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSettingsMenuOpen(!settingsMenuOpen)}
                className="inline-flex items-center"
              >
                <Cog6ToothIcon className="h-4 w-4 mr-1" />
                {t('nav.settings')}
                <ChevronDownIcon className="h-3 w-3 ml-1" />
              </Button>

            {settingsMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                {/* Settings option */}
                {hasPermission(SETTINGS_PERMISSIONS.READ) && (
                  <Link
                    to="/settings"
                    onClick={() => setSettingsMenuOpen(false)}
                    className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Cog6ToothIcon className="h-4 w-4 mr-2 text-gray-400" />
                    <div className="flex-1 text-left">
                      <div className="font-medium">{t('nav.settings')}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{t('header.studioConfiguration')}</div>
                    </div>
                  </Link>
                )}

                {/* Users & Access option - show if user has access to any Users/Tokens/Webhooks features */}
                {hasAnyPermission([USER_PERMISSIONS.READ, TOKEN_PERMISSIONS.READ, WEBHOOK_PERMISSIONS.READ]) && (
                  <Link
                    to="/users"
                    onClick={() => setSettingsMenuOpen(false)}
                    className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <UsersIcon className="h-4 w-4 mr-2 text-gray-400" />
                    <div className="flex-1 text-left">
                      <div className="font-medium">{t('nav.users')}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{t('header.manageUsersPermissions')}</div>
                    </div>
                  </Link>
                )}

                {/* Audit Logs - available to admins */}
                <Link
                  to="/audit-logs"
                  onClick={() => setSettingsMenuOpen(false)}
                  className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <ClockIcon className="h-4 w-4 mr-2 text-gray-400" />
                  <div className="flex-1 text-left">
                    <div className="font-medium">{t('nav.auditLogs')}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{t('header.viewAllChanges')}</div>
                  </div>
                </Link>
              </div>
            )}
            </div>
          )}

          {/* Theme toggle */}
          <button
            onClick={() => {
              const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
              handleThemeChange(nextTheme);
            }}
            className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
            title={`${t('theme.toggle')}: ${themeOptions.find(o => o.key === theme)?.label}`}
          >
            {theme === 'light' ? (
              <SunIcon className="h-5 w-5" />
            ) : theme === 'dark' ? (
              <MoonIcon className="h-5 w-5" />
            ) : (
              <ComputerDesktopIcon className="h-5 w-5" />
            )}
          </button>

          {/* User menu */}
          {showUserMenu && (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700 transition-colors"
              >
                {/* User avatar */}
                {userLoading ? (
                  <div className="h-6 w-6 rounded-full bg-gray-300 dark:bg-gray-600 animate-pulse" />
                ) : user?.profileImage ? (
                  <img 
                    src={user.profileImage} 
                    alt="Profile" 
                    className="h-6 w-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-primary-600 flex items-center justify-center">
                    <span className="text-white font-medium text-xs">
                      {(user?.firstName?.[0] || user?.username?.[0] || 'U').toUpperCase()}
                    </span>
                  </div>
                )}
                
                {/* Username - show on larger screens */}
                <span className="hidden sm:block text-sm font-medium truncate max-w-24">
                  {userLoading ? (
                    <div className="h-4 w-16 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
                  ) : (
                    user?.firstName || user?.username || 'User'
                  )}
                </span>
                
                {/* Dropdown arrow */}
                <ChevronDownIcon className={cn(
                  "h-4 w-4 transition-transform",
                  userMenuOpen && "rotate-180"
                )} />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                  {/* Compact user info */}
                  <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                    {userLoading ? (
                      <div className="space-y-2">
                        <div className="h-4 w-32 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
                        <div className="h-3 w-24 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {user?.firstName && user?.lastName
                            ? `${user.firstName} ${user.lastName}`
                            : user?.username || t('header.user')}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {user?.email || t('header.noEmail')}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Menu items */}
                  <div className="py-1">
                    <Link
                      to="/user/preferences"
                      className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <UserCircleIcon className="h-4 w-4 mr-2 text-gray-400" />
                      {t('header.preferences')}
                    </Link>

                    <button
                      className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => {
                        setUserMenuOpen(false);
                        setChangePasswordOpen(true);
                      }}
                    >
                      <KeyIcon className="h-4 w-4 mr-2 text-gray-400" />
                      {t('header.changePassword')}
                    </button>

                    <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>

                    <button
                      className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                      onClick={async () => {
                        setUserMenuOpen(false);
                        await logout();
                      }}
                    >
                      <svg className="h-4 w-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      {t('header.signOut')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Backdrop for menus */}
      {(userMenuOpen || createMenuOpen || settingsMenuOpen) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setUserMenuOpen(false);
            setCreateMenuOpen(false);
            setSettingsMenuOpen(false);
          }}
        />
      )}

      {/* Simple Search Modal */}
      <SimpleSearchModal
        isOpen={searchOpen}
        onClose={closeSearch}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </header>
  );
}