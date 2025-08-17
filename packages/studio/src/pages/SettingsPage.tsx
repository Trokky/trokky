
import { useState, useEffect } from 'react';
import { useContextSidebar } from '@/contexts/ContextSidebarContext';
import { useStudioBranding } from '@/hooks/useStudioConfig';

export function SettingsPage() {
  const contextSidebar = useContextSidebar();
  const { branding } = useStudioBranding();
  
  // Hide context sidebar for settings page
  useEffect(() => {
    contextSidebar.hide();
  }, [contextSidebar]);

  // Get current domain for default public URL
  const [publicUrl, setPublicUrl] = useState(() => {
    // Infer from current domain, removing /studio if present
    const currentOrigin = window.location.origin;
    const currentPath = window.location.pathname;
    
    // If we're in /studio, use the base domain
    if (currentPath.includes('/studio')) {
      return currentOrigin;
    }
    
    return currentOrigin;
  });

  const [studioTitle, setStudioTitle] = useState(branding?.title || 'Trokky Studio');
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system');

  const handleSave = () => {
    // Save settings to localStorage for now
    // TODO: Implement proper settings persistence to backend
    try {
      // Normalize the public URL by removing trailing slash
      const normalizedPublicUrl = publicUrl.replace(/\/$/, '');
      
      localStorage.setItem('trokky_studio_title', studioTitle);
      localStorage.setItem('trokky_public_url', normalizedPublicUrl);
      localStorage.setItem('trokky_default_theme', theme);
      
      // Update state with normalized URL
      setPublicUrl(normalizedPublicUrl);
      
      // Show success message (you could add a toast notification here)
      console.log('Settings saved successfully:', {
        studioTitle,
        publicUrl: normalizedPublicUrl,
        theme
      });
      
      // TODO: Add toast notification for user feedback
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings. Please try again.');
    }
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Configure your Trokky Studio and content management
        </p>
      </div>

      <div className="max-w-4xl">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            General Settings
          </h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Studio Title
              </label>
              <input
                type="text"
                value={studioTitle}
                onChange={(e) => setStudioTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Trokky Studio"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                The title displayed in the Studio interface
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Public Website URL
              </label>
              <input
                type="url"
                value={publicUrl}
                onChange={(e) => setPublicUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="https://yourwebsite.com"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                The public URL where your content will be displayed. Used for "View Live" links.
              </p>
            </div>


            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default Theme
              </label>
              <select 
                value={theme}
                onChange={(e) => setTheme(e.target.value as 'system' | 'light' | 'dark')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Choose the default theme for new users
              </p>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <button 
                onClick={handleSave}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}