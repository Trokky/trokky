import { UsersIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';

export function UsersPage() {
  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Users
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage users and their permissions
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
        <UsersIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          User management not available
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          User management will be available when your backend supports authentication.
        </p>
        <Button disabled>
          <PlusIcon className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>
    </div>
  );
}