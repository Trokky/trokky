import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  Cog6ToothIcon,
  UserCircleIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  Bars3Icon,
  PhotoIcon,
  UsersIcon,
  BeakerIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { useStudioBranding } from '@/hooks/useStudioConfig';
import { useDocumentTypes } from '@/hooks/useStructure';

interface HeaderProps {
  onOpenMobileMenu?: () => void;
  onOpenSearch?: () => void;
  showSearch?: boolean;
  showMedia?: boolean;
  showUserMenu?: boolean;
}

export function Header({
  onOpenMobileMenu,
  onOpenSearch,
  showSearch = true,
  showMedia = true,
  showUserMenu = true
}: HeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  
  // Get available document types for create dropdown
  const { documentTypes, singletonTypes, loading: typesLoading } = useDocumentTypes();

  // Get branding from API or fallback to window config
  const { branding } = useStudioBranding();

  const handleCreateDocument = (schemaName: string, isSingleton: boolean = false) => {
    setCreateMenuOpen(false);
    if (isSingleton) {
      // For singletons, navigate directly to the document (they have fixed IDs)
      navigate(`/content/${schemaName}/${schemaName}`);
    } else {
      // For regular documents, navigate to create new
      navigate(`/content/${schemaName}/new`);
    }
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
    { key: 'light' as const, label: 'Light', icon: SunIcon },
    { key: 'dark' as const, label: 'Dark', icon: MoonIcon },
    { key: 'system' as const, label: 'System', icon: ComputerDesktopIcon }
  ];

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
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
              <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">T</span>
              </div>
            )}
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                {branding.title}
              </h1>
            </div>
          </Link>
        </div>

        {/* Center section - Search */}
        {showSearch && (
          <div className="hidden md:block flex-1 max-w-lg mx-8">
            <button
              onClick={onOpenSearch}
              className="w-full flex items-center px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-left text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <MagnifyingGlassIcon className="h-4 w-4 mr-2" />
              <span className="flex-1">Search everything...</span>
              <div className="flex items-center space-x-1">
                <kbd className="px-1.5 py-0.5 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">
                  ⌘
                </kbd>
                <kbd className="px-1.5 py-0.5 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">
                  K
                </kbd>
              </div>
            </button>
          </div>
        )}

        {/* Right section */}
        <div className="flex items-center space-x-2">
          {/* Mobile search button */}
          {showSearch && (
            <button
              onClick={onOpenSearch}
              className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 md:hidden"
            >
              <MagnifyingGlassIcon className="h-5 w-5" />
            </button>
          )}

          {/* Create dropdown */}
          <div className="hidden sm:block relative">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setCreateMenuOpen(!createMenuOpen)}
              className="inline-flex items-center"
              disabled={typesLoading}
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Create
              <ChevronDownIcon className="h-3 w-3 ml-1" />
            </Button>

            {createMenuOpen && !typesLoading && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                {/* Regular document types */}
                {documentTypes.length > 0 && (
                  <div className="px-3 py-2">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      Document Types
                    </div>
                    {documentTypes.map((docType) => (
                      <button
                        key={docType.schemaType || docType.id}
                        onClick={() => handleCreateDocument(docType.schemaType, false)}
                        className="flex items-center w-full px-2 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      >
                        <PlusIcon className="h-4 w-4 mr-2 text-gray-400" />
                        <div className="flex-1 text-left">
                          <div className="font-medium">{docType.title}</div>
                          {docType.description && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">{docType.description}</div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Singleton types */}
                {singletonTypes.length > 0 && (
                  <>
                    {documentTypes.length > 0 && (
                      <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                    )}
                    <div className="px-3 py-2">
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                        Settings & Pages
                      </div>
                      {singletonTypes.map((singletonType) => (
                        <button
                          key={singletonType.schemaType || singletonType.id}
                          onClick={() => handleCreateDocument(singletonType.schemaType, true)}
                          className="flex items-center w-full px-2 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        >
                          <Cog6ToothIcon className="h-4 w-4 mr-2 text-gray-400" />
                          <div className="flex-1 text-left">
                            <div className="font-medium">{singletonType.title}</div>
                            {singletonType.description && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">{singletonType.description}</div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Empty state */}
                {documentTypes.length === 0 && singletonTypes.length === 0 && (
                  <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                    No document types available
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Media button */}
          {showMedia && (
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
              <Link to="/media">
                <PhotoIcon className="h-4 w-4 mr-1" />
                Media
              </Link>
            </Button>
          )}

          {/* Settings dropdown */}
          <div className="hidden sm:block relative">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSettingsMenuOpen(!settingsMenuOpen)}
              className="inline-flex items-center"
            >
              <Cog6ToothIcon className="h-4 w-4 mr-1" />
              Settings
              <ChevronDownIcon className="h-3 w-3 ml-1" />
            </Button>

            {settingsMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                {/* Settings option */}
                <Link
                  to="/settings"
                  onClick={() => setSettingsMenuOpen(false)}
                  className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Cog6ToothIcon className="h-4 w-4 mr-2 text-gray-400" />
                  <div className="flex-1 text-left">
                    <div className="font-medium">Settings</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Studio configuration</div>
                  </div>
                </Link>

                {/* Users option - admin only */}
                {user?.role === 'admin' && (
                  <Link
                    to="/users"
                    onClick={() => setSettingsMenuOpen(false)}
                    className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <UsersIcon className="h-4 w-4 mr-2 text-gray-400" />
                    <div className="flex-1 text-left">
                      <div className="font-medium">Users</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Manage users & permissions</div>
                    </div>
                  </Link>
                )}

                {/* Separator */}
                <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>

                {/* Fields Demo option */}
                <Link
                  to="/fields-demo"
                  onClick={() => setSettingsMenuOpen(false)}
                  className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <BeakerIcon className="h-4 w-4 mr-2 text-gray-400" />
                  <div className="flex-1 text-left">
                    <div className="font-medium">Fields Demo</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Test field components</div>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* User menu */}
          {showUserMenu && (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center space-x-2 p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:!text-gray-100 dark:hover:!text-gray-100 hover:!bg-transparent dark:hover:!bg-transparent"
              >
                <UserCircleIcon className="h-6 w-6" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                  {/* User info */}
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center space-x-3">
                      {(user as any)?.profileImage ? (
                        <img 
                          src={(user as any).profileImage} 
                          alt="Profile" 
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center">
                          <span className="text-white font-medium text-sm">
                            {((user as any)?.firstName?.[0] || (user as any)?.username?.[0] || (user as any)?.name?.[0] || 'U').toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {(user as any)?.firstName && (user as any)?.lastName 
                            ? `${(user as any).firstName} ${(user as any).lastName}`
                            : (user as any)?.username || (user as any)?.name || 'Studio User'}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {(user as any)?.email || 'user@example.com'}
                        </p>
                        {user?.role && (
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full mt-1 ${
                            user.role === 'admin' 
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                              : user.role === 'editor'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                              : user.role === 'author'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                          }`}>
                            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Theme selector */}
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Theme
                    </p>
                    <div className="flex space-x-1">
                      {themeOptions.map(({ key, label, icon: Icon }) => (
                        <button
                          key={key}
                          onClick={() => {
                            handleThemeChange(key);
                            setUserMenuOpen(false);
                          }}
                          className={cn(
                            'flex items-center justify-center w-8 h-8 rounded transition-colors',
                            theme === key
                              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                              : 'text-gray-500 hover:bg-gray-100 dark:!text-gray-100 dark:hover:!bg-transparent'
                          )}
                          title={label}
                        >
                          <Icon className="h-4 w-4" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="py-1">
                    <Link
                      to="/user/preferences"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:!text-gray-100 dark:hover:!bg-transparent"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      Preferences
                    </Link>
                    <button
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:!text-gray-100 dark:hover:!bg-transparent"
                      onClick={async () => {
                        setUserMenuOpen(false);
                        await logout();
                      }}
                    >
                      Sign out
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
    </header>
  );
}