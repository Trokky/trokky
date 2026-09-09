import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { apiClient } from '@/services/api-client';
import { createStudioLogger } from '@/utils/logger';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useDynamicPermissions } from '@/hooks/useDynamicPermissions';
import { USER_PERMISSIONS } from '@/constants/permissions';
import { ROLE_PERMISSIONS, type UserRole, type Permission, type User } from '@/types';
import { generateWebSecurePassword } from '@/utils/web-crypto';
import { useT } from '@trokky/trokky/i18n';

const logger = createStudioLogger('UserManagement');

// Define available roles (labels are loaded from translations)
const USER_ROLE_VALUES: UserRole[] = ['admin', 'editor', 'writer', 'author', 'viewer'];

// Permission definitions with i18n keys
const PERMISSION_DEFS: { value: Permission; labelKey: string; group: string }[] = [
  // Global Content Permissions
  { value: 'content:*', labelKey: 'userManagement.permissions.allContent', group: 'Content' },
  { value: 'content:read', labelKey: 'userManagement.permissions.viewAllContent', group: 'Content' },
  { value: 'content:write', labelKey: 'userManagement.permissions.editAllContent', group: 'Content' },
  { value: 'content:delete', labelKey: 'userManagement.permissions.deleteAllContent', group: 'Content' },
  { value: 'content:publish', labelKey: 'userManagement.permissions.publishAllContent', group: 'Content' },

  // Note: Dynamic schema permissions are handled via the custom permission input below
  // Individual schema permissions like 'articles:read', 'products:write' etc. are added as custom permissions

  // Media permissions
  { value: 'media:read', labelKey: 'userManagement.permissions.viewMedia', group: 'Media' },
  { value: 'media:upload', labelKey: 'userManagement.permissions.uploadMedia', group: 'Media' },
  { value: 'media:edit', labelKey: 'userManagement.permissions.editMedia', group: 'Media' },
  { value: 'media:delete', labelKey: 'userManagement.permissions.deleteMedia', group: 'Media' },

  // User management permissions
  { value: 'users:read', labelKey: 'userManagement.permissions.viewUsers', group: 'Users' },
  { value: 'users:write', labelKey: 'userManagement.permissions.editUsers', group: 'Users' },
  { value: 'users:delete', labelKey: 'userManagement.permissions.deleteUsers', group: 'Users' },
  { value: 'users:invite', labelKey: 'userManagement.permissions.inviteUsers', group: 'Users' },

  // Settings permissions
  { value: 'settings:read', labelKey: 'userManagement.permissions.viewSettings', group: 'Settings' },
  { value: 'settings:write', labelKey: 'userManagement.permissions.editSettings', group: 'Settings' },

  // Studio access
  { value: 'studio:access', labelKey: 'userManagement.permissions.studioAccess', group: 'Access' },

  // API Tokens
  { value: 'tokens:read', labelKey: 'userManagement.permissions.viewTokens', group: 'Tokens' },
  { value: 'tokens:write', labelKey: 'userManagement.permissions.createTokens', group: 'Tokens' },
  { value: 'tokens:delete', labelKey: 'userManagement.permissions.deleteTokens', group: 'Tokens' },

  // Webhooks
  { value: 'webhooks:read', labelKey: 'userManagement.permissions.viewWebhooks', group: 'Webhooks' },
  { value: 'webhooks:write', labelKey: 'userManagement.permissions.createEditWebhooks', group: 'Webhooks' },
  { value: 'webhooks:delete', labelKey: 'userManagement.permissions.deleteWebhooks', group: 'Webhooks' },
  { value: 'webhooks:test', labelKey: 'userManagement.permissions.testWebhooks', group: 'Webhooks' }
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
  const { t } = useT('studio');
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
  const [error, setError] = useState<string | null>(null);

  // Load dynamic schema permissions
  const { dynamicPermissions, loading: permissionsLoading, error: permissionsError } = useDynamicPermissions();
  const [hasCustomPermissions, setHasCustomPermissions] = useState(false);
  const [customPermission, setCustomPermission] = useState('');

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

  // Add custom permission
  const addCustomPermission = () => {
    if (!customPermission.trim()) return;
    
    // Validate permission format (schema:action)
    const permissionRegex = /^[a-z][a-z0-9_-]*:(read|write|delete|\*)$/i;
    if (!permissionRegex.test(customPermission.trim())) {
      alert(t('userManagement.modal.permissionValidationError'));
      return;
    }
    
    const permission = customPermission.trim() as Permission;
    if (!formData.permissions.includes(permission)) {
      setFormData(prev => ({ 
        ...prev, 
        permissions: [...prev.permissions, permission] 
      }));
      setHasCustomPermissions(true);
    }
    setCustomPermission('');
  };

  // Remove custom permission
  const removeCustomPermission = (permission: Permission) => {
    setFormData(prev => ({ 
      ...prev, 
      permissions: prev.permissions.filter(p => p !== permission) 
    }));
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
    // Clear error when modal opens/closes
    setError(null);

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
  }, [user, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await onSave(formData);
      onClose();
    } catch (error: any) {
      logger.error('Failed to save user', error);
      // Extract error message - ApiClientError has message directly
      const errorMessage = error?.message || 'Failed to save user. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };



  // Convert permission definitions to use translated labels
  const PERMISSIONS = PERMISSION_DEFS.map(perm => ({
    value: perm.value,
    label: t(perm.labelKey),
    group: perm.group
  }));

  // Organize permissions: Content first, then dynamic schemas, then system permissions
  const contentPermissions = PERMISSIONS.filter(perm => perm.group === 'Content');
  const systemPermissions = PERMISSIONS.filter(perm =>
    perm.group !== 'Content' && perm.value !== 'studio:access' // Exclude studio:access (handled separately)
  );

  const allPermissions = [
    ...contentPermissions,     // Global content permissions first
    ...dynamicPermissions,     // Then dynamic schema permissions
    ...systemPermissions       // Then system permissions (Media, Users, etc.)
  ];

  // Group permissions by category
  const groupedPermissions = allPermissions.reduce((acc, perm) => {
    if (!acc[perm.group]) acc[perm.group] = [];
    acc[perm.group].push(perm);
    return acc;
  }, {} as Record<string, typeof allPermissions>);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={user ? t('userManagement.modal.editTitle') : t('userManagement.modal.createTitle')}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error Alert */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400 mr-2 flex-shrink-0" />
                <span className="text-sm text-red-800 dark:text-red-200">{error}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Basic Information */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-1">
                {t('userManagement.modal.basicInfo')}
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('userManagement.modal.username')} *
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
                    {t('userManagement.modal.email')} *
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
                  {t('userManagement.modal.fullName')} *
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
                  {user ? t('userManagement.modal.newPassword') : `${t('userManagement.modal.password')} *`}
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
                    {t('userManagement.modal.generatePassword')}
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('userManagement.modal.role')}
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  disabled={isLoading}
                >
                  {USER_ROLE_VALUES.map(role => (
                    <option key={role} value={role}>
                      {t(`userManagement.roles.${role}`)} - {t(`userManagement.roles.${role}Desc`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Access & Permissions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-1">
                  {t('userManagement.modal.accessPermissions')}
                </h3>
                {hasCustomPermissions && (
                  <button
                    type="button"
                    onClick={resetToRolePermissions}
                    className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                  >
                    {t('userManagement.modal.reset')}
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
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('userManagement.modal.activeAccount')}
                    </span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.permissions.includes('studio:access')}
                      onChange={() => handlePermissionToggle('studio:access')}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('userManagement.modal.studioAccess')}
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
                      {t('userManagement.modal.customPermissions')}
                    </span>
                  </div>
                </div>
              )}
              
              {/* Permissions */}
              <div className="border border-gray-300 dark:border-gray-600 rounded-md p-3 max-h-80 overflow-y-auto">
                {permissionsLoading && (
                  <div className="flex items-center justify-center py-4">
                    <LoadingSpinner size="sm" className="mr-2" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">{t('userManagement.modal.loadingSchemaPermissions')}</span>
                  </div>
                )}

                {permissionsError && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md mb-3">
                    <div className="flex items-center">
                      <ExclamationTriangleIcon className="h-4 w-4 text-amber-600 dark:text-amber-400 mr-2" />
                      <span className="text-xs text-amber-800 dark:text-amber-200">
                        {t('userManagement.modal.failedLoadSchemaPermissions', { error: permissionsError })}
                      </span>
                    </div>
                  </div>
                )}
                
                {!permissionsLoading && Object.entries(groupedPermissions).map(([group, permissions]) => {
                  // Check if content:* is enabled to disable individual content permissions
                  const hasContentWildcard = formData.permissions.includes('content:*');
                  const isContentGroup = group === 'Content';
                  const isDynamicContentGroup = group.endsWith('(Content)'); // Dynamic schema groups
                  
                  return (
                    <div key={group} className="mb-3 last:mb-0">
                      <h4 className="text-xs font-medium text-gray-900 dark:text-white mb-1 border-b border-gray-200 dark:border-gray-700 pb-1">
                        {group}
                        {(isContentGroup || isDynamicContentGroup) && hasContentWildcard && (
                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                            {isContentGroup ? t('userManagement.modal.allContentEnabled') : t('userManagement.modal.coveredByAllContent')}
                          </span>
                        )}
                      </h4>
                      <div className="grid grid-cols-1 gap-1">
                        {permissions.map(permission => {
                          // Disable content permissions when content:* is checked (except content:* itself)
                          // This includes both the main Content group AND all dynamic schema groups
                          const isDisabled = (isContentGroup || isDynamicContentGroup) && hasContentWildcard && permission.value !== 'content:*';
                          
                          return (
                            <label key={permission.value} className={`flex items-center ${isDisabled ? 'opacity-50' : ''}`}>
                              <input
                                type="checkbox"
                                checked={formData.permissions.includes(permission.value)}
                                onChange={() => handlePermissionToggle(permission.value)}
                                disabled={isDisabled}
                                className="h-3 w-3 text-primary-600 focus:ring-primary-500 border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                              <span className="ml-2 text-xs text-gray-600 dark:text-gray-400">
                                {permission.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Custom Permissions - only show when content:* is not enabled */}
              {!formData.permissions.includes('content:*') && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('userManagement.modal.customSchemaPermissions')}
                  </label>
                  <div className="space-y-2">
                    {/* Add Custom Permission */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customPermission}
                        onChange={(e) => setCustomPermission(e.target.value)}
                        placeholder={t('userManagement.modal.customPermissionPlaceholder')}
                        className="flex-1 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                        onKeyPress={(e) => e.key === 'Enter' && addCustomPermission()}
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={addCustomPermission}
                        disabled={!customPermission.trim()}
                      >
                        {t('userManagement.modal.addPermission')}
                      </Button>
                    </div>

                    {/* Display Custom Permissions */}
                    {formData.permissions.filter(p => !allPermissions.some(perm => perm.value === p)).length > 0 && (
                      <div className="border border-gray-200 dark:border-gray-700 rounded-md p-2 bg-gray-50 dark:bg-gray-800">
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">{t('userManagement.modal.customPermissionsLabel')}</div>
                        <div className="flex flex-wrap gap-1">
                          {formData.permissions
                            .filter(p => !allPermissions.some(perm => perm.value === p))
                            .map(permission => (
                              <span 
                                key={permission}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded"
                              >
                                {permission}
                                <button
                                  type="button"
                                  onClick={() => removeCustomPermission(permission)}
                                  className="hover:text-blue-600 dark:hover:text-blue-300"
                                >
                                  ×
                                </button>
                              </span>
                            ))
                          }
                        </div>
                      </div>
                    )}
                    
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {t('userManagement.modal.permissionFormatHelp')}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="ghost" onClick={onClose} disabled={isLoading}>
              {t('userManagement.modal.cancel')}
            </Button>
            <Button type="submit" onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  {user ? t('userManagement.modal.updating') : t('userManagement.modal.creating')}
                </>
              ) : (
                user ? t('userManagement.modal.updateUser') : t('userManagement.createUser')
              )}
            </Button>
          </div>
        </form>
    </Modal>
  );
}

export function UserManagement() {
  const { t } = useT('studio');
  const { user: currentUser } = useAuth();
  const { hasPermission } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Permission checks
  const canCreateUser = hasPermission(USER_PERMISSIONS.WRITE) || hasPermission(USER_PERMISSIONS.INVITE);
  const canEditUser = hasPermission(USER_PERMISSIONS.WRITE);
  const canDeleteUser = hasPermission(USER_PERMISSIONS.DELETE);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/users');
      if (response.success && response.data && (response.data as any).users) {
        setUsers((response.data as any).users);
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
        const response = await apiClient.put(`/users/${selectedUser.id}`, userData);
        if (response.success && response.data) {
          await loadUsers();
          
          // If updating current user, emit event to update header
          if (currentUser?.id === selectedUser.id) {
            window.dispatchEvent(new CustomEvent('trokky:user:updated', {
              detail: { user: response.data }
            }));
            logger.debug('Emitted user update event for current user');
          }
        }
      } else {
        // Create new user
        const response = await apiClient.post('/users', userData);
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
    if (!confirm(t('userManagement.deleteConfirm', { username: user.username }))) {
      return;
    }

    try {
      const response = await apiClient.delete(`/users/${user.id}`);
      if (response.success) {
        await loadUsers();
      }
    } catch (error) {
      logger.error('Failed to delete user', error);
    }
  };

  const handleResetMFA = async (user: User) => {
    if (!confirm(t('userManagement.resetMfaConfirm', { username: user.username }))) {
      return;
    }

    try {
      const response = await apiClient.post(`/admin/users/${user.id}/mfa/reset`, {});
      if (response.success) {
        await loadUsers();
        logger.info('MFA reset for user', { userId: user.id, username: user.username });
      }
    } catch (error) {
      logger.error('Failed to reset MFA', error);
      alert(t('userManagement.failedResetMfa'));
    }
  };

  const hasMFAEnabled = (user: User) => {
    return user.mfa?.enabled && user.mfa?.methods?.some(m => m.enabled && m.verified);
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
      case 'writer': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('userManagement.title')}</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('userManagement.subtitle')}
          </p>
        </div>
        {canCreateUser && (
          <Button onClick={handleCreateUser}>
            <PlusIcon className="h-4 w-4 mr-2" />
            {t('userManagement.addUser')}
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder={t('userManagement.searchPlaceholder')}
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
                    {t('userManagement.tableHeaders.user')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('userManagement.tableHeaders.role')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('userManagement.tableHeaders.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('userManagement.tableHeaders.lastLogin')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('userManagement.tableHeaders.actions')}
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
                          <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400 rounded-full" title={t('userManagement.customPermissionsTooltip')}>
                            <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
                            {t('userManagement.custom')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.isActive
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                        }`}>
                          {user.isActive ? t('userManagement.status.active') : t('userManagement.status.inactive')}
                        </span>
                        {hasMFAEnabled(user) && (
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400 rounded-full"
                            title={t('userManagement.mfaEnabled')}
                          >
                            <ShieldCheckIcon className="h-3 w-3 mr-1" />
                            {t('userManagement.mfa')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : t('userManagement.never')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        {canEditUser && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditUser(user)}
                            title={t('userManagement.editUserTitle')}
                          >
                            <PencilIcon className="h-4 w-4" />
                          </Button>
                        )}
                        {canEditUser && hasMFAEnabled(user) && currentUser?.id !== user.id && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleResetMFA(user)}
                            className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                            title={t('userManagement.resetMfaTitle')}
                          >
                            <ArrowPathIcon className="h-4 w-4" />
                          </Button>
                        )}
                        {canDeleteUser && currentUser?.id !== user.id && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteUser(user)}
                            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            title={t('userManagement.deleteUserTitle')}
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