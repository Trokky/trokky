import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { StudioLayout } from '@/components/layout/StudioLayout';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

// Page components (to be implemented)
import { DashboardPage } from '@/pages/DashboardPage';
import { ContentPage } from '@/pages/ContentPage';
import { MediaPage } from '@/pages/MediaPage';
import { UsersPage } from '@/pages/UsersPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

// Get basename from integrated config if available
const getBasename = () => {
  const integratedConfig = (window as any).TROKKY_INTEGRATED_CONFIG;
  if (integratedConfig?.basePath) {
    return integratedConfig.basePath;
  }
  return undefined;
};

const router = createBrowserRouter([
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