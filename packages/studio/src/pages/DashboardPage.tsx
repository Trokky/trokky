import { Link } from 'react-router-dom';
import { 
  DocumentTextIcon, 
  PhotoIcon, 
  UsersIcon,
  ChartBarIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';

export function DashboardPage() {

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Welcome to Trokky Studio v2
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <DocumentTextIcon className="h-8 w-8 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Documents
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                --
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <PhotoIcon className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Media Files
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                --
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <UsersIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Users
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                --
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ChartBarIcon className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Storage
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                --
              </p>
            </div>
          </div>
        </div>
      </div>


      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h2>
          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/content">
                <DocumentTextIcon className="h-4 w-4 mr-2" />
                Browse Content
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/media">
                <PhotoIcon className="h-4 w-4 mr-2" />
                Upload Media
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/users">
                <UsersIcon className="h-4 w-4 mr-2" />
                Manage Users
              </Link>
            </Button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Recent Activity
          </h2>
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              No recent activity to show
            </p>
          </div>
        </div>
      </div>

      {/* Getting Started */}
      <div className="bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 rounded-lg border border-primary-200 dark:border-primary-800 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Welcome to Trokky Studio v2
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Your zero-config content management system is ready to use. Start by exploring your content or uploading some media files.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/content">
              <PlusIcon className="h-4 w-4 mr-2" />
              Create Content
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/settings">
              Configure Studio
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}