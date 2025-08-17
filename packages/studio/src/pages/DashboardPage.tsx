import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  DocumentTextIcon, 
  PhotoIcon, 
  UsersIcon,
  CogIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { useContextSidebar } from '@/contexts/ContextSidebarContext';
import { StatsWidget, DashboardContextSidebar } from '@/components/dashboard';

export function DashboardPage() {
  // Declarative context sidebar configuration for dashboard
  const contextSidebar = useContextSidebar({
    page: 'dashboard',
    defaultPosition: 'right',
    defaultVisible: true,
    defaultWidth: 320
  });

  useEffect(() => {
    // Set dashboard context sidebar content
    contextSidebar.setContent(<DashboardContextSidebar />);
  }, [contextSidebar]);

  return (
    <div className="min-h-full bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome to Trokky Studio
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mt-2">
            Content management made simple
          </p>
        </div>

        {/* Main Content - Full Width */}
        <div className="space-y-8">
          {/* Main Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Link 
              to="/content" 
              className="group bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <DocumentTextIcon className="h-8 w-8 text-primary-600" />
                <ArrowRightIcon className="h-5 w-5 text-gray-400 group-hover:text-primary-600 transition-colors" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Content
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Create and manage your content
              </p>
            </Link>

            <Link 
              to="/media" 
              className="group bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <PhotoIcon className="h-8 w-8 text-green-600" />
                <ArrowRightIcon className="h-5 w-5 text-gray-400 group-hover:text-green-600 transition-colors" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Media
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Upload and organize media files
              </p>
            </Link>

            <Link 
              to="/users" 
              className="group bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <UsersIcon className="h-8 w-8 text-blue-600" />
                <ArrowRightIcon className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Users
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Manage users and permissions
              </p>
            </Link>
          </div>

          {/* Content Overview */}
          <StatsWidget />

          {/* Secondary Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Quick Start
              </h2>
              <div className="space-y-3">
                <Button className="w-full justify-start" asChild>
                  <Link to="/content">
                    <DocumentTextIcon className="h-4 w-4 mr-2" />
                    Create Your First Document
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link to="/media">
                    <PhotoIcon className="h-4 w-4 mr-2" />
                    Upload Media
                  </Link>
                </Button>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Settings
              </h2>
              <div className="space-y-3">
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link to="/settings">
                    <CogIcon className="h-4 w-4 mr-2" />
                    Studio Settings
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link to="/user/preferences">
                    <CogIcon className="h-4 w-4 mr-2" />
                    User Preferences
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}