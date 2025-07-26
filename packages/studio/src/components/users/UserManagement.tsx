import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { apiClient } from '@/services/api-client';
import { createStudioLogger } from '@/utils/logger';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_PERMISSIONS, type UserRole, type Permission, type User } from '@/types';
import { generateWebSecurePassword } from '@/utils/web-crypto';

const logger = createStudioLogger('UserManagement');

// Define available roles and permissions
const USER_ROLES: { value: UserRole; label: string; description: string }[] = [
  { value: 'admin', label: 'Administrator', description: 'Full access to all features' },
  { value: 'editor', label: 'Editor', description: 'Create, edit, and publish content' },
  { value: 'author', label: 'Author', description: 'Create and edit own content' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access to content' }
];

const PERMISSIONS: { value: Permission; label: string; group: string }[] = [
  { value: 'content:read', label: 'View Content', group: 'Content' },
  { value: 'content:write', label: 'Edit Content', group: 'Content' },
  { value: 'content:delete', label: 'Delete Content', group: 'Content' },
  { value: 'content:publish', label: 'Publish Content', group: 'Content' },
  { value: 'media:read', label: 'View Media', group: 'Media' },
  { value: 'media:upload', label: 'Upload Media', group: 'Media' },
  { value: 'media:edit', label: 'Edit Media', group: 'Media' },
  { value: 'media:delete', label: 'Delete Media', group: 'Media' },
  { value: 'users:read', label: 'View Users', group: 'Users' },
  { value: 'users:write', label: 'Edit Users', group: 'Users' },
  { value: 'users:delete', label: 'Delete Users', group: 'Users' },
  { value: 'users:invite', label: 'Invite Users', group: 'Users' },
  { value: 'settings:read', label: 'View Settings', group: 'Settings' },
  { value: 'settings:write', label: 'Edit Settings', group: 'Settings' },
  { value: 'studio:access', label: 'Studio Access', group: 'Access' },
  { value: 'tokens:read', label: 'View API Tokens', group: 'Tokens' },
  { value: 'tokens:write', label: 'Create API Tokens', group: 'Tokens' },
  { value: 'tokens:delete', label: 'Delete API Tokens', group: 'Tokens' }
];

interface UserFormData {
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  permissions: Permission[];
  password?: string;
  active: boolean;
}

interface UserModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (userData: UserFormData) => Promise<void>;
}

function UserModal({ user, isOpen, onClose, onSave }: UserModalProps) {
  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    email: '',
    fullName: '',
    role: 'viewer',
    permissions: [],
    password: '',
    active: true
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hasCustomPermissions, setHasCustomPermissions] = useState(false);

  // Check if current permissions match the role's default permissions
  const checkCustomPermissions = (role: UserRole, permissions: Permission[]) => {
    const rolePermissions = ROLE_PERMISSIONS[role] || [];
    const sortedRole = [...rolePermissions].sort();
    const sortedCurrent = [...permissions].sort();
    return sortedRole.join(',') !== sortedCurrent.join(',');
  };

  // Handle role change - always update permissions to match new role
  const handleRoleChange = (newRole: UserRole) => {
    const rolePermissions = ROLE_PERMISSIONS[newRole] || [];
    setFormData(prev => ({
      ...prev,
      role: newRole,
      permissions: rolePermissions
    }));
    // Reset custom permissions flag since we're using role defaults
    setHasCustomPermissions(false);
  };

  // Handle permission toggle - mark as custom
  const handlePermissionToggle = (permission: Permission) => {
    setFormData(prev => {
      const newPermissions = prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission];
      
      const isCustom = checkCustomPermissions(prev.role, newPermissions);
      setHasCustomPermissions(isCustom);
      
      return {
        ...prev,
        permissions: newPermissions
      };
    });
  };

  // Reset to role defaults
  const resetToRolePermissions = () => {
    const rolePermissions = ROLE_PERMISSIONS[formData.role] || [];
    setFormData(prev => ({ ...prev, permissions: rolePermissions }));
    setHasCustomPermissions(false);
  };

  // Generate secure password
  const generatePassword = () => {
    const password = generateWebSecurePassword({
      length: 12,
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSpecialChars: true,
      excludeSimilar: true
    });
    setFormData(prev => ({ ...prev, password }));
  };

  useEffect(() => {
    if (user) {
      const userPermissions = user.permissions || [];
      const isCustom = checkCustomPermissions(user.role, userPermissions);
      
      setFormData({
        username: user.username,
        email: user.email,
        fullName: `${user.firstName} ${user.lastName}`,
        role: user.role,
        permissions: userPermissions,
        password: '',
        active: user.isActive
      });
      setHasCustomPermissions(isCustom);
    } else {
      const defaultPermissions = ROLE_PERMISSIONS.viewer;
      setFormData({
        username: '',
        email: '',
        fullName: '',
        role: 'viewer',
        permissions: defaultPermissions,
        password: '',
        active: true
      });
      setHasCustomPermissions(false);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      logger.error('Failed to save user', error);
    } finally {
      setIsLoading(false);
    }
  };



  // Group permissions by category, excluding studio:access which is handled separately
  const groupedPermissions = PERMISSIONS
    .filter(perm => perm.value !== 'studio:access')
    .reduce((acc, perm) => {
      if (!acc[perm.group]) acc[perm.group] = [];
      acc[perm.group].push(perm);
      return acc;
    }, {} as Record<string, typeof PERMISSIONS>);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {user ? 'Edit User' : 'Create User'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Basic Information */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-1">
                Basic Information
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Username *
                  </label>
                  <Input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email *
                  </label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Full Name *
                </label>
                <Input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                  required
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {user ? 'New Password (optional)' : 'Password *'}
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      required={!user}
                      disabled={isLoading}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center pr-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-4 w-4 text-gray-400" />
                      ) : (
                        <EyeIcon className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={generatePassword}
                    disabled={isLoading}
                    className="px-3"
                  >
                    Generate
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  disabled={isLoading}
                >
                  {USER_ROLES.map(role => (
                    <option key={role.value} value={role.value}>
                      {role.label} - {role.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Access & Permissions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-1">
                  Access & Permissions
                </h3>
                {hasCustomPermissions && (
                  <button
                    type="button"
                    onClick={resetToRolePermissions}
                    className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                  >
                    Reset
                  </button>
                )}
              </div>
              
              {/* Access Controls */}
              <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Active user account
                    </span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.permissions.includes('studio:access')}
                      onChange={() => handlePermissionToggle('studio:access')}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Studio Access
                    </span>
                  </label>
                </div>
              </div>

              {/* Custom Permissions Warning */}
              {hasCustomPermissions && (
                <div className="p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
                  <div className="flex items-center">
                    <ExclamationTriangleIcon className="h-4 w-4 text-amber-600 dark:text-amber-400 mr-2" />
                    <span className="text-xs text-amber-800 dark:text-amber-200">
                      Custom permissions
                    </span>
                  </div>
                </div>
              )}
              
              {/* Permissions */}
              <div className="border border-gray-300 dark:border-gray-600 rounded-md p-3 max-h-80 overflow-y-auto">
                {Object.entries(groupedPermissions).map(([group, permissions]) => (
                  <div key={group} className="mb-3 last:mb-0">
                    <h4 className="text-xs font-medium text-gray-900 dark:text-white mb-1 border-b border-gray-200 dark:border-gray-700 pb-1">
                      {group}
                    </h4>
                    <div className="grid grid-cols-1 gap-1">
                      {permissions.map(permission => (
                        <label key={permission.value} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.permissions.includes(permission.value)}
                            onChange={() => handlePermissionToggle(permission.value)}
                            className="h-3 w-3 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-xs text-gray-600 dark:text-gray-400">
                            {permission.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </form>

        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                {user ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              user ? 'Update User' : 'Create User'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function UserManagement() {
  const { user: currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/api/users');
      if (response.success && response.data && response.data.users) {
        setUsers(response.data.users);
      }
    } catch (error) {
      logger.error('Failed to load users', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    
    // Check for action parameter to auto-open add user modal
    if (searchParams.get('action') === 'add') {
      handleCreateUser();
      // Clear the action parameter
      setSearchParams(params => {
        params.delete('action');
        return params;
      });
    }
  }, [searchParams, setSearchParams]);

  const handleCreateUser = () => {
    setSelectedUser(null);
    setShowUserModal(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  const handleSaveUser = async (userData: UserFormData) => {
    try {
      if (selectedUser) {
        // Update existing user
        const response = await apiClient.put(`/api/users/${selectedUser.id}`, userData);
        if (response.success) {
          await loadUsers();
        }
      } else {
        // Create new user
        const response = await apiClient.post('/api/users', userData);
        if (response.success) {
          await loadUsers();
        }
      }
    } catch (error) {
      logger.error('Failed to save user', error);
      throw error;
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Are you sure you want to delete user "${user.username}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await apiClient.delete(`/api/users/${user.id}`);
      if (response.success) {
        await loadUsers();
      }
    } catch (error) {
      logger.error('Failed to delete user', error);
    }
  };

  const filteredUsers = Array.isArray(users) ? users.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : '').toLowerCase().includes(searchQuery.toLowerCase())
  ) : [];

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'editor': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'author': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'viewer': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const hasCustomPermissions = (user: User) => {
    const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
    const userPermissions = user.permissions || [];
    const sortedRole = [...rolePermissions].sort();
    const sortedUser = [...userPermissions].sort();
    return sortedRole.join(',') !== sortedUser.join(',');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">User Management</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage user accounts, roles, and permissions
          </p>
        </div>
        <Button onClick={handleCreateUser}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {user.username} • {user.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
                          {user.role}
                        </span>
                        {hasCustomPermissions(user) && (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400 rounded-full" title="Custom permissions - differs from role defaults">
                            <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
                            Custom
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        user.isActive 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                      }`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditUser(user)}
                        >
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                        {currentUser?.id !== user.id && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteUser(user)}
                            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <UserModal
        user={selectedUser}
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
        onSave={handleSaveUser}
      />
    </div>
  );
}