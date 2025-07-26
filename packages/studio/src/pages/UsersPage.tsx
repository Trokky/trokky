import { useState } from 'react';
import { UserManagement } from '@/components/users/UserManagement';
import { AppTokenManagement } from '@/components/users/AppTokenManagement';

export function UsersPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'tokens'>('users');

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Users & Access
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage users, permissions, and API tokens
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex">
            <button
              onClick={() => setActiveTab('users')}
              className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'users'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Users
            </button>
            <button
              onClick={() => setActiveTab('tokens')}
              className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'tokens'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              API Tokens
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'users' ? <UserManagement /> : <AppTokenManagement />}
        </div>
      </div>
    </div>
  );
}