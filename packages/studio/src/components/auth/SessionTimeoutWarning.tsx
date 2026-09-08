import { useState, useEffect } from 'react';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@trokky/trokky/i18n';

interface SessionTimeoutWarningProps {
  show: boolean;
  onDismiss: () => void;
  onRefresh: () => void;
  expiresAt: Date | null;
}

export function SessionTimeoutWarning({
  show,
  onDismiss,
  onRefresh,
  expiresAt
}: SessionTimeoutWarningProps) {
  const { t } = useT('studio');
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    if (!show || !expiresAt) return;

    const updateTimer = () => {
      const now = new Date();
      const remaining = expiresAt.getTime() - now.getTime();
      
      if (remaining <= 0) {
        setTimeLeft('Session expired');
        return;
      }
      
      const minutes = Math.floor(remaining / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
      
      if (minutes > 0) {
        setTimeLeft(`${minutes} minute${minutes > 1 ? 's' : ''}`);
      } else {
        setTimeLeft(`${seconds} second${seconds > 1 ? 's' : ''}`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [show, expiresAt]);

  if (!show) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 shadow-lg">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-400" />
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {t('sessionTimeout.title')}
            </h3>
            <div className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              <p>{t('sessionTimeout.expireIn', { time: timeLeft })}</p>
            </div>
            <div className="mt-3 flex space-x-2">
              <Button
                size="sm"
                onClick={() => {
                  console.log('Extend Session button clicked!');
                  onRefresh();
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {t('sessionTimeout.stayLoggedIn')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onDismiss}
                className="text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-800/20"
              >
                {t('common.dismiss')}
              </Button>
            </div>
          </div>
          <div className="ml-auto flex-shrink-0">
            <button
              type="button"
              className="inline-flex rounded-md text-amber-400 hover:text-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-amber-50"
              onClick={onDismiss}
            >
              <span className="sr-only">{t('common.close')}</span>
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SessionTimeoutWarningContainer() {
  const { 
    showTimeoutWarning, 
    sessionExpiresAt, 
    dismissTimeoutWarning, 
    refreshSession 
  } = useAuth();

  return (
    <SessionTimeoutWarning
      show={showTimeoutWarning}
      expiresAt={sessionExpiresAt}
      onDismiss={dismissTimeoutWarning}
      onRefresh={refreshSession}
    />
  );
}