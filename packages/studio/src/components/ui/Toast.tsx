import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useT } from '@trokky/trokky/i18n';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const ToastComponent: React.FC<ToastProps> = ({ toast, onRemove }) => {
  const { t } = useT('studio');
  const { id, message, type, duration = 3000 } = toast; // Shorter duration for discrete toasts

  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(id);
    }, duration);

    return () => {
      clearTimeout(timer);
    };
  }, [id, duration, onRemove]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckIcon className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XMarkIcon className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="w-4 h-4 text-amber-500" />;
      case 'info':
      default:
        return <InformationCircleIcon className="w-4 h-4 text-blue-500" />;
    }
  };

  const getStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-white dark:bg-gray-800 border-green-200 dark:border-green-800 text-gray-800 dark:text-gray-200';
      case 'error':
        return 'bg-white dark:bg-gray-800 border-red-200 dark:border-red-800 text-gray-800 dark:text-gray-200';
      case 'warning':
        return 'bg-white dark:bg-gray-800 border-amber-200 dark:border-amber-800 text-gray-800 dark:text-gray-200';
      case 'info':
      default:
        return 'bg-white dark:bg-gray-800 border-blue-200 dark:border-blue-800 text-gray-800 dark:text-gray-200';
    }
  };

  return (
    <div
      className={`
        flex items-center px-3 py-2 rounded-lg border shadow-lg backdrop-blur-sm
        transition-all duration-300 ease-in-out transform animate-in slide-in-from-top-2
        ${getStyles()}
      `}
      role="alert"
    >
      {getIcon()}
      <div className="ml-2 flex-1">
        <p className="text-sm font-medium">{message}</p>
      </div>
      <button
        onClick={() => onRemove(id)}
        className="ml-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors opacity-60 hover:opacity-100"
        aria-label={t('toast.closeNotification')}
      >
        <XMarkIcon className="w-3 h-3" />
      </button>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const { t } = useT('studio');
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handleToast = (event: CustomEvent<{ message: string; type: 'success' | 'error' | 'warning' | 'info' }>) => {
      const { message, type } = event.detail;
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const newToast: Toast = {
        id,
        message,
        type,
        duration: type === 'error' ? 4000 : 3000 // Shorter durations for discrete toasts
      };

      setToasts(prev => {
        // Limit to 3 toasts max and remove oldest if needed
        const updatedToasts = [...prev, newToast];
        return updatedToasts.slice(-3);
      });
    };

    window.addEventListener('studio:toast', handleToast as EventListener);

    return () => {
      window.removeEventListener('studio:toast', handleToast as EventListener);
    };
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-toast space-y-2 max-w-xs w-full pointer-events-none"
      aria-live="polite"
      aria-label={t('toast.notifications')}
    >
      {toasts.map((toast) => (
        <div 
          key={toast.id}
          className="pointer-events-auto"
        >
          <ToastComponent
            toast={toast}
            onRemove={removeToast}
          />
        </div>
      ))}
    </div>
  );
};