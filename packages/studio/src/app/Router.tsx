import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { StudioLayout } from '@/components/layout/StudioLayout';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

// Page components (to be implemented)
import { DashboardPage } from '@/pages/DashboardPage';
import { ContentPage } from '@/pages/ContentPage';
import { MediaPage } from '@/pages/MediaPage';
import { UsersPage } from '@/pages/UsersPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { UserPreferencesPage } from '@/pages/UserPreferencesPage';
import { AuditLogsPage } from '@/pages/AuditLogsPage';
import { FieldsDemo } from '@/pages/FieldsDemo';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { OAuthCallbackPage } from '@/pages/OAuthCallbackPage';
import { DeviceAuthPage } from '@/pages/DeviceAuthPage';
import { AuthorizePage } from '@/pages/AuthorizePage';

// Get basename from config if available
const getBasename = () => {
  const config = (window as any).TROKKY_CONFIG;
  return config?.basePath || '';
};

const router = createBrowserRouter([
  {
    // OAuth callback route (standalone, no layout)
    path: '/oauth/callback',
    element: (
      <ErrorBoundary>
        <OAuthCallbackPage onLoginSuccess={() => window.location.href = getBasename() + '/'} />
      </ErrorBoundary>
    ),
  },
  {
    // Device authorization route (standalone, no layout - for CLI login)
    path: '/auth/device',
    element: (
      <ErrorBoundary>
        <DeviceAuthPage />
      </ErrorBoundary>
    ),
  },
  {
    // Authorization Code Flow consent page (standalone, no layout - for SSO)
    path: '/auth/authorize',
    element: (
      <ErrorBoundary>
        <AuthorizePage />
      </ErrorBoundary>
    ),
  },
  {
    path: '/',
    element: (
      <ErrorBoundary>
        <StudioLayout />
      </ErrorBoundary>
    ),
    errorElement: <ErrorBoundary><div>Error occurred</div></ErrorBoundary>,
    children: [
      {
        index: true,
        element: <DashboardPage />
      },
      {
        path: 'content',
        element: <ContentPage />
      },
      {
        path: 'content/:schemaName',
        element: <ContentPage />
      },
      {
        path: 'content/:schemaName/:documentId',
        element: <ContentPage />
      },
      {
        path: 'media',
        element: <MediaPage />
      },
      {
        path: 'users',
        element: <UsersPage />
      },
      {
        path: 'users/:userId',
        element: <UsersPage />
      },
      {
        path: 'settings',
        element: <SettingsPage />
      },
      {
        path: 'settings/:section',
        element: <SettingsPage />
      },
      {
        path: 'user/preferences',
        element: <UserPreferencesPage />
      },
      {
        path: 'audit-logs',
        element: <AuditLogsPage />
      },
      {
        path: 'fields-demo',
        element: <FieldsDemo />
      },
      {
        path: '*',
        element: <NotFoundPage />
      }
    ]
  }
], {
  basename: getBasename()
});

export function AppRouter() {
  return <RouterProvider router={router} />;
}