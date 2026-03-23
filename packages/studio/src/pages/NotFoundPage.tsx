import { Link } from 'react-router-dom';
import { HomeIcon } from '@heroicons/react/24/outline';
import { useT } from 'trokky/i18n';
import { Button } from '@/components/ui/Button';

export function NotFoundPage() {
  const { t } = useT('studio');

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-6xl font-bold text-gray-300 dark:text-gray-600 mb-4">
          404
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
          {t('notFound.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {t('notFound.message')}
        </p>
        <Button asChild>
          <Link to="/">
            <HomeIcon className="h-4 w-4 mr-2" />
            {t('notFound.goToDashboard')}
          </Link>
        </Button>
      </div>
    </div>
  );
}